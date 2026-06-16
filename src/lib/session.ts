// src/lib/session.ts
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/cookie";
import { isAdminPhone } from "@/lib/auth/admin";

// Re-exported so existing imports (`@/lib/session`) keep working; the source of
// truth is the edge-safe cookie module.
export { SESSION_COOKIE };

export interface CurrentUser {
  id: string;
  householdId: string;
  phone: string | null;
  name: string;
  isAdmin: boolean;
  avatarUrl: string | null;
}

// Reads the signed session cookie and re-confirms the user still exists in the
// DB on every request — so deleting a user immediately revokes their access.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = await verifySession(token);
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    id: user.id,
    householdId: user.householdId,
    phone: user.phone,
    name: user.displayName,
    isAdmin: !!user.phone && isAdminPhone(user.phone),
    avatarUrl: user.pictureUrl,
  };
}
