import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">嗨 {user.name || "訪客"}</h1>
      <p className="text-gray-500">清單即將在 M2 完成。</p>
    </main>
  );
}
