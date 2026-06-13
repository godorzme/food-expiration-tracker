import { describe, it, expect } from "vitest";
import { expiryState } from "./expiryState";

const now = new Date("2026-06-13T00:00:00Z");

describe("expiryState", () => {
  it("none when no expiry", () => { expect(expiryState(null, now, 2)).toBe("none"); });
  it("expired when past", () => { expect(expiryState(new Date("2026-06-12T00:00:00Z"), now, 2)).toBe("expired"); });
  it("urgent when within 1 day", () => { expect(expiryState(new Date("2026-06-13T20:00:00Z"), now, 2)).toBe("urgent"); });
  it("soon when within lead days", () => { expect(expiryState(new Date("2026-06-15T00:00:00Z"), now, 2)).toBe("soon"); });
  it("ok when far away", () => { expect(expiryState(new Date("2026-06-30T00:00:00Z"), now, 2)).toBe("ok"); });
});
