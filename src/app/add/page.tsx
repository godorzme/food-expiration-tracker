import { AddFoodForm } from "@/components/AddFoodForm";

export default function AddPage() {
  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-xl font-bold">新增食物</h1>
      <AddFoodForm />
    </main>
  );
}
