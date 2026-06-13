import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { FoodList } from "@/components/FoodList";
import { EnablePush } from "@/components/EnablePush";

// Reads the household from the DB per request — never prerender at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  const hh = await db.household.findUnique({ where: { id: user.householdId } });
  return (
    <main className="mx-auto max-w-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">冰箱清單</h1>
        <Link href="/add" className="rounded bg-black px-3 py-1 text-white">
          ＋ 新增
        </Link>
      </div>
      {/* VAPID_PUBLIC_KEY is read here in a Server Component and passed as a prop,
          so it intentionally does NOT need a NEXT_PUBLIC_ prefix. */}
      <EnablePush vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
      <FoodList leadDays={hh?.reminderLeadDays ?? 2} />
    </main>
  );
}
