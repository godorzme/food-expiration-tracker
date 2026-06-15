// src/proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/cookie";

// Paths that must stay reachable without a session.
const PUBLIC_PREFIXES = ["/login", "/api/auth/login", "/api/cron/remind"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  const ok = !!(await verifySession(token));
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Absolute URL (Next 16 rejects relative redirect Locations).
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|manifest.json|sw.js|icons/|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest)$).*)"],
};
