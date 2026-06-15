// src/app/api/admin/users/[id]/route.ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { normalizePhone } from "@/lib/auth/phone";
import { isAdminPhone } from "@/lib/auth/admin";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  if (id === admin.id) return Response.json({ error: "不能刪除自己（管理員）" }, { status: 400 });
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return Response.json({ error: "找不到此使用者" }, { status: 404 });
  // Remove their push subscriptions first (FK), then the user.
  await db.pushSubscription.deleteMany({ where: { userId: id } });
  await db.user.delete({ where: { id } });
  return Response.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return Response.json({ error: "找不到此使用者" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ error: "請填名字" }, { status: 400 });

  // The admin's own phone is the hardcoded identity — keep it locked.
  const targetIsAdmin = !!target.phone && isAdminPhone(target.phone);
  let phone = target.phone;
  if (!targetIsAdmin) {
    const np = normalizePhone(typeof body?.phone === "string" ? body.phone : "");
    if (!np) return Response.json({ error: "電話格式不正確" }, { status: 400 });
    if (isAdminPhone(np)) return Response.json({ error: "不能改成管理員號碼" }, { status: 400 });
    const dup = await db.user.findUnique({ where: { phone: np } });
    if (dup && dup.id !== id) return Response.json({ error: "此電話已在名單中" }, { status: 409 });
    phone = np;
  }
  const updated = await db.user.update({ where: { id }, data: { displayName: name, phone } });
  return Response.json({ id: updated.id, phone: updated.phone, name: updated.displayName });
}
