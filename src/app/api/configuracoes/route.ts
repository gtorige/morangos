import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { configuracaoSchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const chave = searchParams.get("chave");

    if (chave) {
      const config = await prisma.configuracao.findUnique({
        where: { chave },
      });
      return NextResponse.json(config);
    }

    const configs = await prisma.configuracao.findMany();

    const envDefaults: Record<string, string | undefined> = {
      google_routes_api_key: process.env.GOOGLE_ROUTES_API_KEY,
    };

    for (const [key, envVal] of Object.entries(envDefaults)) {
      if (envVal && !configs.find((c: { chave: string }) => c.chave === key)) {
        configs.push({ chave: key, valor: envVal } as (typeof configs)[number]);
      }
    }

    return NextResponse.json(configs);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const data = await parseBody(request, configuracaoSchema);

    const config = await prisma.configuracao.upsert({
      where: { chave: data.chave },
      update: { valor: data.valor },
      create: { chave: data.chave, valor: data.valor },
    });

    return NextResponse.json(config);
  });
}
