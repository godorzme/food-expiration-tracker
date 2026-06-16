import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <div className="mb-3 text-5xl">🍱</div>
        <h1 className="text-2xl font-bold text-[#2d2a26]">食物存放清單</h1>
        <p className="mt-1 text-sm text-[#8a8178]">請用電話登入</p>
      </div>
      <LoginForm />
    </main>
  );
}
