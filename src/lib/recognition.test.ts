import { describe, it, expect } from "vitest";
import { parseRecognition } from "./recognition";

describe("parseRecognition", () => {
  it("parses a valid items array", () => {
    const raw = JSON.stringify({ items: [
      { name: "雞腿", category: "肉類", confidence: 0.9 },
      { name: "高麗菜", category: "葉菜", confidence: 0.7 },
    ]});
    const out = parseRecognition(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ name: "雞腿", category: "肉類", confidence: 0.9 });
  });

  it("returns [] on invalid JSON", () => {
    expect(parseRecognition("not json")).toEqual([]);
  });

  it("skips items missing name", () => {
    const raw = JSON.stringify({ items: [{ category: "肉類" }, { name: "蛋", category: "蛋" }] });
    const out = parseRecognition(raw);
    expect(out).toEqual([{ name: "蛋", category: "蛋", confidence: 0 }]);
  });

  it("extracts JSON embedded in code fences", () => {
    const raw = "```json\n{\"items\":[{\"name\":\"牛奶\",\"category\":\"乳製品\"}]}\n```";
    expect(parseRecognition(raw)).toEqual([{ name: "牛奶", category: "乳製品", confidence: 0 }]);
  });

  it("clamps unknown category to 其他", () => {
    const raw = JSON.stringify({ items: [{ name: "泡麵", category: "零食", confidence: 0.5 }] });
    expect(parseRecognition(raw)).toEqual([{ name: "泡麵", category: "其他", confidence: 0.5 }]);
  });
});
