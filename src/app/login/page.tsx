// src/app/login/page.tsx
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center p-6">
      <h1 className="mb-2 text-2xl font-bold">冰箱食物追蹤</h1>
      <p className="mb-6 text-sm text-gray-500">請用電話登入</p>
      <LoginForm />
    </main>
  );
}
