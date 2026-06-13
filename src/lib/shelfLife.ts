import { db } from "@/lib/db";

export async function loadShelfLife(): Promise<Record<string, number>> {
  const rows = await db.shelfLife.findMany();
  return Object.fromEntries(rows.map((r) => [r.category, r.defaultDays]));
}
