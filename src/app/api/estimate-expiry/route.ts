// src/app/api/estimate-expiry/route.ts
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { estimateDaysFromName } from "@/lib/expiryAI";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name : "";
  const method = typeof body?.method === "string" ? body.method : undefined;
  const { days, storage } = await estimateDaysFromName(name, method);
  return Response.json({ days, storage });
}
