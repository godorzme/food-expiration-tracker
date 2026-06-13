import { describe, it, expect } from "vitest";
import { resolveExpiresAt } from "./food";

const SHELF = { "熟食": 3 };

describe("resolveExpiresAt", () => {
  it("uses manual expiresAt when provided", () => {
    const manual = new Date("2026-07-01T00:00:00Z");
    const r = resolveExpiresAt({ category: "熟食", storedAt: new Date("2026-06-10T00:00:00Z"), manualExpiresAt: manual }, SHELF);
    expect(r?.toISOString()).toBe(manual.toISOString());
  });
  it("auto-estimates when manual is null", () => {
    const r = resolveExpiresAt({ category: "熟食", storedAt: new Date("2026-06-10T00:00:00Z"), manualExpiresAt: null }, SHELF);
    expect(r?.toISOString()).toBe("2026-06-13T00:00:00.000Z");
  });
  it("returns null when no manual and unknown category", () => {
    const r = resolveExpiresAt({ category: "未知", storedAt: new Date(), manualExpiresAt: null }, SHELF);
    expect(r).toBeNull();
  });
});
