import { describe, it, expect } from "vitest";
import { buildCreatorNameMap, creatorNameFor } from "./foodView";

describe("creator name mapping", () => {
  const members = [
    { id: "u1", displayName: "媽" },
    { id: "u2", displayName: "老公" },
  ];
  it("builds an id→name map", () => {
    expect(buildCreatorNameMap(members)).toEqual({ u1: "媽", u2: "老公" });
  });
  it("resolves a known creator", () => {
    expect(creatorNameFor("u1", buildCreatorNameMap(members))).toBe("媽");
  });
  it("returns null for unknown / missing creator", () => {
    const map = buildCreatorNameMap(members);
    expect(creatorNameFor("gone", map)).toBeNull();
    expect(creatorNameFor(null, map)).toBeNull();
    expect(creatorNameFor(undefined, map)).toBeNull();
  });
});
