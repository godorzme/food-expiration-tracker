export type ExpiryState = "none" | "expired" | "urgent" | "soon" | "ok";

export function expiryState(expiresAt: Date | null, now: Date, leadDays: number): ExpiryState {
  if (!expiresAt) return "none";
  const ms = expiresAt.getTime() - now.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (ms < 0) return "expired";
  if (ms <= day) return "urgent";
  if (ms <= leadDays * day) return "soon";
  return "ok";
}
