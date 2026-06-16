import { describe, it, expect } from "vitest";
import { initials } from "./avatar";

describe("initials", () => {
  it("takes the first character of a Chinese name", () => {
    expect(initials("媽媽")).toBe("媽");
    expect(initials("小明")).toBe("小");
  });
  it("takes the first letter of an English name", () => {
    expect(initials("Jason")).toBe("J");
  });
  it("trims whitespace", () => {
    expect(initials("  小華 ")).toBe("小");
  });
  it("returns ? for empty", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});
