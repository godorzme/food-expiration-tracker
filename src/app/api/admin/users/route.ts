// src/app/api/admin/users/route.ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { normalizePhone } from "@/lib/auth/phone";
import { isAdminPhone } from "@/lib/auth/admin";
import { getSharedHousehold } from "@/lib/household";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  return Response.json({
    users: users.map((u) => ({ id: u.id, phone: u.phone, name: u.displayName, avatarUrl: u.pictureUrl, createdAt: u.createdAt, isAdmin: !!u.phone && isAdminPhone(u.phone) })),
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(typeof body?.phone === "string" ? body.phone : "");
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!phone) return Response.json({ error: "電話格式不正確" }, { status: 400 });
  if (!name) return Response.json({ error: "請填名字" }, { status: 400 });
  if (isAdminPhone(phone)) return Response.json({ error: "管理員帳號已存在，無需新增" }, { status: 400 });
  const dup = await db.user.findUnique({ where: { phone } });
  if (dup) return Response.json({ error: "此電話已在名單中" }, { status: 409 });
  const hh = await getSharedHousehold(db as any);
  const created = await db.user.create({ data: { phone, displayName: name, householdId: hh.id } });
  return Response.json({ id: created.id, phone: created.phone, name: created.displayName, createdAt: created.createdAt });
}
