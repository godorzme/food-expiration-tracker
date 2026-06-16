# 改名「食物存放清單」+ 使用者頭像 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把全 App 文案改為「食物存放清單」，並讓每位使用者上傳自己的頭像，顯示於首頁頂部、食物卡片、管理頁。

**Architecture:** 純文案改名（不動邏輯）。頭像重用既有 `User.pictureUrl`（存 `/api/photo/<photoId>`）+ 既有照片管線，**不改 schema**。共用 `Avatar` 元件（首字 fallback）。

**Tech Stack:** Next.js 16、Prisma 7、Tailwind v4、vitest。

**Spec:** `docs/superpowers/specs/2026-06-16-rename-and-avatars-design.md`

**通則：** 每 Task 結束 `npx tsc --noEmit`（0）、`npx vitest run`（綠）、`npx next build`（成功）。commit body 末行 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`（heredoc）。配色沿用：綠 `#5fbe91`/深 `#3e9e73`、奶油 `#fbf7f0`。

---

### Task 1: 改名文案 →「食物存放清單」

**Files:** Modify `src/app/layout.tsx`, `public/manifest.json`, `src/app/login/page.tsx`, `src/app/page.tsx`, `src/components/FoodList.tsx`

- [ ] **Step 1: `src/app/layout.tsx`** — metadata 改：
```tsx
export const metadata: Metadata = {
  title: "食物存放清單",
  description: "追蹤家裡食物的存放與到期",
  manifest: "/manifest.json",
};
```
（其餘不動。）

- [ ] **Step 2: `public/manifest.json`** — 全檔替換：
```json
{
  "name": "食物存放清單",
  "short_name": "食物清單",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fbf7f0",
  "theme_color": "#5fbe91",
  "icons": [{ "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }]
}
```

- [ ] **Step 3: `src/app/login/page.tsx`** — 把標題區的 `🧊` 改 `🍱`、`冰箱食物追蹤` 改 `食物存放清單`：
```tsx
      <div className="mb-8 text-center">
        <div className="mb-3 text-5xl">🍱</div>
        <h1 className="text-2xl font-bold text-[#2d2a26]">食物存放清單</h1>
        <p className="mt-1 text-sm text-[#8a8178]">請用電話登入</p>
      </div>
```

- [ ] **Step 4: `src/app/page.tsx`** — `AppHeader` 的 `title="冰箱清單"` 改為 `title="食物存放清單"`（只改這個字串，其餘不動）。

- [ ] **Step 5: `src/components/FoodList.tsx`** — 空狀態那段（`items.length === 0` 的 return）把 `🧊` 改 `🍱`、文字改：
```tsx
        <div className="mb-2 text-4xl">🍱</div>
        <p className="text-sm text-[#8a8178]">還沒有食物，點下方「＋ 新增食物」記錄第一樣吧。</p>
```

- [ ] **Step 6: tsc + build + commit**

Run: `npx tsc --noEmit && npx next build` → 0 錯/成功。
```bash
git add src/app/layout.tsx public/manifest.json src/app/login/page.tsx src/app/page.tsx src/components/FoodList.tsx
git commit -m "feat(brand): rename app to 食物存放清單 (titles, manifest, login, home, empty state)"
```

---

### Task 2: `avatar.ts`（initials，+測試）+ `Avatar` 元件

**Files:** Create `src/lib/avatar.ts`, `src/lib/avatar.test.ts`, `src/components/ui/Avatar.tsx`

- [ ] **Step 1: 寫失敗測試**
```ts
// src/lib/avatar.test.ts
import { describe, it, expect } from "vitest";
import { initials } from "./avatar";

describe("initials", () => {
  it("takes the first character of a Chinese name", () => {
    expect(initials("媽媽")).toBe("媽");
    expect(initials("小明")).toBe("小");
  });
  it("takes the first letter of an English name", () => {
    expect(initials("Jason")).toBe("J");
  });
  it("trims whitespace", () => {
    expect(initials("  小華 ")).toBe("小");
  });
  it("returns ? for empty", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/avatar.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作 avatar.ts**
```ts
// src/lib/avatar.ts
export function initials(name: string): string {
  const t = (name ?? "").trim();
  if (!t) return "?";
  return Array.from(t)[0];
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/avatar.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: 實作 Avatar 元件**
```tsx
// src/components/ui/Avatar.tsx
"use client";
import { useState } from "react";
import { initials } from "@/lib/avatar";

export function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const dim = { width: size, height: size };
  if (src && !err) {
    return (
      <img
        src={src}
        alt={name}
        style={dim}
        onError={() => setErr(true)}
        className="flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      style={{ ...dim, fontSize: Math.round(size * 0.45) }}
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-[#5fbe91]/20 font-semibold text-[#3e9e73]"
    >
      {initials(name)}
    </span>
  );
}
```

- [ ] **Step 6: tsc + Commit**

Run: `npx tsc --noEmit` → 0 errors
```bash
git add src/lib/avatar.ts src/lib/avatar.test.ts src/components/ui/Avatar.tsx
git commit -m "feat(ui): Avatar component + initials helper (fallback to first letter)"
```

---

### Task 3: getCurrentUser 加 avatarUrl + `/api/me`（GET/PATCH）

**Files:** Modify `src/lib/session.ts`; Create `src/app/api/me/route.ts`

- [ ] **Step 1: `src/lib/session.ts`** — `CurrentUser` 介面加一行、回傳加一行：

在介面加（在 `isAdmin: boolean;` 之後）：
```ts
  avatarUrl: string | null;
```
在 `getCurrentUser` 的 return 物件加（在 `isAdmin: ...` 之後）：
```ts
    avatarUrl: user.pictureUrl,
```

- [ ] **Step 2: 建 `src/app/api/me/route.ts`**
```ts
// src/app/api/me/route.ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ id: user.id, name: user.name, phone: user.phone, isAdmin: user.isAdmin, avatarUrl: user.avatarUrl });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const photoId = typeof body?.photoId === "string" && body.photoId ? body.photoId : "";
  if (!photoId) return Response.json({ error: "缺少照片" }, { status: 400 });
  const updated = await db.user.update({ where: { id: user.id }, data: { pictureUrl: `/api/photo/${photoId}` } });
  return Response.json({ avatarUrl: updated.pictureUrl });
}
```

- [ ] **Step 3: tsc + vitest + build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: tsc 0；vitest 綠；build 列出 `/api/me`。

- [ ] **Step 4: Commit**
```bash
git add src/lib/session.ts src/app/api/me/route.ts
git commit -m "feat(profile): getCurrentUser.avatarUrl + GET/PATCH /api/me"
```

---

### Task 4: 頭像資料接進 food/admin API

**Files:** Modify `src/lib/foodView.ts`, `src/app/api/food/route.ts`, `src/app/api/admin/users/route.ts`

- [ ] **Step 1: `src/lib/foodView.ts`** — `MemberLike` 加 `pictureUrl`，新增 `buildCreatorAvatarMap`：

把 `MemberLike` 介面改為：
```ts
export interface MemberLike { id: string; displayName: string; pictureUrl?: string | null }
```
在檔尾加：
```ts
export function buildCreatorAvatarMap(members: MemberLike[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const m of members) map[m.id] = m.pictureUrl ?? null;
  return map;
}
```

- [ ] **Step 2: `src/app/api/food/route.ts`** — GET 加 avatar：

import 行改為：
```ts
import { buildCreatorNameMap, buildCreatorAvatarMap, creatorNameFor } from "@/lib/foodView";
```
在 `const nameMap = buildCreatorNameMap(members);` 之後加：
```ts
  const avatarMap = buildCreatorAvatarMap(members);
```
DTO map 內加一欄（在 `createdByName` 之後）：
```ts
    createdByAvatar: avatarMap[it.createdBy] ?? null,
```

- [ ] **Step 3: `src/app/api/admin/users/route.ts`** — GET 的 map 加 `avatarUrl`：

把 GET 的 `users.map(...)` 物件加一欄：
```ts
    users: users.map((u) => ({ id: u.id, phone: u.phone, name: u.displayName, avatarUrl: u.pictureUrl, createdAt: u.createdAt, isAdmin: !!u.phone && isAdminPhone(u.phone) })),
```

- [ ] **Step 4: tsc + vitest + build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: tsc 0；vitest 綠（既有 foodView 測試仍過，因 `pictureUrl` 為 optional）；build 成功。

- [ ] **Step 5: Commit**
```bash
git add src/lib/foodView.ts src/app/api/food/route.ts src/app/api/admin/users/route.ts
git commit -m "feat(profile): expose creator avatar in /api/food + avatarUrl in /api/admin/users"
```

---

### Task 5: 「我的」頁 `/me` + MyProfile

**Files:** Create `src/app/me/page.tsx`, `src/components/MyProfile.tsx`

- [ ] **Step 1: page（server，登入即可）**
```tsx
// src/app/me/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { MyProfile } from "@/components/MyProfile";
import { AppHeader } from "@/components/ui/AppHeader";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8">
      <AppHeader title="我的" actions={<Link href="/" className="text-[#8a8178]">‹ 返回</Link>} />
      <MyProfile name={user.name} phone={user.phone} initialAvatar={user.avatarUrl} />
    </main>
  );
}
```

- [ ] **Step 2: MyProfile 元件**
```tsx
// src/components/MyProfile.tsx
"use client";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";

export function MyProfile({ name, phone, initialAvatar }: { name: string; phone: string | null; initialAvatar: string | null }) {
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const up = await fetch("/api/photos", { method: "POST", body: fd });
      if (!up.ok) throw new Error();
      const { photoId } = await up.json();
      const res = await fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ photoId }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAvatar(data.avatarUrl);
    } catch {
      setError("上傳失敗，請重試");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow-sm">
      <Avatar src={avatar} name={name} size={96} />
      <div className="text-center">
        <div className="text-lg font-bold text-[#2d2a26]">{name}</div>
        {phone && <div className="text-sm text-[#8a8178]">{phone}</div>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <label className="w-full cursor-pointer rounded-xl bg-[#5fbe91] py-3 text-center font-semibold text-white active:bg-[#3e9e73]">
        {busy ? "上傳中…" : avatar ? "更換頭像" : "📷 上傳頭像"}
        <input type="file" accept="image/*" capture="user" className="hidden" onChange={onPhoto} disabled={busy} />
      </label>
    </div>
  );
}
```

- [ ] **Step 3: tsc + vitest + build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: 全綠；build 列出 `/me`。

- [ ] **Step 4: Commit**
```bash
git add src/app/me/page.tsx src/components/MyProfile.tsx
git commit -m "feat(profile): /me page to upload/change own avatar"
```

---

### Task 6: 把頭像接進 首頁頂部 / 食物卡片 / 管理頁

**Files:** Modify `src/app/page.tsx`, `src/components/FoodList.tsx`, `src/components/AdminUsers.tsx`

- [ ] **Step 1: 首頁頂部頭像（`src/app/page.tsx`）**

import 區加：
```tsx
import { Avatar } from "@/components/ui/Avatar";
```
把 `AppHeader` 的 `actions` 改為（在登出之後加一個連到 /me 的頭像）：
```tsx
        actions={
          <>
            {user.isAdmin && <Link href="/admin" className="text-[#3e9e73]">⚙️ 管理</Link>}
            <LogoutButton />
            <Link href="/me" aria-label="我的"><Avatar src={user.avatarUrl} name={user.name} size={32} /></Link>
          </>
        }
```

- [ ] **Step 2: 食物卡片加入者頭像（`src/components/FoodList.tsx`）**

(a) import 加：
```tsx
import { Avatar } from "@/components/ui/Avatar";
```
(b) `FoodItemDTO` 介面加：
```tsx
  createdByAvatar?: string | null;
```
(c) 卡片內把原本的 meta 行（含 `{it.createdByName ? ... 加的 ...}`）拆成：meta 行只留 `類別 · 存放點 · 到期`，並在其下加一行加入者（有名字才顯示）：
先把 meta 行那段的 `{it.createdByName ? ...}` 片段移除，改成（meta 行）：
```tsx
                <div className="truncate text-xs text-[#8a8178]">
                  {it.category}
                  {it.locationName ? ` · ${it.locationName}` : ""}
                  {exp ? ` · 到期 ${exp.toLocaleDateString("zh-TW")}` : ""}
                </div>
```
然後在該 meta `<div>` 之後、`吃掉/丟掉` 按鈕那行 `<div className="mt-1 flex gap-2">` 之前插入加入者行：
```tsx
                {it.createdByName && (
                  <div className="flex items-center gap-1.5 text-xs text-[#8a8178]">
                    <Avatar src={it.createdByAvatar} name={it.createdByName} size={18} />
                    {it.createdByName} 加的
                  </div>
                )}
```

- [ ] **Step 3: 管理頁頭像（`src/components/AdminUsers.tsx`）**

(a) import 加：
```tsx
import { Avatar } from "@/components/ui/Avatar";
```
(b) `UserRow` 介面加：
```tsx
  avatarUrl?: string | null;
```
(c) 在「顯示模式」那段（`editingId === u.id ? (...) : (...)`）的 else 區塊，把名字/電話那個 `<div className="min-w-0">` 用一個含頭像的 flex 包起來——把：
```tsx
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold text-[#2d2a26]">
```
改為：
```tsx
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={u.avatarUrl} name={u.name} size={36} />
                    <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold text-[#2d2a26]">
```
並在該人名/電話的兩個 `<div>` 結束後補一個對應的 `</div>`（即多包了一層）。注意維持 JSX 結構平衡：原本是
```
<div min-w-0>
  <div 名字行>…</div>
  <div 電話>…</div>
</div>
```
改成
```
<div flex items-center gap-3>
  <Avatar/>
  <div min-w-0>
    <div 名字行>…</div>
    <div 電話>…</div>
  </div>
</div>
```

- [ ] **Step 4: tsc + vitest + build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: tsc 0；vitest 64 綠；build 成功。

- [ ] **Step 5: Commit**
```bash
git add src/app/page.tsx src/components/FoodList.tsx src/components/AdminUsers.tsx
git commit -m "feat(profile): show avatars in home header, food cards, admin list"
```

---

## 部署（實作 + 本機驗證全綠、合併 main 後）

1. 合併 main（**無 schema 變更**，不需 db push）。
2. `npx zeabur@latest service redeploy --id 6a2d5ceed131a64afc9f3e19 -y -i=false` → 等 RUNNING。
3. **Smoke + 真機 QA**：
   - App 標題 / 加到主畫面的 PWA 名稱顯示「食物存放清單」；登入頁 🍱 + 新名。
   - 首頁頂部右上有自己的頭像（無則首字）；點進 `/me`。
   - `/me` 上傳一張照片 → 頭像更新；回首頁頂部頭像變了。
   - 新增一筆食物 → 卡片「誰加的」旁出現你的頭像。
   - `/admin` 使用者名單每人顯示頭像（無則首字）。

---

## Self-Review 註記

- **Spec coverage**：改名(T1)、Avatar+initials(T2)、getCurrentUser.avatarUrl + /api/me(T3)、food/admin 頭像資料(T4)、/me 上傳(T5)、三處顯示(T6)、部署/QA。皆涵蓋。
- **不改 schema**：頭像存 `User.pictureUrl = /api/photo/<photoId>`，重用既有照片路由。
- **Placeholder scan**：無 TBD；新檔完整 code、既有檔精確 edit。
- **一致性**：`Avatar` props（src/name/size）跨 header/card/admin/me 一致；`initials` 在 Avatar 內用；food DTO `createdByAvatar` 在 T4(API) 與 T6(FoodList 介面) 一致；`UserRow.avatarUrl` 在 T4(API) 與 T6(AdminUsers) 一致；`/api/me` 回傳的 `avatarUrl` 與 PATCH 寫入格式一致。
- **雷**：T6 AdminUsers 多包一層 `<div>` 要保持 JSX 結構平衡（補對應 `</div>`）；Avatar 是 client 元件，於 server 的 page.tsx/me 內可正常 render。
