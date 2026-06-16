import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { FoodList } from "@/components/FoodList";
import { EnablePush } from "@/components/EnablePush";
import { LogoutButton } from "@/components/LogoutButton";
import { AppHeader } from "@/components/ui/AppHeader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const hh = await db.household.findUnique({ where: { id: user.householdId } });
  const today = new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4">
      <AppHeader
        title="冰箱清單"
        subtitle={`今天 ${today}`}
        actions={
          <>
            {user.isAdmin && <Link href="/admin" className="text-[#3e9e73]">⚙️ 管理</Link>}
            <LogoutButton />
          </>
        }
      />
      <EnablePush vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
      <div className="pb-28">
        <FoodList leadDays={hh?.reminderLeadDays ?? 2} />
      </div>
      <Link
        href="/add"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center justify-center bg-gradient-to-t from-[#fbf7f0] via-[#fbf7f0] to-transparent px-4 pt-6"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <span className="w-full rounded-xl bg-[#5fbe91] py-3 text-center text-base font-semibold text-white shadow-sm active:bg-[#3e9e73]">
          ＋ 新增食物
        </span>
      </Link>
    </main>
  );
}
