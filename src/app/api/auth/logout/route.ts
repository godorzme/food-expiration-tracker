// src/app/api/auth/logout/route.ts
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append("set-cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
  return res;
}
