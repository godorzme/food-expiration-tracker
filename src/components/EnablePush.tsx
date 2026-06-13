"use client";
import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function EnablePush({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reflect an already-active subscription so the label isn't stuck on "開啟" after opting in.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription();
        if (sub) setDone(true);
      })
      .catch(() => {});
  }, []);

  async function enable() {
    setError(null);
    try {
      if (!vapidPublicKey) { setError("推播尚未設定"); return; }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setError("此瀏覽器不支援推播"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setError("未授權通知"); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setDone(true);
    } catch {
      setError("開啟推播失敗");
    }
  }
  return (
    <div>
      <button className="text-sm text-blue-600 underline" onClick={enable}>{done ? "已開啟手機推播" : "開啟手機推播"}</button>
      {error && <span className="ml-2 text-sm text-red-600">{error}</span>}
    </div>
  );
}
