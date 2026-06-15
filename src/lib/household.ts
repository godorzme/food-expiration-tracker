import type { PrismaClient } from "@prisma/client";

export interface LineProfile {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
}

type DbLike = Pick<PrismaClient, "user" | "household">;

export async function ensureUserAndHousehold(db: DbLike, profile: LineProfile) {
  const existing = await db.user.findUnique({ where: { lineUserId: profile.lineUserId } });
  if (existing) return existing;

  const household = await db.household.create({ data: { name: `${profile.displayName} 的家` } });

  try {
    return await db.user.create({
      data: {
        lineUserId: profile.lineUserId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl ?? undefined,
        householdId: household.id,
      },
    });
  } catch (err: unknown) {
    // Two concurrent first-logins can both pass the findUnique check above.
    // If this request lost the race, Prisma raises P2002 (unique constraint on lineUserId).
    // Re-fetch and return the user that the winning request created.
    if (
      err !== null &&
      typeof err === "object" &&
      (err as Record<string, unknown>).code === "P2002"
    ) {
      const raceWinner = await db.user.findUnique({ where: { lineUserId: profile.lineUserId } });
      if (raceWinner) return raceWinner;
    }
    throw err;
  }
}

type HouseholdDb = { household: { findFirst: (args?: unknown) => Promise<{ id: string; name: string } | null>; create: (args: { data: { name: string } }) => Promise<{ id: string; name: string }> } };

// The app uses a single shared household for everyone. Return the existing one,
// or create it on first use. Created lazily so a fresh DB still works.
export async function getSharedHousehold(db: HouseholdDb): Promise<{ id: string; name: string }> {
  const existing = await db.household.findFirst();
  if (existing) return existing;
  return db.household.create({ data: { name: "我家的冰箱" } });
}
