import { describe, it, expect } from "vitest";
import { resolveLogin } from "./authorize";

function fakeDb(users: Array<{ id: string; phone: string; householdId: string; displayName: string }>) {
  return {
    user: {
      findUnique: async ({ where }: any) => users.find((u) => u.phone === where.phone) ?? null,
      create: async ({ data }: any) => { const u = { id: "u_admin", ...data }; users.push(u); return u; },
    },
    household: {
      findFirst: async () => ({ id: "hh_1", name: "家" }),
      create: async ({ data }: any) => ({ id: "hh_1", name: data.name }),
    },
  } as any;
}

describe("resolveLogin", () => {
  it("returns null for an unauthorized phone", async () => {
    const db = fakeDb([]);
    expect(await resolveLogin("0900000000", db)).toBeNull();
  });
  it("returns an allowlisted user", async () => {
    const db = fakeDb([{ id: "u1", phone: "0911222333", householdId: "hh_1", displayName: "媽" }]);
    const u = await resolveLogin("0911-222-333", db);
    expect(u?.id).toBe("u1");
  });
  it("get-or-creates the admin user for the admin phone", async () => {
    const db = fakeDb([]);
    const u = await resolveLogin("0926-571-988", db);
    expect(u?.phone).toBe("0926571988");
    expect(u?.householdId).toBe("hh_1");
  });
});
