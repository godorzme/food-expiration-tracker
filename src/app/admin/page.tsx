import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AdminUsers } from "@/components/AdminUsers";
import { AppHeader } from "@/components/ui/AppHeader";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8">
      <AppHeader title="使用者管理" actions={<Link href="/" className="text-[#8a8178]">‹ 返回</Link>} />
      <Link href="/admin/locations" className="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
        <span className="font-semibold text-[#2d2a26]">📍 管理存放點</span>
        <span className="text-[#8a8178]">›</span>
      </Link>
      <AdminUsers />
    </main>
  );
}
