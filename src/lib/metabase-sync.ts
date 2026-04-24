/**
 * Turso → Neon Postgres sync para Metabase
 *
 * Le todas as tabelas do Turso (SQLite) e espelha em um Postgres (Neon).
 * O Metabase se conecta no Postgres para criar dashboards.
 *
 * Executado via Vercel Cron (a cada 10 min) ou manualmente via CLI.
 */
import { createClient as createLibsqlClient } from "@libsql/client";
import { Client as PgClient } from "pg";

// Mapeamento de tipos SQLite → PostgreSQL
function mapSqliteTypeToPg(sqliteType: string): string {
  const t = sqliteType.toUpperCase();
  if (t.includes("INT")) return "BIGINT";
  if (t.includes("REAL") || t.includes("FLOAT") || t.includes("DOUBLE")) return "DOUBLE PRECISION";
  if (t.includes("BOOL")) return "BOOLEAN";
  // Tudo mais vira TEXT (datas no Morangos já são strings YYYY-MM-DD)
  return "TEXT";
}

interface SyncResult {
  tables: number;
  rows: number;
  durationMs: number;
  skipped: string[];
}

export async function syncTursoToNeon(opts?: {
  tursoUrl?: string;
  tursoToken?: string;
  neonUrl?: string;
  onLog?: (msg: string) => void;
}): Promise<SyncResult> {
  const start = Date.now();
  const log = opts?.onLog ?? (() => {});

  const tursoUrl = opts?.tursoUrl ?? process.env.TURSO_DATABASE_URL;
  const tursoToken = opts?.tursoToken ?? process.env.TURSO_AUTH_TOKEN;
  const neonUrl = opts?.neonUrl ?? process.env.NEON_DATABASE_URL;

  if (!tursoUrl || !tursoToken) throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN sao obrigatorios");
  if (!neonUrl) throw new Error("NEON_DATABASE_URL e obrigatorio");

  // Fetch shim para Turso /v1/jobs probe bug (mesmo workaround do prisma.ts)
  const _of = globalThis.fetch;
  const patchedFetch = async (u: RequestInfo | URL, o?: RequestInit) => {
    const s = typeof u === "string" ? u : u instanceof URL ? u.toString() : "";
    if (s.includes("/v1/jobs")) return new Response("", { status: 404 });
    return _of.call(globalThis, u, o);
  };
  globalThis.fetch = patchedFetch as typeof globalThis.fetch;

  const turso = createLibsqlClient({ url: tursoUrl, authToken: tursoToken });
  const pg = new PgClient({ connectionString: neonUrl });
  await pg.connect();

  const skipped: string[] = [];
  let tableCount = 0;
  let rowCount = 0;

  try {
    // 1. Listar tabelas do Turso (exclui sqlite_ internas e _prisma_migrations)
    const tables = await turso.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'"
    );

    for (const tableRow of tables.rows) {
      const tableName = String(tableRow.name);
      log(`Tabela: ${tableName}`);

      // 2. Pegar schema da tabela no Turso
      const pragma = await turso.execute(`PRAGMA table_info("${tableName}")`);
      const columns = pragma.rows.map((r) => ({
        name: String(r.name),
        type: String(r.type),
        notNull: Number(r.notnull) === 1,
        pk: Number(r.pk) === 1,
      }));

      if (columns.length === 0) { skipped.push(tableName); continue; }

      // 3. Criar tabela no Postgres (DROP + CREATE para idempotencia)
      const colDefs = columns.map((c) => {
        const pgType = mapSqliteTypeToPg(c.type);
        const nullStr = c.notNull ? "NOT NULL" : "";
        return `"${c.name}" ${pgType} ${nullStr}`.trim();
      });

      await pg.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      await pg.query(`CREATE TABLE "${tableName}" (${colDefs.join(", ")})`);

      // 4. Copiar dados (paginado para evitar memory blow-up em tabelas grandes)
      const PAGE_SIZE = 1000;
      let offset = 0;
      let tableRows = 0;

      while (true) {
        const data = await turso.execute({
          sql: `SELECT * FROM "${tableName}" LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
          args: [],
        });

        if (data.rows.length === 0) break;

        // Bulk insert via multiple VALUES
        const colNames = columns.map((c) => `"${c.name}"`).join(", ");
        const placeholders: string[] = [];
        const values: unknown[] = [];
        let idx = 1;

        for (const row of data.rows) {
          const rowPlaceholders = columns.map(() => `$${idx++}`);
          placeholders.push(`(${rowPlaceholders.join(", ")})`);
          for (const col of columns) {
            const v = row[col.name];
            values.push(v === undefined ? null : v);
          }
        }

        if (placeholders.length > 0) {
          await pg.query(
            `INSERT INTO "${tableName}" (${colNames}) VALUES ${placeholders.join(", ")}`,
            values
          );
        }

        tableRows += data.rows.length;
        offset += PAGE_SIZE;
        if (data.rows.length < PAGE_SIZE) break;
      }

      log(`  → ${tableRows} linha(s)`);
      tableCount++;
      rowCount += tableRows;
    }
  } finally {
    await pg.end();
    globalThis.fetch = _of;
  }

  return {
    tables: tableCount,
    rows: rowCount,
    durationMs: Date.now() - start,
    skipped,
  };
}
