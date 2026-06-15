import { describe, it, expect, vi } from "vitest";
import { ensureUserAndHousehold } from "./household";
import { getSharedHousehold } from "./household";

function makeDb() {
  const state: any = { user: null };
  return {
    user: {
      findUnique: vi.fn(async () => state.user),
      create: vi.fn(async ({ data }: any) => (state.user = { id: "u1", ...data })),
    },
    household: {
      create: vi.fn(async ({ data }: any) => ({ id: "h1", ...data })),
    },
    _state: state,
  } as any;
}

describe("ensureUserAndHousehold", () => {
  it("creates household + user on first login", async () => {
    const db = makeDb();
    const user = await ensureUserAndHousehold(db, {
      lineUserId: "L1", displayName: "Robyn", pictureUrl: null,
    });
    expect(db.household.create).toHaveBeenCalledOnce();
    expect(db.user.create).toHaveBeenCalledOnce();
    expect(user.householdId).toBe("h1");
  });

  it("returns existing user without creating a household", async () => {
    const db = makeDb();
    db._state.user = { id: "u1", lineUserId: "L1", householdId: "h9" };
    const user = await ensureUserAndHousehold(db, {
      lineUserId: "L1", displayName: "Robyn", pictureUrl: null,
    });
    expect(db.household.create).not.toHaveBeenCalled();
    expect(user.householdId).toBe("h9");
  });

  it("handles first-login race: returns existing user when user.create throws P2002", async () => {
    const existingUser = { id: "u2", lineUserId: "L2", householdId: "h2" };
    // findUnique returns null on first call (before create), then the existing user on second call
    const findUnique = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingUser);
    const create = vi.fn().mockRejectedValueOnce({ code: "P2002" });
    const db = {
      user: { findUnique, create },
      household: { create: vi.fn(async ({ data }: any) => ({ id: "h2", ...data })) },
    } as any;

    const user = await ensureUserAndHousehold(db, {
      lineUserId: "L2", displayName: "Alice", pictureUrl: null,
    });
    expect(user).toBe(existingUser);
    expect(create).toHaveBeenCalledOnce();
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});

describe("getSharedHousehold", () => {
  it("returns the existing household when one exists", async () => {
    const db = {
      household: {
        findFirst: async () => ({ id: "hh_1", name: "家" }),
        create: async () => { throw new Error("should not create"); },
      },
    } as any;
    const hh = await getSharedHousehold(db);
    expect(hh.id).toBe("hh_1");
  });
  it("creates a household when none exists", async () => {
    let created = false;
    const db = {
      household: {
        findFirst: async () => null,
        create: async ({ data }: any) => { created = true; return { id: "hh_new", name: data.name }; },
      },
    } as any;
    const hh = await getSharedHousehold(db);
    expect(created).toBe(true);
    expect(hh.id).toBe("hh_new");
  });
});
