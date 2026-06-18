import { describe, it, expect } from "vitest";
import { parseDays } from "./expiryAI";

describe("parseDays", () => {
  it('parses {"days":N}', () => {
    expect(parseDays('{"days": 7}')).toBe(7);
  });
  it("parses fenced json", () => {
    expect(parseDays('```json\n{"days":5}\n```')).toBe(5);
  });
  it("clamps to >=1 and <=3650", () => {
    expect(parseDays('{"days":0}')).toBeNull();
    expect(parseDays('{"days":99999}')).toBe(3650);
  });
  it("returns null for garbage", () => {
    expect(parseDays("不知道")).toBeNull();
    expect(parseDays("")).toBeNull();
  });
});
