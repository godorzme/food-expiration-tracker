# 多存放點 + 位置照片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 啟用多存放點：管理員可增改刪存放點（含可選位置照片）、新增食物必選存放點、首頁用 chip 依存放點過濾。

**Architecture:** 啟用既有 `Location` 模型 + 加位置照片（`Location.photoId` → 重用既有 `Photo` 與 `/api/photo/[id]`）。`GET /api/locations`（登入即可，自動建預設「冰箱」）給首頁 chip 與新增頁 picker；寫入限管理員。首頁過濾在 client 端。

**Tech Stack:** Next.js 16、Prisma 7、Tailwind v4、vitest。

**Spec:** `docs/superpowers/specs/2026-06-16-storage-locations-design.md`

**通則：** 每個 Task 結束跑 `npx tsc --noEmit`（0）、`npx vitest run`（維持綠）、`npx next build`（成功）。commit body 末行加 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`（heredoc）。沿用溫暖卡片風：`inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base outline-none focus:border-[#5fbe91]"`、主按鈕 `bg-[#5fbe91] ... active:bg-[#3e9e73]`、卡片 `rounded-2xl bg-white shadow-sm`。

---

### Task 1: Schema — Location 加 photoId + createdAt；Photo 加反向關聯

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: 改 `model Location`**

```prisma
model Location {
  id          String     @id @default(cuid())
  household   Household  @relation(fields: [householdId], references: [id])
  householdId String
  name        String
  photo       Photo?     @relation(fields: [photoId], references: [id])
  photoId     String?
  createdAt   DateTime   @default(now())
  foodItems   FoodItem[]
}
```

- [ ] **Step 2: 在 `model Photo` 加反向關聯**（在 `foodItems  FoodItem[]` 下一行）

```prisma
  locations  Location[]
```

- [ ] **Step 3: 產生 client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat(schema): Location.photoId + createdAt, Photo.locations back-relation"
```

---

### Task 2: `locations.ts` 純邏輯 helpers（+測試）

**Files:** Create `src/lib/locations.ts`, `src/lib/locations.test.ts`

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/locations.test.ts
import { describe, it, expect } from "vitest";
import { defaultLocationId, canDeleteLocation, ensureDefaultLocation } from "./locations";

describe("defaultLocationId", () => {
  it("returns the first location id", () => {
    expect(defaultLocationId([{ id: "a", name: "冰箱" }, { id: "b", name: "冷凍" }])).toBe("a");
  });
  it("returns null for empty", () => {
    expect(defaultLocationId([])).toBeNull();
  });
});

describe("canDeleteLocation", () => {
  it("allows delete only when no active items", () => {
    expect(canDeleteLocation(0)).toBe(true);
    expect(canDeleteLocation(3)).toBe(false);
  });
});

describe("ensureDefaultLocation", () => {
  it("returns existing locations without creating", async () => {
    const db = {
      location: {
        findMany: async () => [{ id: "x", name: "冰箱" }],
        create: async () => { throw new Error("should not create"); },
      },
    } as any;
    const locs = await ensureDefaultLocation(db, "hh1");
    expect(locs.map((l: { id: string }) => l.id)).toEqual(["x"]);
  });
  it("creates 冰箱 when none exist", async () => {
    let created = false;
    const db = {
      location: {
        findMany: async () => [],
        create: async ({ data }: any) => { created = true; return { id: "new", name: data.name }; },
      },
    } as any;
    const locs = await ensureDefaultLocation(db, "hh1");
    expect(created).toBe(true);
    expect(locs[0].name).toBe("冰箱");
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/locations.test.ts`
Expected: FAIL（找不到模組）

- [ ] **Step 3: 實作**

```ts
// src/lib/locations.ts
export function defaultLocationId(locations: { id: string }[]): string | null {
  return locations[0]?.id ?? null;
}

export function canDeleteLocation(activeItemCount: number): boolean {
  return activeItemCount === 0;
}

// Return the household's locations (ordered by creation), creating a default
// 「冰箱」 if there are none — so the app always has at least one to pick.
export async function ensureDefaultLocation(db: any, householdId: string) {
  const existing = await db.location.findMany({ where: { householdId }, orderBy: { createdAt: "asc" } });
  if (existing.length > 0) return existing;
  const created = await db.location.create({ data: { householdId, name: "冰箱" } });
  return [created];
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/locations.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: Commit**
```bash
git add src/lib/locations.ts src/lib/locations.test.ts
git commit -m "feat(locations): default-location + delete-guard helpers"
```

---

### Task 3: `GET /api/locations`

**Files:** Create `src/app/api/locations/route.ts`

- [ ] **Step 1: 實作**

```ts
// src/app/api/locations/route.ts
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ensureDefaultLocation } from "@/lib/locations";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const locations = await ensureDefaultLocation(db, user.householdId);
  const result = await Promise.all(
    locations.map(async (loc: { id: string; name: string; photoId: string | null }) => ({
      id: loc.id,
      name: loc.name,
      photoUrl: loc.photoId ? `/api/photo/${loc.photoId}` : null,
      itemCount: await db.foodItem.count({ where: { locationId: loc.id, status: "active" } }),
    })),
  );
  return Response.json({ locations: result });
}
```

- [ ] **Step 2: tsc + build**

Run: `npx tsc --noEmit && npx next build`
Expected: 0 errors；build 列出 `/api/locations`。

- [ ] **Step 3: Commit**
```bash
git add src/app/api/locations/route.ts
git commit -m "feat(locations): GET /api/locations (auto-create default 冰箱)"
```

---

### Task 4: 管理員存放點 API（POST / PATCH / DELETE）

**Files:** Create `src/app/api/admin/locations/route.ts`, `src/app/api/admin/locations/[id]/route.ts`

- [ ] **Step 1: list + create**

```ts
// src/app/api/admin/locations/route.ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const photoId = typeof body?.photoId === "string" && body.photoId ? body.photoId : null;
  if (!name) return Response.json({ error: "請填存放點名稱" }, { status: 400 });
  const dup = await db.location.findFirst({ where: { householdId: admin.householdId, name } });
  if (dup) return Response.json({ error: "已有同名存放點" }, { status: 409 });
  const created = await db.location.create({ data: { householdId: admin.householdId, name, photoId } });
  return Response.json({ id: created.id, name: created.name });
}
```

- [ ] **Step 2: edit + delete**

```ts
// src/app/api/admin/locations/[id]/route.ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canDeleteLocation } from "@/lib/locations";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const loc = await db.location.findUnique({ where: { id } });
  if (!loc || loc.householdId !== admin.householdId) return Response.json({ error: "找不到存放點" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const data: { name?: string; photoId?: string | null } = {};
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return Response.json({ error: "請填存放點名稱" }, { status: 400 });
    const dup = await db.location.findFirst({ where: { householdId: admin.householdId, name, id: { not: id } } });
    if (dup) return Response.json({ error: "已有同名存放點" }, { status: 409 });
    data.name = name;
  }
  if ("photoId" in body) data.photoId = body.photoId ? String(body.photoId) : null;
  const updated = await db.location.update({ where: { id }, data });
  return Response.json({ id: updated.id, name: updated.name });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const loc = await db.location.findUnique({ where: { id } });
  if (!loc || loc.householdId !== admin.householdId) return Response.json({ error: "找不到存放點" }, { status: 404 });
  const activeCount = await db.foodItem.count({ where: { locationId: id, status: "active" } });
  if (!canDeleteLocation(activeCount))
    return Response.json({ error: "此存放點還有食物，請先清空或移動" }, { status: 409 });
  // Detach any non-active items (consumed/discarded) so the FK doesn't block delete.
  await db.foodItem.updateMany({ where: { locationId: id }, data: { locationId: null } });
  await db.location.delete({ where: { id } });
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: tsc + build**

Run: `npx tsc --noEmit && npx next build`
Expected: 0 errors；build 列出 `/api/admin/locations` 與 `/api/admin/locations/[id]`。

- [ ] **Step 4: Commit**
```bash
git add src/app/api/admin/locations
git commit -m "feat(locations): admin create/edit/delete location API (delete blocked if non-empty)"
```

---

### Task 5: food route — 寫入/回傳 locationId

**Files:** Modify `src/app/api/food/route.ts`

- [ ] **Step 1: GET 加 location**

把 `findMany({ where: { householdId: user.householdId, status: "active" }, orderBy: [{ expiresAt: "asc" }] })` 改成加 include：
```ts
    db.foodItem.findMany({
      where: { householdId: user.householdId, status: "active" },
      orderBy: [{ expiresAt: "asc" }],
      include: { location: true },
    }),
```
並在 DTO map 加兩個欄位（在 `createdByName` 那行之後）：
```ts
    locationId: it.locationId,
    locationName: it.location?.name ?? null,
```

- [ ] **Step 2: POST 驗證 + 寫入 locationId**

在 POST 的驗證迴圈內，每個 item 末尾加（在 expiresAt 檢查之後）：
```ts
    if (typeof it.locationId !== "string" || !it.locationId)
      return Response.json({ error: "請選存放點" }, { status: 400 });
```
在驗證迴圈**之後、`const shelf` 之前**，加 household 歸屬檢查：
```ts
  const validLocationIds = new Set(
    (await db.location.findMany({ where: { householdId: user.householdId } })).map((l) => l.id),
  );
  for (const it of items) {
    if (!validLocationIds.has(it.locationId as string))
      return Response.json({ error: "存放點不存在" }, { status: 400 });
  }
```
在 `db.foodItem.create({ data: { ... } })` 的 data 內加一行（在 `householdId` 之後）：
```ts
          locationId: it.locationId as string,
```

- [ ] **Step 3: tsc + vitest + build** → 全綠/成功。

- [ ] **Step 4: Commit**
```bash
git add src/app/api/food/route.ts
git commit -m "feat(food): persist + return locationId; require valid location on create"
```

---

### Task 6: LocationChips 元件 + FoodList 過濾

**Files:** Create `src/components/ui/LocationChips.tsx`; Modify `src/components/FoodList.tsx`

- [ ] **Step 1: LocationChips（純呈現）**

```tsx
// src/components/ui/LocationChips.tsx
"use client";

interface Loc { id: string; name: string }

export function LocationChips({
  locations, selected, onSelect, allowAll = true,
}: { locations: Loc[]; selected: string | null; onSelect: (id: string | null) => void; allowAll?: boolean }) {
  const base = "flex-shrink-0 rounded-full px-3 py-1.5 text-sm font-medium border";
  const on = "bg-[#5fbe91] text-white border-[#5fbe91]";
  const off = "bg-white text-[#8a8178] border-black/10";
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {allowAll && (
        <button type="button" onClick={() => onSelect(null)} className={`${base} ${selected === null ? on : off}`}>全部</button>
      )}
      {locations.map((l) => (
        <button key={l.id} type="button" onClick={() => onSelect(l.id)} className={`${base} ${selected === l.id ? on : off}`}>{l.name}</button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: FoodList 整合**（在現有 redesign 版本上改）

(a) import 區加：
```tsx
import { LocationChips } from "@/components/ui/LocationChips";
```
(b) `FoodItemDTO` 介面加兩個欄位：
```tsx
  locationId?: string | null;
  locationName?: string | null;
```
(c) 在 `const [lightbox, ...]` 之後加狀態：
```tsx
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<string | null>(null);
```
(d) 在 `useEffect(() => { load(); }, [])` 之後加抓存放點：
```tsx
  useEffect(() => {
    fetch("/api/locations").then((r) => r.ok ? r.json() : { locations: [] }).then((d) => setLocations(d.locations ?? [])).catch(() => {});
  }, []);
```
(e) 在計算 render 前加過濾：把 `items.map(...)` 的來源改成過濾後清單——在 `return (` 之前加：
```tsx
  const shown = selectedLoc ? items.filter((it) => it.locationId === selectedLoc) : items;
```
然後把清單 `{items.map((it) => {` 改為 `{shown.map((it) => {`。
(f) 在最外層 `<>` 內、`<ul>` 之前插入 chips（存放點 >1 個才顯示）：
```tsx
      {locations.length > 1 && (
        <div className="mb-3">
          <LocationChips locations={locations} selected={selectedLoc} onSelect={setSelectedLoc} />
        </div>
      )}
```
(g) 卡片小字（`{it.category}...` 那行）在 `{it.createdByName ...}` 之前加存放點：
```tsx
                  {it.locationName ? ` · ${it.locationName}` : ""}
```
（順序示意：`{it.category}{location}{createdBy}{到期}`。）

- [ ] **Step 3: tsc + vitest + build** → 全綠/成功。

- [ ] **Step 4: Commit**
```bash
git add src/components/ui/LocationChips.tsx src/components/FoodList.tsx
git commit -m "feat(food): location filter chips on home + location label on cards"
```

---

### Task 7: AddFoodForm — 存放點選擇器（必選、預設第一個）

**Files:** Modify `src/components/AddFoodForm.tsx`

- [ ] **Step 1: import + 狀態 + 載入**

(a) import 區加：
```tsx
import { useEffect } from "react";
import { LocationChips } from "@/components/ui/LocationChips";
import { defaultLocationId } from "@/lib/locations";
```
（把第 2 行 `import { useState } from "react";` 改為 `import { useEffect, useState } from "react";`，不要重複 import useEffect。）

(b) 在 `const [recognizing, ...]` 之後加：
```tsx
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => (r.ok ? r.json() : { locations: [] }))
      .then((d) => {
        const locs = d.locations ?? [];
        setLocations(locs);
        setLocationId((cur) => cur ?? defaultLocationId(locs));
      })
      .catch(() => {});
  }, []);
```

- [ ] **Step 2: 送出帶 locationId**

把 `save()` 內 body 的每個 item 物件加 `locationId`：
```tsx
        body: JSON.stringify({ items: rows.filter((r) => r.name.trim()).map((r) => ({
          name: r.name, category: r.category, photoId, locationId, storedAt: stored,
          expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null, isRecognized: r.fromAI,
        })) }),
```
並把 `canSave` 改成也要求已選存放點：
```tsx
  const canSave = !busy && !!locationId && rows.some((r) => r.name.trim());
```

- [ ] **Step 3: UI 加存放點選擇器**

在 `rows.length > 0 && (` 區塊內、「放入時間」那個 `<div>` **之前**插入：
```tsx
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">存放點</label>
            <LocationChips locations={locations} selected={locationId} onSelect={setLocationId} allowAll={false} />
          </div>
```

- [ ] **Step 4: tsc + vitest + build** → 全綠/成功。

- [ ] **Step 5: Commit**
```bash
git add src/components/AddFoodForm.tsx
git commit -m "feat(food): required storage-location picker on add (defaults to first)"
```

---

### Task 8: 管理存放點頁 `/admin/locations` + 從 /admin 連入

**Files:** Create `src/app/admin/locations/page.tsx`, `src/components/AdminLocations.tsx`; Modify `src/app/admin/page.tsx`

- [ ] **Step 1: page（server，擋非管理員）**

```tsx
// src/app/admin/locations/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AdminLocations } from "@/components/AdminLocations";
import { AppHeader } from "@/components/ui/AppHeader";

export const dynamic = "force-dynamic";

export default async function AdminLocationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8">
      <AppHeader title="存放點管理" actions={<Link href="/admin" className="text-[#8a8178]">‹ 返回</Link>} />
      <AdminLocations />
    </main>
  );
}
```

- [ ] **Step 2: AdminLocations 元件（含可選拍照、編輯、刪除）**

```tsx
// src/components/AdminLocations.tsx
"use client";
import { useEffect, useState } from "react";

interface LocRow { id: string; name: string; photoUrl: string | null; itemCount: number }
const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base outline-none focus:border-[#5fbe91]";

export function AdminLocations() {
  const [locs, setLocs] = useState<LocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error();
      setLocs((await res.json()).locations ?? []);
    } catch {
      setError("載入失敗");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>): Promise<string | null> {
    const file = e.target.files?.[0];
    if (!file) return null;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/photos", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      return (await res.json()).photoId as string;
    } catch {
      setError("照片上傳失敗");
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAdding(true);
    try {
      const res = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, photoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "新增失敗"); return; }
      setName(""); setPhotoId(null);
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(id: string, newPhotoId?: string | null) {
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (editingId === id) payload.name = editName;
      if (newPhotoId !== undefined) payload.photoId = newPhotoId;
      const res = await fetch(`/api/admin/locations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "儲存失敗"); return; }
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, label: string) {
    if (!confirm(`確定刪除存放點「${label}」？`)) return;
    setError("");
    const res = await fetch(`/api/admin/locations/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "刪除失敗"); return; }
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#2d2a26]">新增存放點</h2>
        <input type="text" placeholder="名稱（例：冷凍庫）" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#5fbe91]/50 py-4 text-sm font-medium text-[#3e9e73]">
          {uploading ? "上傳中…" : photoId ? "✓ 已附位置照（可重選）" : "📷 拍位置照（可選）"}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const id = await uploadPhoto(e); if (id) setPhotoId(id); }} />
        </label>
        <button type="submit" disabled={adding || uploading} className="rounded-xl bg-[#5fbe91] py-3 font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50">{adding ? "新增中…" : "新增存放點"}</button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="py-6 text-center text-sm text-[#8a8178]">載入中…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {locs.map((l) => (
            <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              {l.photoUrl ? (
                <img src={l.photoUrl} alt={l.name} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} className="h-14 w-14 flex-shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-[#f1ece3] text-xl">📍</div>
              )}
              <div className="min-w-0 flex-1">
                {editingId === l.id ? (
                  <div className="flex flex-col gap-2">
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(l.id)} disabled={saving} className="rounded-lg bg-[#5fbe91] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">儲存</button>
                      <button onClick={() => setEditingId(null)} disabled={saving} className="rounded-lg border border-black/10 px-3 py-2 text-sm text-[#8a8178]">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[#2d2a26]">{l.name}</div>
                      <div className="text-xs text-[#8a8178]">{l.itemCount} 樣食物</div>
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <label className="cursor-pointer rounded-lg bg-[#5fbe91]/10 px-3 py-2 text-sm font-medium text-[#3e9e73]">
                        換照
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const id = await uploadPhoto(e); if (id) await saveEdit(l.id, id); }} />
                      </label>
                      <button onClick={() => { setEditingId(l.id); setEditName(l.name); }} className="rounded-lg bg-[#5fbe91]/10 px-3 py-2 text-sm font-medium text-[#3e9e73]">改名</button>
                      <button onClick={() => remove(l.id, l.name)} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">刪除</button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: /admin 加「管理存放點」連結**

在 `src/app/admin/page.tsx` 的 `<AdminUsers />` **之前**插入一張卡片連結：
```tsx
      <Link href="/admin/locations" className="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
        <span className="font-semibold text-[#2d2a26]">📍 管理存放點</span>
        <span className="text-[#8a8178]">›</span>
      </Link>
```
並確認該檔頂部已 `import Link from "next/link";`（沒有就加）。

- [ ] **Step 4: tsc + vitest + build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: 全綠；build 列出 `/admin/locations`。

- [ ] **Step 5: Commit**
```bash
git add src/app/admin/locations src/components/AdminLocations.tsx src/app/admin/page.tsx
git commit -m "feat(locations): /admin/locations management page (photo upload, edit, delete) + link"
```

---

## 部署（實作 + 本機驗證全綠、合併 main 後）

1. 合併 main → 對 prod DB schema 更新：
   `npx prisma db push --schema=prisma/schema.prisma --url="<prod DATABASE_URL>" --accept-data-loss`
   （連線字串用 `service network --id <postgresql>`，見專案 CLAUDE.md；新增 nullable 欄位，無資料損失。）
2. **一次性遷移**（tsx 腳本，連 prod DB）：
   - `ensureDefaultLocation(db, householdId)` 取得預設「冰箱」id（householdId 取唯一 household）。
   - `db.foodItem.updateMany({ where: { householdId, status: "active", locationId: null }, data: { locationId: <冰箱id> } })`，印出筆數。
3. `npx zeabur@latest service redeploy --id 6a2d5ceed131a64afc9f3e19 -y -i=false` → 等 RUNNING。
4. **Smoke + 真機 QA**：
   - `/admin/locations`：新增存放點（含拍照）、改名、換照、刪除（非空被擋 409）。
   - 新增食物：存放點 chip 預設選第一個、必選、存入。
   - 首頁：存放點 chip 過濾、卡片顯示存放點名。
   - 既有食物都掛在「冰箱」。

---

## Self-Review 註記

- **Spec coverage**：schema(T1)、helpers(T2)、GET locations + 自動建冰箱(T3)、admin CRUD + 刪除擋下(T4)、food 寫/回 locationId + 必填驗證(T5)、首頁 chip 過濾 + 卡片標籤(T6)、新增頁必選 picker 預設第一個(T7)、/admin/locations 管理頁含可選拍照/編輯/刪除 + 入口(T8)、遷移(部署段)。皆涵蓋。
- **Placeholder scan**：無 TBD；新檔完整 code、既有檔精確 edit。
- **一致性**：`ensureDefaultLocation`/`defaultLocationId`/`canDeleteLocation` 跨 Task 簽章一致；`LocationChips` props（含 `allowAll`）首頁與新增頁共用；photoUrl 用既有 `/api/photo/[id]`；`inputCls`/配色一致；food DTO 的 `locationId`/`locationName` 在 T5(API) 與 T6(FoodList 介面) 一致。
- **雷**：`prisma db push` 用 `--url=` 等號形式 + `--accept-data-loss`（既有踩過）；删除前先 detach 非 active 項目避免 FK 擋；AddFoodForm 注意 `useState`/`useEffect` import 不要重複。
