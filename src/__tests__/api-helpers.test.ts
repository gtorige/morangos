import { describe, it, expect, vi } from "vitest";

// Mock next-auth and next/server to avoid import errors in test
vi.mock("next/server", () => ({ NextResponse: { json: vi.fn() } }));
vi.mock("../../auth", () => ({ auth: vi.fn() }));

import { checkOptimisticLock, parseId, parseDateParam, ApiError } from "@/lib/api-helpers";

describe("checkOptimisticLock", () => {
  it("passes when both are empty/null (new record, no lock)", () => {
    const result = checkOptimisticLock(undefined, "");
    expect(result).toBeTruthy(); // returns ISO timestamp
    expect(new Date(result).getTime()).not.toBeNaN();
  });

  it("passes when both are undefined (no lock at all)", () => {
    expect(() => checkOptimisticLock(undefined, undefined)).not.toThrow();
  });

  it("passes when db has empty string default and client sends nothing", () => {
    expect(() => checkOptimisticLock(undefined, "")).not.toThrow();
    expect(() => checkOptimisticLock(null, "")).not.toThrow();
  });

  it("passes when timestamps match", () => {
    const ts = "2024-01-01T00:00:00.000Z";
    expect(() => checkOptimisticLock(ts, ts)).not.toThrow();
  });

  it("throws 409 when timestamps differ", () => {
    const ts1 = "2024-01-01T00:00:00.000Z";
    const ts2 = "2024-01-01T01:00:00.000Z";
    expect(() => checkOptimisticLock(ts1, ts2)).toThrow(ApiError);
    try {
      checkOptimisticLock(ts1, ts2);
    } catch (e) {
      expect((e as ApiError).status).toBe(409);
    }
  });

  it("throws 409 when db has lock but client sends nothing", () => {
    const dbTs = "2024-01-01T00:00:00.000Z";
    expect(() => checkOptimisticLock(undefined, dbTs)).toThrow(ApiError);
    try {
      checkOptimisticLock(undefined, dbTs);
    } catch (e) {
      expect((e as ApiError).status).toBe(409);
    }
  });

  it("passes when client sends timestamp but db has empty default", () => {
    const ts = "2024-01-01T00:00:00.000Z";
    expect(() => checkOptimisticLock(ts, "")).not.toThrow();
  });

  it("returns a valid ISO timestamp", () => {
    const result = checkOptimisticLock(undefined, undefined);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("parseId", () => {
  it("parses valid positive integer", () => {
    expect(parseId("1")).toBe(1);
    expect(parseId("999")).toBe(999);
  });

  it("throws for zero", () => {
    expect(() => parseId("0")).toThrow(ApiError);
  });

  it("throws for negative", () => {
    expect(() => parseId("-1")).toThrow(ApiError);
  });

  it("throws for non-numeric", () => {
    expect(() => parseId("abc")).toThrow(ApiError);
  });

  it("throws for empty string", () => {
    expect(() => parseId("")).toThrow(ApiError);
  });
});

describe("parseDateParam", () => {
  it("returns fallback when value is null", () => {
    expect(parseDateParam(null, "2024-01-01")).toBe("2024-01-01");
  });

  it("returns today when value is null and no fallback", () => {
    const result = parseDateParam(null);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("accepts valid YYYY-MM-DD", () => {
    expect(parseDateParam("2024-06-15")).toBe("2024-06-15");
  });

  it("throws for invalid date format", () => {
    expect(() => parseDateParam("not-a-date")).toThrow(ApiError);
    expect(() => parseDateParam("2024/01/01")).toThrow(ApiError);
    expect(() => parseDateParam("01-01-2024")).toThrow(ApiError);
  });

  it("throws for partial date", () => {
    expect(() => parseDateParam("2024-01")).toThrow(ApiError);
  });
});
