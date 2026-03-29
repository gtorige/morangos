import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { auth } from "../../auth";
import { Prisma } from "@prisma/client";

type Session = { user: { id?: string; isAdmin?: boolean } };

/** Standard authenticated + validated API handler wrapper. */
export async function withAuth(
  handler: (session: Session) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    return await handler(session as Session);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Parse and validate request body against a Zod schema. */
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  const raw = await request.json();
  return schema.parse(raw);
}

/** Parse a route param id string into a validated positive integer. */
export function parseId(id: string): number {
  const n = parseInt(id, 10);
  if (isNaN(n) || n <= 0) {
    throw new ApiError("ID inválido", 400);
  }
  return n;
}

/** Custom API error with status code. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Centralized error handler for API routes. */
export function handleApiError(error: unknown): NextResponse {
  // Zod validation errors
  if (error instanceof ZodError) {
    const messages = error.issues.map((e) => {
      const path = e.path.join(".");
      return path ? `${path}: ${e.message}` : e.message;
    });
    return NextResponse.json(
      { error: "Dados inválidos", details: messages },
      { status: 400 }
    );
  }

  // Custom API errors
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  // Prisma known errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Registro duplicado. Já existe um item com esses dados." },
        { status: 409 }
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Registro não encontrado." },
        { status: 404 }
      );
    }
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "Referência inválida. Verifique os dados relacionados." },
        { status: 400 }
      );
    }
  }

  // Unknown errors
  console.error("Erro interno:", error);
  return NextResponse.json(
    { error: "Erro interno do servidor" },
    { status: 500 }
  );
}
