import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getPhotoBytes } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const photo = await db.photo.findUnique({ where: { id } });
  if (!photo) return Response.json({ error: "not found" }, { status: 404 });
  const { body, contentType } = await getPhotoBytes(photo.objectKey);
  return new Response(new Uint8Array(body), {
    headers: { "content-type": contentType, "cache-control": "private, max-age=3600" },
  });
}
