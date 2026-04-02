import { describe, it, expect } from "vitest";
import { parsePagination, paginatedResponse, UNPAGINATED_LIMIT } from "@/lib/pagination";

describe("parsePagination", () => {
  it("returns null when page param is missing (retrocompatível)", () => {
    const params = new URLSearchParams("");
    expect(parsePagination(params)).toBeNull();
  });

  it("returns null when page is empty string", () => {
    const params = new URLSearchParams("page=");
    expect(parsePagination(params)).toBeNull();
  });

  it("parses page and uses default limit", () => {
    const params = new URLSearchParams("page=1");
    const result = parsePagination(params)!;
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(50);
  });

  it("parses page=2 with correct skip", () => {
    const params = new URLSearchParams("page=2&limit=20");
    const result = parsePagination(params)!;
    expect(result.page).toBe(2);
    expect(result.limit).toBe(20);
    expect(result.skip).toBe(20);
    expect(result.take).toBe(20);
  });

  it("caps limit at MAX_LIMIT (500)", () => {
    const params = new URLSearchParams("page=1&limit=9999");
    const result = parsePagination(params)!;
    expect(result.limit).toBe(500);
  });

  it("enforces minimum page of 1", () => {
    const params = new URLSearchParams("page=0");
    const result = parsePagination(params)!;
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it("enforces minimum page of 1 for negative values", () => {
    const params = new URLSearchParams("page=-5");
    const result = parsePagination(params)!;
    expect(result.page).toBe(1);
  });

  it("enforces minimum limit of 1", () => {
    const params = new URLSearchParams("page=1&limit=0");
    const result = parsePagination(params)!;
    expect(result.limit).toBe(50); // 0 falls to default via || DEFAULT_LIMIT
  });

  it("handles NaN page gracefully", () => {
    const params = new URLSearchParams("page=abc");
    const result = parsePagination(params)!;
    expect(result.page).toBe(1);
  });

  it("handles NaN limit gracefully", () => {
    const params = new URLSearchParams("page=1&limit=abc");
    const result = parsePagination(params)!;
    expect(result.limit).toBe(50);
  });
});

describe("paginatedResponse", () => {
  it("builds correct response structure", () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = paginatedResponse(data, 100, { page: 1, limit: 50, skip: 0, take: 50 });
    expect(result.data).toEqual(data);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(50);
    expect(result.pagination.total).toBe(100);
    expect(result.pagination.totalPages).toBe(2);
  });

  it("calculates totalPages correctly with remainder", () => {
    const result = paginatedResponse([], 101, { page: 1, limit: 50, skip: 0, take: 50 });
    expect(result.pagination.totalPages).toBe(3);
  });

  it("returns 0 totalPages for 0 total", () => {
    const result = paginatedResponse([], 0, { page: 1, limit: 50, skip: 0, take: 50 });
    expect(result.pagination.totalPages).toBe(0);
  });
});

describe("UNPAGINATED_LIMIT", () => {
  it("is 2000", () => {
    expect(UNPAGINATED_LIMIT).toBe(2000);
  });
});
