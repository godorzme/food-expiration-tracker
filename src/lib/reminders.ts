export function isDue(expiresAt: Date | null, now: Date, leadDays: number): boolean {
  if (!expiresAt) return false;
  const threshold = new Date(now.getTime() + leadDays * 24 * 60 * 60 * 1000);
  return expiresAt.getTime() <= threshold.getTime();
}

export function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
