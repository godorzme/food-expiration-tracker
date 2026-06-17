// src/components/ui/StatusPill.test.ts
import { describe, it, expect } from "vitest";
import { statusMeta } from "./StatusPill";

describe("statusMeta", () => {
  it("maps each expiry state to a label + edge color", () => {
    expect(statusMeta("expired").label).toBe("已過期");
    expect(statusMeta("urgent").label).toBe("今明到期");
    expect(statusMeta("soon").label).toBe("接近到期");
    expect(statusMeta("ok").label).toBe("安全");
    expect(statusMeta("none").label).toBe("無到期日");
  });
  it("every state has a non-empty edge color", () => {
    for (const s of ["expired", "urgent", "soon", "ok", "none"] as const) {
      expect(statusMeta(s).edge).toMatch(/^#/);
    }
  });
});
