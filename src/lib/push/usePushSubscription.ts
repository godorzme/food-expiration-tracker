"use client";
import { useEffect, useState } from "react";

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export interface PushState {
  supported: boolean;
  subscribed: boolean;
  busy: boolean;
  error: string | null;
  enable: () => Promise<boolean>;
}

export function usePushSubscription(vapidPublicKey: string): PushState {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      typeof window !== "undefined" &&
      "PushManager" in window &&
      !!vapidPublicKey;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription();
        if (sub) setSubscribed(true);
      })
      .catch(() => {});
  }, [vapidPublicKey]);

  async function enable(): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      if (!vapidPublicKey) { setError("推播尚未設定"); return false; }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setError("此瀏覽器不支援推播"); return false; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setError("未授權通知"); return false; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setSubscribed(true);
      return true;
    } catch {
      setError("開啟推播失敗");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { supported, subscribed, busy, error, enable };
}
