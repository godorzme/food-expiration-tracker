import { describe, it, expect } from "vitest";
import { parseDays, parseEstimate } from "./expiryAI";

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

describe("parseEstimate", () => {
  it("parses days + storage", () => {
    expect(parseEstimate('{"days": 60, "storage": "室溫陰涼乾燥處"}')).toEqual({ days: 60, storage: "室溫陰涼乾燥處" });
  });
  it("parses fenced json with storage", () => {
    expect(parseEstimate('```json\n{"days":7,"storage":"冷藏"}\n```')).toEqual({ days: 7, storage: "冷藏" });
  });
  it("storage null when missing", () => {
    expect(parseEstimate('{"days": 5}')).toEqual({ days: 5, storage: null });
  });
  it("trims storage to 20 chars", () => {
    const long = "一二三四五六七八九十一二三四五六七八九十二";
    expect(parseEstimate(`{"days":3,"storage":"${long}"}`).storage).toHaveLength(20);
  });
  it("both null for garbage", () => {
    expect(parseEstimate("不知道")).toEqual({ days: null, storage: null });
  });
});
