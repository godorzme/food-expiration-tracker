import { describe, it, expect } from "vitest";
import { normalizeStorage, STORAGE_METHODS } from "./storageMethod";

describe("normalizeStorage", () => {
  it("maps free-text room temp to 常溫", () => {
    expect(normalizeStorage("室溫陰涼乾燥處")).toBe("常溫");
    expect(normalizeStorage("放在陰涼乾燥的地方")).toBe("常溫");
    expect(normalizeStorage("cool dry place")).toBe("常溫");
  });
  it("maps fridge text to 冷藏", () => {
    expect(normalizeStorage("冷藏保存，保持在4°C以下")).toBe("冷藏");
    expect(normalizeStorage("放冰箱")).toBe("冷藏");
    expect(normalizeStorage("refrigerate")).toBe("冷藏");
  });
  it("maps freezer text to 冷凍 (before 冷藏)", () => {
    expect(normalizeStorage("冷凍庫")).toBe("冷凍");
    expect(normalizeStorage("freezer")).toBe("冷凍");
  });
  it("passes through exact methods", () => {
    for (const m of STORAGE_METHODS) expect(normalizeStorage(m)).toBe(m);
  });
  it("returns null for empty/unknown", () => {
    expect(normalizeStorage("")).toBeNull();
    expect(normalizeStorage(null)).toBeNull();
    expect(normalizeStorage("不知道")).toBeNull();
  });
});
