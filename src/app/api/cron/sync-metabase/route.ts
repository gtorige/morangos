import { NextRequest, NextResponse } from "next/server";
import { syncTursoToNeon } from "@/lib/metabase-sync";

// Permitir ate 5 minutos para a sync completar
export const maxDuration = 300;

/**
 * GET /api/cron/sync-metabase
 * Chamado pelo Vercel Cron para espelhar Turso → Neon Postgres.
 * Tambem pode ser chamado manualmente via admin (com senha).
 */
export async function GET(request: NextRequest) {
  // Auth: Vercel Cron envia header `Authorization: Bearer <CRON_SECRET>`
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs: string[] = [];
  try {
    const result = await syncTursoToNeon({
      onLog: (msg) => logs.push(msg),
    });

    return NextResponse.json({
      ok: true,
      ...result,
      logs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        logs,
      },
      { status: 500 }
    );
  }
}
