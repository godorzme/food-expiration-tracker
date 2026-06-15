// src/lib/auth/authorize.ts
import { normalizePhone } from "./phone";
import { isAdminPhone } from "./admin";
import { getSharedHousehold } from "../household";

export interface AuthUser { id: string; phone: string | null; householdId: string; displayName: string }

type AuthorizeDb = {
  user: {
    findUnique: (args: { where: { phone: string } }) => Promise<AuthUser | null>;
    create: (args: { data: { phone: string; displayName: string; householdId: string } }) => Promise<AuthUser>;
  };
  household: Parameters<typeof getSharedHousehold>[0]["household"] extends never ? never : any;
};

// Decide whether a phone may log in, and return the corresponding user.
// - admin phone: get-or-create the admin user (so the admin works on a fresh DB)
// - allowlisted phone: return that user
// - anything else: null (unauthorized)
export async function resolveLogin(rawPhone: string, db: any): Promise<AuthUser | null> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) return existing;
  if (isAdminPhone(phone)) {
    const hh = await getSharedHousehold(db);
    return db.user.create({ data: { phone, displayName: "管理員", householdId: hh.id } });
  }
  return null;
}
