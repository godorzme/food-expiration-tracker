// src/app/api/shelf-life/route.ts
import { getCurrentUser } from "@/lib/session";
import { loadShelfLife } from "@/lib/shelfLife";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ shelfLife: await loadShelfLife() });
}
