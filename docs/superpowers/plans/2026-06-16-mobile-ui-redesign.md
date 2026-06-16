# 手機優先視覺改版（溫暖卡片風） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把四個畫面（login/home/add/admin）改成溫暖卡片風、手機優先的一致設計，純呈現層、不動邏輯。

**Architecture:** 在 `globals.css` 定 design tokens、`layout.tsx` 載 Noto Sans TC + viewport cover；新增兩個純呈現共用元件 `StatusPill`、`AppHeader`；其餘畫面以 className 重塑。所有資料流/ API / 邏輯不變。

**Tech Stack:** Next.js 16 App Router、Tailwind v4、next/font（Noto Sans TC）、vitest。

**Spec:** `docs/superpowers/specs/2026-06-16-mobile-ui-redesign-design.md`

**通則（每個畫面都遵守）：**
- 手機優先、單欄、容器 `mx-auto max-w-md`、左右 `px-4`。
- 觸控目標 ≥ 44px（按鈕 `py-3` 起跳）。
- 卡片：`rounded-2xl bg-white shadow-sm`；主按鈕：`bg-[#5FBE91] text-white rounded-xl py-3 font-semibold active:bg-[#3E9E73] disabled:opacity-50`。
- 不改任何 `fetch`/狀態邏輯/props 介面（除非該 Task 明說）。
- 每個 Task 結束跑：`npx tsc --noEmit`（0 錯）、`npx vitest run`（維持綠）、`npx next build`（成功）。
- 每個 commit body 末行加：`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`（用 heredoc）。

---

### Task 1: 設計基底 — globals.css + layout.tsx（字體/底色/安全區）

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 全檔替換 `src/app/globals.css`**

```css
@import "tailwindcss";

:root {
  --bg: #fbf7f0;       /* 奶油白背景 */
  --card: #ffffff;
  --brand: #5fbe91;    /* 租寓綠 */
  --brand-ink: #3e9e73;
  --ink: #2d2a26;      /* 主文字 */
  --muted: #8a8178;    /* 次要文字 */
}

@theme inline {
  --color-background: var(--bg);
  --color-foreground: var(--ink);
  --font-sans: var(--font-noto-tc), system-ui, sans-serif;
}

html {
  background: var(--bg);
}

body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-noto-tc), system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
```
（移除了原本的 dark-mode 覆寫與 Geist/Arial。）

- [ ] **Step 2: 全檔替換 `src/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const notoTC = Noto_Sans_TC({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-noto-tc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "冰箱食物追蹤",
  description: "追蹤冰箱食物與到期日",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbf7f0",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" className={`${notoTC.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: build 驗證（字體載入是雷點）**

Run: `npx next build`
Expected: 成功。**若 build 因 `subsets: ["latin"]` 對 Noto Sans TC 報錯**，改成移除 `subsets` 並加 `preload: false`：`Noto_Sans_TC({ weight: ["400","500","700"], variable: "--font-noto-tc", display: "swap", preload: false })`，再 build 一次直到成功。

- [ ] **Step 4: Commit**
```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(ui): warm-card design tokens + Noto Sans TC + safe-area viewport"
```

---

### Task 2: 共用元件 StatusPill（+測試）與 AppHeader

**Files:**
- Create: `src/components/ui/StatusPill.tsx`
- Test: `src/components/ui/StatusPill.test.ts`
- Create: `src/components/ui/AppHeader.tsx`

- [ ] **Step 1: 寫失敗測試（純對照邏輯）**

```ts
// src/components/ui/StatusPill.test.ts
import { describe, it, expect } from "vitest";
import { statusMeta } from "./StatusPill";

describe("statusMeta", () => {
  it("maps each expiry state to a label + edge color", () => {
    expect(statusMeta("expired").label).toBe("已過期");
    expect(statusMeta("urgent").label).toBe("今明到期");
    expect(statusMeta("soon").label).toBe("接近到期");
    expect(statusMeta("ok").label).toBe("充足");
    expect(statusMeta("none").label).toBe("無到期日");
  });
  it("every state has a non-empty edge color", () => {
    for (const s of ["expired", "urgent", "soon", "ok", "none"] as const) {
      expect(statusMeta(s).edge).toMatch(/^#/);
    }
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/components/ui/StatusPill.test.ts`
Expected: FAIL（找不到模組）

- [ ] **Step 3: 實作 StatusPill**

```tsx
// src/components/ui/StatusPill.tsx
import type { ExpiryState } from "@/lib/expiryState";

interface Meta { label: string; emoji: string; pill: string; edge: string }

const META: Record<ExpiryState, Meta> = {
  expired: { label: "已過期", emoji: "🔴", pill: "bg-red-50 text-red-700", edge: "#e5484d" },
  urgent:  { label: "今明到期", emoji: "🟠", pill: "bg-orange-50 text-orange-700", edge: "#f5821f" },
  soon:    { label: "接近到期", emoji: "🟡", pill: "bg-yellow-50 text-yellow-700", edge: "#e5b72a" },
  ok:      { label: "充足", emoji: "🟢", pill: "bg-green-50 text-green-700", edge: "#5fbe91" },
  none:    { label: "無到期日", emoji: "⚪", pill: "bg-gray-100 text-gray-500", edge: "#b8b2a8" },
};

export function statusMeta(state: ExpiryState): Meta {
  return META[state];
}

export function StatusPill({ state }: { state: ExpiryState }) {
  const m = META[state];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.pill}`}>
      {m.emoji} {m.label}
    </span>
  );
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/components/ui/StatusPill.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: 實作 AppHeader（純呈現）**

```tsx
// src/components/ui/AppHeader.tsx
import type { ReactNode } from "react";

export function AppHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header
      className="sticky top-0 z-10 -mx-4 mb-3 border-b border-black/5 bg-[#fbf7f0]/90 px-4 py-3 backdrop-blur"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="mx-auto flex max-w-md items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#2d2a26]">{title}</h1>
          {subtitle && <p className="text-xs text-[#8a8178]">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3 text-sm">{actions}</div>}
      </div>
    </header>
  );
}
```

- [ ] **Step 6: tsc + Commit**

Run: `npx tsc --noEmit` → 0 errors
```bash
git add src/components/ui/StatusPill.tsx src/components/ui/StatusPill.test.ts src/components/ui/AppHeader.tsx
git commit -m "feat(ui): StatusPill + AppHeader shared components"
```

---

### Task 3: 首頁 + FoodList 改版（主畫面）

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/FoodList.tsx`

- [ ] **Step 1: 全檔替換 `src/app/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { FoodList } from "@/components/FoodList";
import { EnablePush } from "@/components/EnablePush";
import { LogoutButton } from "@/components/LogoutButton";
import { AppHeader } from "@/components/ui/AppHeader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const hh = await db.household.findUnique({ where: { id: user.householdId } });
  const today = new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "short" }).format(new Date());
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4">
      <AppHeader
        title="冰箱清單"
        subtitle={`今天 ${today}`}
        actions={
          <>
            {user.isAdmin && <Link href="/admin" className="text-[#3e9e73]">⚙️ 管理</Link>}
            <LogoutButton />
          </>
        }
      />
      <EnablePush vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
      <div className="pb-28">
        <FoodList leadDays={hh?.reminderLeadDays ?? 2} />
      </div>
      <Link
        href="/add"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center justify-center bg-gradient-to-t from-[#fbf7f0] via-[#fbf7f0] to-transparent px-4 pt-6"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <span className="w-full rounded-xl bg-[#5fbe91] py-3 text-center text-base font-semibold text-white shadow-sm active:bg-[#3e9e73]">
          ＋ 新增食物
        </span>
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: 全檔替換 `src/components/FoodList.tsx`**（保留所有邏輯，只重塑樣式 + 用 StatusPill）

```tsx
"use client";
import { useEffect, useState } from "react";
import { expiryState } from "@/lib/expiryState";
import { StatusPill, statusMeta } from "@/components/ui/StatusPill";
import { PhotoLightbox } from "@/components/PhotoLightbox";

interface FoodItemDTO {
  id: string;
  name: string;
  category: string;
  storedAt: string;
  expiresAt: string | null;
  photoUrl?: string | null;
  createdByName?: string | null;
}

export function FoodList({ leadDays }: { leadDays: number }) {
  const [items, setItems] = useState<FoodItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const now = useState(() => new Date())[0];
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  async function load() {
    setError(false);
    try {
      const res = await fetch("/api/food");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data: { items?: FoodItemDTO[] } = await res.json();
      setItems(data.items ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function mark(id: string, status: string) {
    try {
      const res = await fetch(`/api/food/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await load();
    } catch {
      setError(true);
    }
  }

  if (loading) return <p className="py-8 text-center text-sm text-[#8a8178]">載入中…</p>;
  if (error)
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="mb-3 text-sm text-red-600">載入失敗</p>
        <button onClick={() => load()} className="rounded-xl bg-[#5fbe91] px-4 py-2 text-sm font-semibold text-white">重新整理</button>
      </div>
    );
  if (items.length === 0)
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="mb-2 text-4xl">🧊</div>
        <p className="text-sm text-[#8a8178]">冰箱是空的，點下方「＋ 新增食物」記錄第一樣吧。</p>
      </div>
    );

  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((it) => {
          const exp = it.expiresAt ? new Date(it.expiresAt) : null;
          const state = expiryState(exp, now, leadDays);
          const edge = statusMeta(state).edge;
          return (
            <li
              key={it.id}
              className="flex items-center gap-3 overflow-hidden rounded-2xl bg-white p-3 shadow-sm"
              style={{ borderLeft: `4px solid ${edge}` }}
            >
              {it.photoUrl ? (
                <img
                  src={it.photoUrl}
                  alt={it.name}
                  loading="lazy"
                  onClick={() => setLightbox({ src: it.photoUrl as string, alt: it.name })}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  className="h-16 w-16 flex-shrink-0 cursor-pointer rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-[#f1ece3] text-2xl">🍽️</div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-[#2d2a26]">{it.name}</span>
                  <StatusPill state={state} />
                </div>
                <div className="truncate text-xs text-[#8a8178]">
                  {it.category}
                  {it.createdByName ? ` · ${it.createdByName} 加的` : ""}
                  {exp ? ` · 到期 ${exp.toLocaleDateString("zh-TW")}` : ""}
                </div>
                <div className="mt-1 flex gap-2">
                  <button onClick={() => mark(it.id, "consumed")} className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">✓ 吃掉</button>
                  <button onClick={() => mark(it.id, "discarded")} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">🗑 丟掉</button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {lightbox && <PhotoLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </>
  );
}
```

- [ ] **Step 3: tsc + vitest + build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: tsc 0；vitest 綠；build 成功。

- [ ] **Step 4: Commit**
```bash
git add src/app/page.tsx src/components/FoodList.tsx
git commit -m "feat(ui): warm-card home + food list (thumbnail, status pill, sticky add)"
```

---

### Task 4: 新增頁 + AddFoodForm 改版

**Files:**
- Modify: `src/app/add/page.tsx`
- Modify: `src/components/AddFoodForm.tsx`

- [ ] **Step 1: 全檔替換 `src/app/add/page.tsx`**

```tsx
import Link from "next/link";
import { AddFoodForm } from "@/components/AddFoodForm";
import { AppHeader } from "@/components/ui/AppHeader";

export default function AddPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8">
      <AppHeader title="新增食物" actions={<Link href="/" className="text-[#8a8178]">‹ 返回</Link>} />
      <AddFoodForm />
    </main>
  );
}
```

- [ ] **Step 2: 全檔替換 `src/components/AddFoodForm.tsx`**（邏輯完全不變，只重塑樣式 + 隱藏原生 file input 用 label 大按鈕）

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/recognition";

interface Row { id: string; name: string; category: string; expiresAt: string; fromAI: boolean }

const blankRow = (): Row => ({ id: crypto.randomUUID(), name: "", category: "其他", expiresAt: "", fromAI: false });

interface PhotoResponse {
  photoId: string;
  capturedAt: string;
  recognized?: Array<{ name: string; category: string; confidence: number }>;
}

const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base outline-none focus:border-[#5fbe91]";

export function AddFoodForm() {
  const router = useRouter();
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [storedAt, setStoredAt] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [recognizing, setRecognizing] = useState(false);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setRecognizing(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/photos", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data: PhotoResponse = await res.json();
      setPhotoId(data.photoId);
      setStoredAt(data.capturedAt.slice(0, 16));
      const recognized = data.recognized ?? [];
      setRows(recognized.length
        ? recognized.map((r) => ({ id: crypto.randomUUID(), name: r.name, category: r.category, expiresAt: "", fromAI: true }))
        : [blankRow()]);
    } catch {
      setRows([blankRow()]);
    } finally {
      setBusy(false); setRecognizing(false);
    }
  }

  function update(id: string, patch: Partial<Row>) { setRows((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r)); }
  function addRow() { setRows((rs) => [...rs, blankRow()]); }
  function removeRow(id: string) { setRows((rs) => rs.filter((r) => r.id !== id)); }

  async function save() {
    setBusy(true);
    const stored = storedAt ? new Date(storedAt).toISOString() : new Date().toISOString();
    try {
      const res = await fetch("/api/food", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: rows.filter((r) => r.name.trim()).map((r) => ({
          name: r.name, category: r.category, photoId, storedAt: stored,
          expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null, isRecognized: r.fromAI,
        })) }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      router.push("/");
    } catch {
      setBusy(false);
    }
  }

  const canSave = !busy && rows.some((r) => r.name.trim());

  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#5fbe91]/50 bg-white py-8 text-center">
        <span className="text-3xl">📷</span>
        <span className="text-sm font-medium text-[#3e9e73]">拍照或選相簿</span>
        <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
      </label>

      {recognizing && (
        <div className="rounded-2xl bg-white p-4 text-center text-sm text-[#8a8178] shadow-sm">辨識中…</div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">放入時間（預設＝拍照時間）</label>
            <input className={inputCls} type="datetime-local" value={storedAt} onChange={(e) => setStoredAt(e.target.value)} />
          </div>

          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
              <input className={inputCls} placeholder="名稱" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
              <select className={inputCls} value={r.category} onChange={(e) => update(r.id, { category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <label className="text-xs text-[#8a8178]">到期日（留空＝依類別自動估）</label>
              <input className={inputCls} type="date" value={r.expiresAt} onChange={(e) => update(r.id, { expiresAt: e.target.value })} />
              <button className="self-end text-sm text-red-600" onClick={() => removeRow(r.id)}>刪除這筆</button>
            </div>
          ))}

          <button className="rounded-xl border border-[#5fbe91] py-3 text-sm font-medium text-[#3e9e73]" onClick={addRow}>＋ 再加一筆</button>
          <button disabled={!canSave} className="rounded-xl bg-[#5fbe91] py-3 font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50" onClick={save}>
            {busy ? "儲存中…" : "儲存"}
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: tsc + vitest + build** → 全綠/成功。

- [ ] **Step 4: Commit**
```bash
git add src/app/add/page.tsx src/components/AddFoodForm.tsx
git commit -m "feat(ui): warm-card add-food screen (photo dropzone, big inputs, green save)"
```

---

### Task 5: 登入頁 + LoginForm 改版

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/LoginForm.tsx`

- [ ] **Step 1: 全檔替換 `src/app/login/page.tsx`**

```tsx
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <div className="mb-3 text-5xl">🧊</div>
        <h1 className="text-2xl font-bold text-[#2d2a26]">冰箱食物追蹤</h1>
        <p className="mt-1 text-sm text-[#8a8178]">請用電話登入</p>
      </div>
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 2: 全檔替換 `src/components/LoginForm.tsx`**（邏輯不變）

```tsx
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
```

- [ ] **Step 3: tsc + vitest + build** → 全綠/成功。

- [ ] **Step 4: Commit**
```bash
git add src/app/login/page.tsx src/components/LoginForm.tsx
git commit -m "feat(ui): warm-card login screen"
```

---

### Task 6: 管理頁 AdminUsers 改版

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/components/AdminUsers.tsx`

- [ ] **Step 1: 全檔替換 `src/app/admin/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AdminUsers } from "@/components/AdminUsers";
import { AppHeader } from "@/components/ui/AppHeader";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8">
      <AppHeader title="使用者管理" actions={<Link href="/" className="text-[#8a8178]">‹ 返回</Link>} />
      <AdminUsers />
    </main>
  );
}
```

- [ ] **Step 2: 全檔替換 `src/components/AdminUsers.tsx`**（所有邏輯/狀態/函式完全不變，只重塑樣式）

```tsx
"use client";
import { useEffect, useState } from "react";

interface UserRow { id: string; phone: string | null; name: string; createdAt: string; isAdmin: boolean }

const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base outline-none focus:border-[#5fbe91]";

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error();
      setUsers((await res.json()).users ?? []);
    } catch {
      setError("載入失敗");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAdding(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "新增失敗"); return; }
      setPhone(""); setName("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string, label: string) {
    if (!confirm(`確定刪除「${label}」？刪除後對方將無法登入。`)) return;
    setError("");
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "刪除失敗"); return; }
    await load();
  }

  function startEdit(u: UserRow) {
    setError("");
    setEditingId(u.id);
    setEditName(u.name);
    setEditPhone(u.phone ?? "");
  }
  function cancelEdit() {
    setEditingId(null);
  }
  async function save(u: UserRow) {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: editName, phone: editPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "儲存失敗"); return; }
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#2d2a26]">新增使用者</h2>
        <input type="text" placeholder="名字（例：媽）" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
        <input type="tel" inputMode="tel" placeholder="電話（例：0912-345-678）" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} required />
        <button type="submit" disabled={adding} className="rounded-xl bg-[#5fbe91] py-3 font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50">{adding ? "新增中…" : "新增"}</button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="py-6 text-center text-sm text-[#8a8178]">載入中…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.id} className="rounded-2xl bg-white p-4 shadow-sm">
              {editingId === u.id ? (
                <div className="flex flex-col gap-2">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="名字" className={inputCls} />
                  <input type="tel" inputMode="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} disabled={u.isAdmin} placeholder="電話" className={`${inputCls} disabled:bg-gray-100 disabled:text-gray-400`} />
                  {u.isAdmin && <p className="text-xs text-[#8a8178]">管理員電話固定，無法修改</p>}
                  <div className="flex gap-2">
                    <button onClick={() => save(u)} disabled={saving} className="rounded-xl bg-[#5fbe91] px-4 py-2.5 text-sm font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50">{saving ? "儲存中…" : "儲存"}</button>
                    <button onClick={cancelEdit} disabled={saving} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm text-[#8a8178]">取消</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold text-[#2d2a26]">
                      <span className="truncate">{u.name}</span>
                      {u.isAdmin && <span className="flex-shrink-0 rounded-full bg-[#5fbe91]/15 px-2 py-0.5 text-xs text-[#3e9e73]">管理員</span>}
                    </div>
                    <div className="text-sm text-[#8a8178]">{u.phone}</div>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button onClick={() => startEdit(u)} className="rounded-lg bg-[#5fbe91]/10 px-3 py-2 text-sm font-medium text-[#3e9e73]">編輯</button>
                    {!u.isAdmin && (
                      <button onClick={() => remove(u.id, u.name)} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">刪除</button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: tsc + vitest + build** → 全綠/成功。

- [ ] **Step 4: Commit**
```bash
git add src/app/admin/page.tsx src/components/AdminUsers.tsx
git commit -m "feat(ui): warm-card admin user management screen"
```

---

## 部署（實作 + 本機驗證全綠、合併 main 後）

1. 合併到 main → `npx zeabur@latest service redeploy --id 6a2d5ceed131a64afc9f3e19 -y -i=false` → 等該 commit 在 `deployment list` 顯示 RUNNING。
2. **手機真機 QA**（`https://food-expiration-tracker.zeabur.app`）：
   - 登入頁:置中、大輸入框、綠按鈕、奶油底。
   - 首頁:卡片清單、縮圖點擊放大、狀態膠囊顏色對、固定底部「＋ 新增食物」不被瀏海/home indicator 擋。
   - 新增頁:大「拍照或選相簿」、辨識→帶入、儲存。
   - 管理頁:卡片、編輯/刪除按鈕好點、編輯模式正常。
   - iOS 安全區、長名字不爆框。

---

## Self-Review 註記

- **Spec coverage**：design tokens + 字體 + 安全區(T1)、StatusPill + AppHeader(T2)、首頁/清單卡片+縮圖+膠囊+固定底部(T3)、新增頁 dropzone+大輸入+綠儲存(T4)、登入頁(T5)、管理頁卡片+觸控(T6)、部署/真機 QA(部署段)。皆涵蓋。
- **不動邏輯**：FoodList/AddFoodForm/AdminUsers/LoginForm 的 fetch/狀態/函式都原樣保留，只換 className 與包裝結構；`expiryState` 不動，StatusPill 只做對照。
- **Placeholder scan**：無 TBD；每步有完整 code/指令。
- **一致性**：主色 `#5fbe91`/深 `#3e9e73`、奶油 `#fbf7f0`、卡片 `rounded-2xl bg-white shadow-sm`、`inputCls` 跨檔一致;`statusMeta`/`StatusPill`/`AppHeader` 簽章一致。
- **雷**：Noto Sans TC 的 `subsets` 在 build 可能要改 `preload:false`(T1 Step3 已寫對策);PWA `sw.js`/manifest 不動。
