import { describe, it, expect, vi } from "vitest";
import { ensureUserAndHousehold } from "./household";

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
});
