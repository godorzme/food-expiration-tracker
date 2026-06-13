import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

const VALID_STATUSES = new Set(["active", "consumed", "discarded", "expired"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await db.foodItem.findUnique({ where: { id } });
  if (!existing || existing.householdId !== user.householdId)
    return Response.json({ error: "not found" }, { status: 404 });

  const body = await req.json();

  if ("status" in body && !VALID_STATUSES.has(body.status))
    return Response.json({ error: "invalid status" }, { status: 400 });

  const data: Record<string, unknown> = {};
  for (const f of ["name", "category", "notes", "status"]) if (f in body) data[f] = body[f];
  if ("storedAt" in body) data.storedAt = new Date(body.storedAt);
  if ("expiresAt" in body) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  const updated = await db.foodItem.update({ where: { id }, data });
  return Response.json({ updated });
}
