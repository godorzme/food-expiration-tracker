"use client";
import { useEffect, useState } from "react";
import { usePushSubscription } from "@/lib/push/usePushSubscription";

const DISMISS_KEY = "push-prompt-dismissed";

export function PushPrompt({ vapidPublicKey }: { vapidPublicKey: string }) {
  const { supported, subscribed, busy, error, enable } = usePushSubscription(vapidPublicKey);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!supported || subscribed) { setOpen(false); return; }
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch {}
    if (!dismissed) setOpen(true);
  }, [supported, subscribed]);

  if (!open) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setOpen(false);
  }
  async function onEnable() {
    const ok = await enable();
    if (ok) setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={dismiss}>
      <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 text-3xl">🔔</div>
        <h2 className="mb-1 font-bold text-[#3c4650]">開啟手機推播？</h2>
        <p className="mb-4 text-sm text-[#8a8178]">食物快過期時主動提醒你，不錯過。</p>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <button onClick={onEnable} disabled={busy} className="mb-2 w-full rounded-xl bg-[#5fbe91] py-3 font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50">
          {busy ? "開啟中…" : "開啟通知"}
        </button>
        <button onClick={dismiss} className="w-full py-2 text-sm text-[#8a8178]">以後再說</button>
      </div>
    </div>
  );
}
