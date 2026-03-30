import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createTursoFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    // Older @libsql/client versions probe /v1/jobs to detect "schema databases".
    // AWS Turso endpoints now return a protocol-level 400 for that path, which
    // causes the client to misclassify the database and fail every query.
    if (url.endsWith("/v1/jobs") || /\/v1\/jobs\/[^/]+$/.test(url)) {
      return new Response(JSON.stringify({ error: "Invalid namespace" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    return baseFetch(input, init);
  };
}

function patchGlobalFetchForTurso(): void {
  const globalWithPatchedFetch = globalThis as typeof globalThis & {
    __morangosTursoFetchPatched?: boolean;
  };

  if (globalWithPatchedFetch.__morangosTursoFetchPatched) return;

  globalWithPatchedFetch.fetch = createTursoFetch(globalWithPatchedFetch.fetch);
  globalWithPatchedFetch.__morangosTursoFetchPatched = true;
}

function createPrismaClient(): PrismaClient {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    patchGlobalFetchForTurso();

    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
      fetch: globalThis.fetch,
    });
    const adapter = new PrismaLibSQL(client);
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
