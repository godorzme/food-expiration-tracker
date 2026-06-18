export function estimateExpiry(
  category: string,
  storedAt: Date,
  shelfLife: Record<string, number>,
): Date | null {
  const days = shelfLife[category];
  if (days == null) return null;
  return new Date(storedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}
