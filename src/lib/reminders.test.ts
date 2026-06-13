import { describe, it, expect } from "vitest";
import { isDue, toDateOnly } from "./reminders";

const now = new Date("2026-06-13T09:00:00Z");

describe("isDue", () => {
  it("due when expiresAt within lead window", () => {
    expect(isDue(new Date("2026-06-15T00:00:00Z"), now, 2)).toBe(true);
  });
  it("due when already expired", () => {
    expect(isDue(new Date("2026-06-10T00:00:00Z"), now, 2)).toBe(true);
  });
  it("not due when far in future", () => {
    expect(isDue(new Date("2026-06-30T00:00:00Z"), now, 2)).toBe(false);
  });
  it("not due when no expiry", () => {
    expect(isDue(null, now, 2)).toBe(false);
  });
});

describe("toDateOnly", () => {
  it("strips time to UTC midnight", () => {
    expect(toDateOnly(now).toISOString()).toBe("2026-06-13T00:00:00.000Z");
  });
});
