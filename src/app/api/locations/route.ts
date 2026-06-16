// src/app/api/locations/route.ts
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ensureDefaultLocation } from "@/lib/locations";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const locations = await ensureDefaultLocation(db, user.householdId);
  const result = await Promise.all(
    locations.map(async (loc: { id: string; name: string; photoId: string | null }) => ({
      id: loc.id,
      name: loc.name,
      photoUrl: loc.photoId ? `/api/photo/${loc.photoId}` : null,
      itemCount: await db.foodItem.count({ where: { locationId: loc.id, status: "active" } }),
    })),
  );
  return Response.json({ locations: result });
}
