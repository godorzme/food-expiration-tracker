import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">冰箱食物追蹤</h1>
      <p className="text-gray-500">用 LINE 登入，和家人共用同一份清單</p>
      <form
        action={async () => {
          "use server";
          await signIn("line", { redirectTo: "/" });
        }}
      >
        <button className="rounded-lg bg-[#06C755] px-6 py-3 font-semibold text-white">
          使用 LINE 登入
        </button>
      </form>
    </main>
  );
}
