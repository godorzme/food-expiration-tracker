import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { resolveExpiresAt } from "@/lib/food";
import { loadShelfLife } from "@/lib/shelfLife";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const items = await db.foodItem.findMany({
    where: { householdId: user.householdId, status: "active" },
    orderBy: [{ expiresAt: "asc" }],
    include: { photo: true },
  });
  return Response.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  // body.items: [{ name, category, storedAt, expiresAt|null, photoId|null, notes?, isRecognized? }]
  if (!Array.isArray(body?.items) || body.items.length === 0)
    return Response.json({ error: "no items" }, { status: 400 });

  // Validate each item up front so a bad/missing storedAt or name can't write a
  // garbage row or blow up mid-transaction with a cryptic 500.
  const items = body.items as Array<Record<string, unknown>>;
  for (const it of items) {
    if (typeof it.name !== "string" || !it.name.trim())
      return Response.json({ error: "item name required" }, { status: 400 });
    if (typeof it.category !== "string" || !it.category.trim())
      return Response.json({ error: "item category required" }, { status: 400 });
    if (!it.storedAt || Number.isNaN(new Date(it.storedAt as string).getTime()))
      return Response.json({ error: "invalid storedAt" }, { status: 400 });
    if (it.expiresAt && Number.isNaN(new Date(it.expiresAt as string).getTime()))
      return Response.json({ error: "invalid expiresAt" }, { status: 400 });
  }

  const shelf = await loadShelfLife();
  const created = await db.$transaction(
    items.map((it) => {
      const storedAt = new Date(it.storedAt as string);
      const expiresAt = resolveExpiresAt(
        {
          category: it.category as string,
          storedAt,
          manualExpiresAt: it.expiresAt ? new Date(it.expiresAt as string) : null,
        },
        shelf,
      );
      return db.foodItem.create({
        data: {
          householdId: user.householdId,
          photoId: (it.photoId as string) ?? null,
          name: it.name as string,
          category: it.category as string,
          storedAt,
          expiresAt,
          notes: (it.notes as string) ?? null,
          isRecognized: !!it.isRecognized,
          createdBy: user.id,
        },
      });
    }),
  );
  return Response.json({ created });
}
