import Link from "next/link";
import { AddFoodForm } from "@/components/AddFoodForm";
import { AppHeader } from "@/components/ui/AppHeader";

export default function AddPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8">
      <AppHeader title="新增食物" actions={<Link href="/" className="text-[#8a8178]">‹ 返回</Link>} />
      <AddFoodForm />
    </main>
  );
}
