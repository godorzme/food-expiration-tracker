import * as webpush from "web-push";
import { db } from "@/lib/db";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export async function pushWeb(userId: string, payload: { title: string; body: string }): Promise<boolean> {
  // Require all three VAPID vars: setVapidDetails throws on a missing subject/public
  // key, and that call sits outside the per-subscription try/catch below.
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_SUBJECT) return false;
  configure();
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let anyOk = false;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      anyOk = true;
    } catch (err: unknown) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        await db.pushSubscription.delete({ where: { id: s.id } }); // prune dead endpoints
      }
    }
  }
  return anyOk;
}
