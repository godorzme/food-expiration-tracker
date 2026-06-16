export function defaultLocationId(locations: Array<{ id: string; [k: string]: unknown }>): string | null {
  return locations[0]?.id ?? null;
}

export function canDeleteLocation(activeItemCount: number): boolean {
  return activeItemCount === 0;
}

// Return the household's locations (ordered by creation), creating a default
// 「冰箱」 if there are none — so the app always has at least one to pick.
export async function ensureDefaultLocation(db: any, householdId: string) {
  const existing = await db.location.findMany({ where: { householdId }, orderBy: { createdAt: "asc" } });
  if (existing.length > 0) return existing;
  const created = await db.location.create({ data: { householdId, name: "冰箱" } });
  return [created];
}
