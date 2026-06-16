// src/app/api/admin/locations/route.ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const photoId = typeof body?.photoId === "string" && body.photoId ? body.photoId : null;
  if (!name) return Response.json({ error: "請填存放點名稱" }, { status: 400 });
  const dup = await db.location.findFirst({ where: { householdId: admin.householdId, name } });
  if (dup) return Response.json({ error: "已有同名存放點" }, { status: 409 });
  const created = await db.location.create({ data: { householdId: admin.householdId, name, photoId } });
  return Response.json({ id: created.id, name: created.name });
}
