import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { putPhoto } from "@/lib/storage";
import { resolveCapturedAt } from "@/lib/exif";
import { recognizeFood } from "@/lib/aiVision";
import { loadShelfLife } from "@/lib/shelfLife";
import { estimateDaysFromName } from "@/lib/expiryAI";

/** Replace characters outside [A-Za-z0-9._-] with underscores to keep R2 keys safe. */
function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_");
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "no file" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploadTime = new Date();
  const capturedAt = await resolveCapturedAt(bytes, uploadTime);

  const safeName = sanitizeFilename(file.name) || "upload";
  const key = `${user.householdId}/${uploadTime.getTime()}-${safeName}`;
  await putPhoto(key, bytes, file.type || "image/jpeg");

  const photo = await db.photo.create({
    data: { objectKey: key, capturedAt, uploadedBy: user.id },
  });
  const recognized = await recognizeFood(bytes, file.type || "image/jpeg");
  const top = recognized[0] ?? null;
  let item: { name: string; category: string; days: number | null } | null = null;
  if (top) {
    let days = await estimateDaysFromName(top.name);
    if (days == null) {
      const shelf = await loadShelfLife();
      days = shelf[top.category] ?? null;
    }
    item = { name: top.name, category: top.category, days };
  }
  return Response.json({ photoId: photo.id, capturedAt: capturedAt.toISOString(), item });
}
