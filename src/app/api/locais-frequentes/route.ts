import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { localFrequenteSchema } from "@/lib/schemas";

export async function GET() {
  return withAuth(async () => {
    const locais = await prisma.localFrequente.findMany({
      orderBy: { nome: "asc" },
    });
    return NextResponse.json(locais);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    const data = await parseBody(request, localFrequenteSchema);
    const local = await prisma.localFrequente.create({
      data: {
        nome: data.nome.trim(),
        endereco: data.endereco?.trim() || "",
        plusCode: data.plusCode?.trim() || "",
      },
    });
    return NextResponse.json(local, { status: 201 });
  });
}
