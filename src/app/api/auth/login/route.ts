// src/app/api/auth/login/route.ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolveLogin } from "@/lib/auth/authorize";
import { signSession } from "@/lib/auth/cookie";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const user = await resolveLogin(phone, db);
  if (!user) return Response.json({ error: "此電話未獲授權，請聯絡管理員" }, { status: 403 });
  const token = await signSession(user.id);
  const res = Response.json({ ok: true });
  res.headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 365}`,
  );
  return res;
}
