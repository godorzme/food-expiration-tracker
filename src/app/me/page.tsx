import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { MyProfile } from "@/components/MyProfile";
import { AppHeader } from "@/components/ui/AppHeader";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8">
      <AppHeader title="我的" actions={<Link href="/" className="text-[#8a8178]">‹ 返回</Link>} />
      <MyProfile name={user.name} phone={user.phone} initialAvatar={user.avatarUrl} />
    </main>
  );
}
