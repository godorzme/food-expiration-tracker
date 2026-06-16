"use client";
import { useState } from "react";

export function LoginForm() {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "登入失敗");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("網路錯誤，請重試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="例：0912-345-678"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-center text-lg outline-none focus:border-[#5fbe91]"
        required
      />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-[#5fbe91] px-4 py-3 text-base font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50"
      >
        {loading ? "登入中…" : "登入"}
      </button>
    </form>
  );
}
