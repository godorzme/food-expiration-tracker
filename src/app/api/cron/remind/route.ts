import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isDue, toDateOnly } from "@/lib/reminders";
import { pushLine } from "@/lib/linePush";
import { pushWeb } from "@/lib/webPush";

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: "forbidden" }, { status: 403 });

  const now = new Date();
  const today = toDateOnly(now);
  const households = await db.household.findMany({ include: { users: true } });
  let sent = 0;

  for (const hh of households) {
    const items = await db.foodItem.findMany({
      where: { householdId: hh.id, status: "active", expiresAt: { not: null } },
      orderBy: { expiresAt: "asc" },
    });
    const due = items.filter((it) => isDue(it.expiresAt, now, hh.reminderLeadDays));
    if (due.length === 0) continue;

    // dedup: only items not already reminded today (any channel)
    const fresh: typeof due = [];
    for (const it of due) {
      const already = await db.reminderLog.findFirst({ where: { foodItemId: it.id, remindedOn: today } });
      if (!already) fresh.push(it);
    }
    if (fresh.length === 0) continue;

    const lines = fresh.map((it) => {
      const exp = it.expiresAt!;
      const overdue = exp.getTime() < now.getTime();
      return `・${it.name}（${overdue ? "已過期" : "即將到期"} ${exp.toLocaleDateString("zh-TW")}）`;
    });
    const body = `冰箱有 ${fresh.length} 樣東西要注意:\n${lines.join("\n")}`;

    for (const u of hh.users) {
      const lineOk = await pushLine(u.lineUserId, body);
      const webOk = await pushWeb(u.id, { title: "冰箱提醒", body });
      for (const it of fresh) {
        if (lineOk) await db.reminderLog.create({ data: { foodItemId: it.id, remindedOn: today, channel: "line" } }).catch(() => {});
        if (webOk) await db.reminderLog.create({ data: { foodItemId: it.id, remindedOn: today, channel: "web" } }).catch(() => {});
      }
    }
    sent += fresh.length;
  }
  return Response.json({ ok: true, sent });
}
