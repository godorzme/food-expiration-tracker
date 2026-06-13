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
  return db.user.create({
    data: {
      lineUserId: profile.lineUserId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl ?? undefined,
      householdId: household.id,
    },
  });
}
