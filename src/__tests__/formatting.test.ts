import { describe, it, expect } from "vitest";
import { formatPrice, formatDate, todayStr, addDays, dateToStr } from "@/lib/formatting";

describe("formatPrice", () => {
  it("formats zero", () => {
    expect(formatPrice(0)).toBe("R$ 0,00");
  });

  it("formats whole number", () => {
    expect(formatPrice(10)).toBe("R$ 10,00");
  });

  it("formats decimal", () => {
    expect(formatPrice(25.5)).toBe("R$ 25,50");
  });

  it("formats large number", () => {
    const result = formatPrice(1250.99);
    expect(result).toContain("1250,99");
  });
});

describe("formatDate", () => {
  it("converts YYYY-MM-DD to DD/MM/YYYY", () => {
    expect(formatDate("2024-01-15")).toBe("15/01/2024");
  });

  it("handles single-digit day/month", () => {
    expect(formatDate("2024-03-05")).toBe("05/03/2024");
  });

  it("returns empty for empty string", () => {
    expect(formatDate("")).toBe("");
  });
});

describe("todayStr", () => {
  it("returns YYYY-MM-DD format", () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("dateToStr", () => {
  it("converts Date to YYYY-MM-DD in Brazil timezone", () => {
    // Use noon UTC to avoid timezone-dependent test behavior
    // (noon UTC = 9 AM in São Paulo, always same calendar day)
    const d = new Date(Date.UTC(2024, 0, 15, 12, 0, 0));
    expect(dateToStr(d)).toBe("2024-01-15");
  });
});

describe("addDays", () => {
  it("adds days correctly", () => {
    expect(addDays("2024-01-01", 1)).toBe("2024-01-02");
    expect(addDays("2024-01-31", 1)).toBe("2024-02-01");
  });
});
