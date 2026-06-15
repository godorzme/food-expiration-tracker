// src/app/api/admin/users/[id]/route.ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

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
