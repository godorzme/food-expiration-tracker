export interface MemberLike { id: string; displayName: string; pictureUrl?: string | null }

export function buildCreatorNameMap(members: MemberLike[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of members) map[m.id] = m.displayName;
  return map;
}

export function creatorNameFor(
  createdBy: string | null | undefined,
  map: Record<string, string>,
): string | null {
  if (!createdBy) return null;
  return map[createdBy] ?? null;
}

export function buildCreatorAvatarMap(members: MemberLike[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const m of members) map[m.id] = m.pictureUrl ?? null;
  return map;
}
