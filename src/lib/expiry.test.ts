import { describe, it, expect } from "vitest";
import { estimateExpiry } from "./expiry";
import { addDays } from "./expiry";

const SHELF: Record<string, number> = { "熟食": 3, "葉菜": 5, "肉類": 2 };

describe("estimateExpiry", () => {
  it("adds category days to storedAt", () => {
    const r = estimateExpiry("熟食", new Date("2026-06-10T00:00:00Z"), SHELF);
    expect(r?.toISOString()).toBe("2026-06-13T00:00:00.000Z");
  });
  it("returns null for unknown category", () => {
    expect(estimateExpiry("外星食物", new Date(), SHELF)).toBeNull();
  });
});

describe("addDays", () => {
  it("adds days across month boundary", () => {
    const out = addDays(new Date("2026-06-28T00:00:00.000Z"), 7);
    expect(out.toISOString().slice(0, 10)).toBe("2026-07-05");
  });
});
