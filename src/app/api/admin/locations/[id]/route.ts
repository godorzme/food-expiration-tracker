// src/app/api/admin/locations/[id]/route.ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canDeleteLocation } from "@/lib/locations";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const loc = await db.location.findUnique({ where: { id } });
  if (!loc || loc.householdId !== admin.householdId) return Response.json({ error: "找不到存放點" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const data: { name?: string; photoId?: string | null } = {};
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return Response.json({ error: "請填存放點名稱" }, { status: 400 });
    const dup = await db.location.findFirst({ where: { householdId: admin.householdId, name, id: { not: id } } });
    if (dup) return Response.json({ error: "已有同名存放點" }, { status: 409 });
    data.name = name;
  }
  if ("photoId" in body) data.photoId = body.photoId ? String(body.photoId) : null;
  const updated = await db.location.update({ where: { id }, data });
  return Response.json({ id: updated.id, name: updated.name });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const loc = await db.location.findUnique({ where: { id } });
  if (!loc || loc.householdId !== admin.householdId) return Response.json({ error: "找不到存放點" }, { status: 404 });
  const activeCount = await db.foodItem.count({ where: { locationId: id, status: "active" } });
  if (!canDeleteLocation(activeCount))
    return Response.json({ error: "此存放點還有食物，請先清空或移動" }, { status: 409 });
  // Detach any non-active items (consumed/discarded) so the FK doesn't block delete.
  await db.foodItem.updateMany({ where: { locationId: id }, data: { locationId: null } });
  await db.location.delete({ where: { id } });
  return Response.json({ ok: true });
}
