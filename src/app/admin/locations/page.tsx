import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AdminLocations } from "@/components/AdminLocations";
import { AppHeader } from "@/components/ui/AppHeader";

export const dynamic = "force-dynamic";

export default async function AdminLocationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8">
      <AppHeader title="存放點管理" actions={<Link href="/admin" className="text-[#8a8178]">‹ 返回</Link>} />
      <AdminLocations />
    </main>
  );
}
