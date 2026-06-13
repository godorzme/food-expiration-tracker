import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AddFoodForm } from "@/components/AddFoodForm";

export default async function AddPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-xl font-bold">新增食物</h1>
      <AddFoodForm />
    </main>
  );
}
