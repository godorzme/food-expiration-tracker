import { db } from "@/lib/db";
import { ensureUserAndHousehold } from "@/lib/household";

export interface CurrentUser {
  id: string;
  householdId: string;
  lineUserId: string;
  name: string;
}

// Login is disabled for now — everyone who opens the app shares a single local
// household/user. Kept as a get-or-create so re-adding real auth later is a small change.
const LOCAL_PROFILE = { lineUserId: "local-default", displayName: "我", pictureUrl: null };

export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await ensureUserAndHousehold(db, LOCAL_PROFILE);
  return {
    id: user.id,
    householdId: user.householdId,
    lineUserId: user.lineUserId,
    name: user.displayName,
  };
}
