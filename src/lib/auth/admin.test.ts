import { describe, it, expect } from "vitest";
import { ADMIN_PHONE, isAdminPhone } from "./admin";

describe("isAdminPhone", () => {
  it("matches the hardcoded admin phone (already normalized)", () => {
    expect(ADMIN_PHONE).toBe("0926571988");
    expect(isAdminPhone("0926571988")).toBe(true);
  });
  it("rejects any other number", () => {
    expect(isAdminPhone("0900000000")).toBe(false);
    expect(isAdminPhone("")).toBe(false);
  });
});
