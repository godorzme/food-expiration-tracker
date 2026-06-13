import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { FoodList } from "@/components/FoodList";
import { EnablePush } from "@/components/EnablePush";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const hh = await db.household.findUnique({ where: { id: user.householdId } });
  return (
    <main className="mx-auto max-w-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">冰箱清單</h1>
        <Link href="/add" className="rounded bg-black px-3 py-1 text-white">
          ＋ 新增
        </Link>
      </div>
      <EnablePush vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
      <FoodList leadDays={hh?.reminderLeadDays ?? 2} />
    </main>
  );
}
