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
