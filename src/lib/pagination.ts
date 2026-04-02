/**
 * Helper para paginação padrão nos GET endpoints.
 *
 * Query params suportados:
 * - page: número da página (default: 1)
 * - limit: itens por página (default: 50, max: 500)
 *
 * Retorna { skip, take } para uso com Prisma findMany.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const MAX_UNPAGINATED = 2000;

export interface PaginationParams {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Extrai parâmetros de paginação de URLSearchParams.
 * Se `page` não for fornecido, retorna null (sem paginação — retrocompatível).
 */
export function parsePagination(searchParams: URLSearchParams): PaginationParams | null {
  const pageParam = searchParams.get("page");
  if (!pageParam) return null; // sem paginação — retorna todos os resultados

  const page = Math.max(1, parseInt(pageParam) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)) || DEFAULT_LIMIT));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Limite seguro para queries sem paginação (retrocompatível).
 * Evita memory pressure em tabelas que crescem indefinidamente.
 */
export const UNPAGINATED_LIMIT = MAX_UNPAGINATED;

/**
 * Constrói resposta paginada com metadados.
 */
export function paginatedResponse<T>(data: T[], total: number, params: PaginationParams): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}
