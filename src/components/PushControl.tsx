"use client";
import { usePushSubscription } from "@/lib/push/usePushSubscription";

export function PushControl({ vapidPublicKey }: { vapidPublicKey: string }) {
  const { supported, subscribed, busy, error, enable } = usePushSubscription(vapidPublicKey);
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-[#3c4650]">🔔 手機推播通知</div>
          <div className="text-xs text-[#8a8178]">食物快過期時提醒你</div>
        </div>
        {!supported ? (
          <span className="flex-shrink-0 text-sm text-[#8a8178]">此裝置不支援</span>
        ) : subscribed ? (
          <span className="flex-shrink-0 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">✓ 已開啟</span>
        ) : (
          <button onClick={() => enable()} disabled={busy} className="flex-shrink-0 rounded-lg bg-[#5fbe91] px-4 py-2 text-sm font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50">
            {busy ? "開啟中…" : "開啟"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
