import { describe, it, expect } from "vitest";
import { defaultLocationId, canDeleteLocation, ensureDefaultLocation } from "./locations";

describe("defaultLocationId", () => {
  it("returns the first location id", () => {
    expect(defaultLocationId([{ id: "a", name: "冰箱" }, { id: "b", name: "冷凍" }])).toBe("a");
  });
  it("returns null for empty", () => {
    expect(defaultLocationId([])).toBeNull();
  });
});

describe("canDeleteLocation", () => {
  it("allows delete only when no active items", () => {
    expect(canDeleteLocation(0)).toBe(true);
    expect(canDeleteLocation(3)).toBe(false);
  });
});

describe("ensureDefaultLocation", () => {
  it("returns existing locations without creating", async () => {
    const db = {
      location: {
        findMany: async () => [{ id: "x", name: "冰箱" }],
        create: async () => { throw new Error("should not create"); },
      },
    } as any;
    const locs = await ensureDefaultLocation(db, "hh1");
    expect(locs.map((l: { id: string }) => l.id)).toEqual(["x"]);
  });
  it("creates 冰箱 when none exist", async () => {
    let created = false;
    const db = {
      location: {
        findMany: async () => [],
        create: async ({ data }: any) => { created = true; return { id: "new", name: data.name }; },
      },
    } as any;
    const locs = await ensureDefaultLocation(db, "hh1");
    expect(created).toBe(true);
    expect(locs[0].name).toBe("冰箱");
  });
});
