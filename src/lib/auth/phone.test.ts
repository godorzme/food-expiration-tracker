import { describe, it, expect } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("strips dashes and spaces", () => {
    expect(normalizePhone("0926-571-988")).toBe("0926571988");
    expect(normalizePhone(" 0926 571 988 ")).toBe("0926571988");
  });
  it("converts +886 prefix to leading 0", () => {
    expect(normalizePhone("+886926571988")).toBe("0926571988");
    expect(normalizePhone("886-926-571-988")).toBe("0926571988");
  });
  it("keeps a plain 10-digit number", () => {
    expect(normalizePhone("0926571988")).toBe("0926571988");
  });
  it("returns empty string for input with no digits", () => {
    expect(normalizePhone("abc")).toBe("");
    expect(normalizePhone("")).toBe("");
  });
});
