import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { auth } from "../../../../auth";

export async function GET() {
  try {
    const session = await auth();
    if (!(session?.user as { isAdmin?: boolean })?.isAdmin) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const dbPath = join(process.cwd(), "prisma", "dev.db");
    const fileBuffer = readFileSync(dbPath);

    const now = new Date();
    const timestamp = now.toISOString().slice(0, 10);
    const filename = `backup-morangos-${timestamp}.db`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Erro ao gerar backup:", error);
    return NextResponse.json(
      { error: "Erro ao gerar backup" },
      { status: 500 }
    );
  }
}
