import { auth } from "@/lib/auth";

export interface CurrentUser {
  id: string;
  householdId: string;
  lineUserId: string;
  name: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.householdId) return null;
  return {
    id: u.id,
    householdId: u.householdId,
    lineUserId: u.lineUserId,
    name: u.name ?? "",
  };
}
