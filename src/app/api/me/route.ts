// src/app/api/me/route.ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ id: user.id, name: user.name, phone: user.phone, isAdmin: user.isAdmin, avatarUrl: user.avatarUrl });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const photoId = typeof body?.photoId === "string" && body.photoId ? body.photoId : "";
  if (!photoId) return Response.json({ error: "缺少照片" }, { status: 400 });
  const updated = await db.user.update({ where: { id: user.id }, data: { pictureUrl: `/api/photo/${photoId}` } });
  return Response.json({ avatarUrl: updated.pictureUrl });
}
