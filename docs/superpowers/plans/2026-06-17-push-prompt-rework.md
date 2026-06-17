# 推播提示改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除首頁頂部常駐推播連結；登入後跳出可關閉的推播提示（每裝置一次）；`/me` 加推播開關。

**Architecture:** 抽出 `usePushSubscription` hook 共用；新增 `PushPrompt`（首頁 modal）與 `PushControl`（/me 卡片）；移除舊 `EnablePush`。不改後端/schema，沿用 `/api/push/subscribe` + `public/sw.js` + VAPID。

**Tech Stack:** Next.js 16、Tailwind v4、vitest。

**Spec:** `docs/superpowers/specs/2026-06-17-push-prompt-rework-design.md`

**通則：** 每 Task 結束 `npx tsc --noEmit`（0）、`npx vitest run`（綠）、`npx next build`（成功）。commit body 末行 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`（heredoc）。配色：綠 `#5fbe91`/深 `#3e9e73`、灰 `#3c4650`/`#8a8178`、卡片 `rounded-2xl bg-white shadow-sm`。

---

### Task 1: `usePushSubscription` hook（+測試）

**Files:** Create `src/lib/push/usePushSubscription.ts`, `src/lib/push/usePushSubscription.test.ts`

- [ ] **Step 1: 寫失敗測試（純函式 urlBase64ToUint8Array）**
```ts
// src/lib/push/usePushSubscription.test.ts
import { describe, it, expect } from "vitest";
import { urlBase64ToUint8Array } from "./usePushSubscription";

describe("urlBase64ToUint8Array", () => {
  it("decodes standard base64 to bytes", () => {
    const out = urlBase64ToUint8Array("AAAA");
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out)).toEqual([0, 0, 0]);
  });
  it("handles base64url chars (- _) and missing padding", () => {
    // "-_-_" → "+/+/" → 3 bytes
    expect(urlBase64ToUint8Array("-_-_").length).toBe(3);
  });
  it("decodes a 65-byte P-256 VAPID public key", () => {
    const key = "BOXN0k7NX2cSeg07jE_gnooAHSUJAaIPUjjalsOb5KrkR_OpekmfccpGiQDoPRM3YnmWC94Hb3SbZLAI031xWrs";
    expect(urlBase64ToUint8Array(key).length).toBe(65);
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/push/usePushSubscription.test.ts`
Expected: FAIL（找不到模組）

- [ ] **Step 3: 實作 hook**
```ts
// src/lib/push/usePushSubscription.ts
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
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/push/usePushSubscription.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**
```bash
git add src/lib/push/usePushSubscription.ts src/lib/push/usePushSubscription.test.ts
git commit -m "feat(push): usePushSubscription hook (extracted from EnablePush) + tests"
```

---

### Task 2: PushPrompt + PushControl 元件

**Files:** Create `src/components/PushPrompt.tsx`, `src/components/PushControl.tsx`

- [ ] **Step 1: PushPrompt（首頁登入後 modal）**
```tsx
// src/components/PushPrompt.tsx
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
```

- [ ] **Step 2: PushControl（/me 卡片）**
```tsx
// src/components/PushControl.tsx
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
```

- [ ] **Step 3: tsc + build**

Run: `npx tsc --noEmit && npx next build`
Expected: 0 錯/成功。

- [ ] **Step 4: Commit**
```bash
git add src/components/PushPrompt.tsx src/components/PushControl.tsx
git commit -m "feat(push): PushPrompt modal + PushControl card components"
```

---

### Task 3: 接線 — 首頁換成 PushPrompt、/me 加 PushControl、刪 EnablePush

**Files:** Modify `src/app/page.tsx`, `src/app/me/page.tsx`; Delete `src/components/EnablePush.tsx`

- [ ] **Step 1: 首頁 `src/app/page.tsx`**

把 import：
```tsx
import { EnablePush } from "@/components/EnablePush";
```
改為：
```tsx
import { PushPrompt } from "@/components/PushPrompt";
```
把 JSX：
```tsx
      <EnablePush vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
```
改為：
```tsx
      <PushPrompt vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
```
（`PushPrompt` 平常 render null，不佔版面；保留把 `VAPID_PUBLIC_KEY` 當 prop 傳入。）

- [ ] **Step 2: `/me` 頁 `src/app/me/page.tsx` 加 PushControl**

import 加：
```tsx
import { PushControl } from "@/components/PushControl";
```
把 `<MyProfile ... />` 那行用一個 gap 容器包起來並加 PushControl：
```tsx
      <div className="flex flex-col gap-4">
        <MyProfile name={user.name} phone={user.phone} initialAvatar={user.avatarUrl} />
        <PushControl vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
      </div>
```

- [ ] **Step 3: 刪除舊元件**
```bash
git rm src/components/EnablePush.tsx
```

- [ ] **Step 4: 確認沒有殘留引用**

Run: `grep -rn "EnablePush" src/ || echo "no EnablePush refs"`
Expected: `no EnablePush refs`

- [ ] **Step 5: tsc + vitest + build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: 全綠/成功。

- [ ] **Step 6: Commit**
```bash
git add src/app/page.tsx src/app/me/page.tsx
git commit -m "feat(push): post-login prompt on home + push control on /me; remove top EnablePush"
```

---

## 部署（實作 + 本機驗證全綠、合併 main 後）

1. 合併 main（無 schema 變更）。
2. `npx zeabur@latest service redeploy --id 6a2d5ceed131a64afc9f3e19 -y -i=false` → 等 RUNNING。
3. **真機 QA**：
   - 首頁頂部不再有常駐「開啟手機推播」連結。
   - 登入後（未訂閱、未關過）跳出推播提示 modal；按「開啟通知」可授權並訂閱（成功後消失）；按「以後再說」消失、重整不再彈。
   - `/me` 有「🔔 手機推播通知」卡，未開顯示「開啟」、已開顯示「✓ 已開啟」、不支援顯示「此裝置不支援」。

---

## Self-Review 註記

- **Spec coverage**：hook 抽出(T1)、PushPrompt + PushControl(T2)、首頁換 PushPrompt + /me 加 PushControl + 刪 EnablePush(T3)、部署/QA。皆涵蓋。
- **不改後端/schema**：沿用 `/api/push/subscribe`、`sw.js`、VAPID env；只動前端呈現位置。
- **Placeholder scan**：無 TBD；新檔完整、既有檔精確 edit。
- **一致性**：`usePushSubscription` 回傳 `{supported,subscribed,busy,error,enable}` 與 PushPrompt/PushControl 用法一致；`enable()` 回 boolean 供 prompt 成功後關閉；dismiss 用 localStorage `push-prompt-dismissed`。
- **雷**：PushPrompt 必須平常 render null（不佔版面）；`localStorage` 存取包 try/catch（隱私模式）；hook 標 `"use client"`。
