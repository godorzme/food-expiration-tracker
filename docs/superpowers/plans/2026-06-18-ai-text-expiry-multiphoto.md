# 文字判斷到期日 + 多照片一物 + 編輯重判/換照 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 到期日改用「視覺認名→文字 AI 查天數」;新增支援多照片(一張一物);編輯改名重判(確認)、改放入日順移、照片可換。

**Architecture:** 新增 server lib `expiryAI`(文字判天數)+ `/api/estimate-expiry`;`/api/photos` 改回單一品項 + 天數;新增/編輯前端重做。不改 schema。

**Tech Stack:** Next.js 16、Prisma 7、AI Hub(OpenAI 相容)、Tailwind v4、vitest。

**Spec:** `docs/superpowers/specs/2026-06-18-ai-text-expiry-multiphoto-design.md`

**通則：** 每 Task `npx tsc --noEmit`(0)、`npx vitest run`(綠)、`npx next build`(成功)。commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`(heredoc)。配色綠 `#5fbe91`/灰 `#3c4650`/`#8a8178`。

---

### Task 1: `expiryAI`（文字判天數）+ `addDays`（+測試）

**Files:** Create `src/lib/expiryAI.ts`, `src/lib/expiryAI.test.ts`; Modify `src/lib/expiry.ts`, `src/lib/expiry.test.ts`

- [ ] **Step 1: 寫失敗測試**

`src/lib/expiryAI.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseDays } from "./expiryAI";

describe("parseDays", () => {
  it("parses {\"days\":N}", () => {
    expect(parseDays('{"days": 7}')).toBe(7);
  });
  it("parses fenced json", () => {
    expect(parseDays('```json\n{"days":5}\n```')).toBe(5);
  });
  it("clamps to >=1 and <=3650", () => {
    expect(parseDays('{"days":0}')).toBeNull();
    expect(parseDays('{"days":99999}')).toBe(3650);
  });
  it("returns null for garbage", () => {
    expect(parseDays("不知道")).toBeNull();
    expect(parseDays("")).toBeNull();
  });
});
```

Append to `src/lib/expiry.test.ts`:
```ts
import { addDays } from "./expiry";

describe("addDays", () => {
  it("adds days across month boundary", () => {
    const out = addDays(new Date("2026-06-28T00:00:00.000Z"), 7);
    expect(out.toISOString().slice(0, 10)).toBe("2026-07-05");
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/expiryAI.test.ts src/lib/expiry.test.ts`
Expected: FAIL（找不到 parseDays / addDays）

- [ ] **Step 3: 實作 expiryAI.ts**
```ts
// src/lib/expiryAI.ts
export function parseDays(raw: string): number | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    const obj = JSON.parse(m ? m[0] : raw) as { days?: unknown };
    const d = Number(obj.days);
    if (!Number.isFinite(d)) return null;
    const r = Math.round(d);
    if (r < 1) return null;
    return Math.min(r, 3650);
  } catch {
    return null;
  }
}

// Ask the text model how many days an item keeps in a typical home fridge.
// Returns null when AI Hub isn't configured or the call fails (caller falls back).
export async function estimateDaysFromName(name: string): Promise<number | null> {
  const base = process.env.AI_HUB_BASE_URL;
  const key = process.env.AI_HUB_API_KEY;
  const model = process.env.AI_HUB_VISION_MODEL;
  if (!base || !key || !model || !name.trim()) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: `你是食物保存期限助手。使用者給一個食物品項名稱,回答它在一般家庭冰箱冷藏下大約可以放幾天(整數天,常見估計即可)。只回 JSON,格式 {"days": 整數}。品項：「${name.trim()}」`,
        }],
        temperature: 0,
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = typeof json?.choices?.[0]?.message?.content === "string" ? json.choices[0].message.content : "";
    return parseDays(content);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: `expiry.ts` 加 `addDays`**（在檔尾）
```ts
export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}
```

- [ ] **Step 5: 跑測試確認 pass**

Run: `npx vitest run src/lib/expiryAI.test.ts src/lib/expiry.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add src/lib/expiryAI.ts src/lib/expiryAI.test.ts src/lib/expiry.ts src/lib/expiry.test.ts
git commit -m "feat(ai): estimateDaysFromName (text shelf-life) + parseDays + addDays helper"
```

---

### Task 2: 後端接線 — estimate-expiry / photos / food GET+PATCH

**Files:** Create `src/app/api/estimate-expiry/route.ts`; Modify `src/app/api/photos/route.ts`, `src/app/api/food/route.ts`, `src/app/api/food/[id]/route.ts`

- [ ] **Step 1: `/api/estimate-expiry`（new）**
```ts
// src/app/api/estimate-expiry/route.ts
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { estimateDaysFromName } from "@/lib/expiryAI";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name : "";
  const days = await estimateDaysFromName(name);
  return Response.json({ days });
}
```

- [ ] **Step 2: `/api/photos` 改單一品項 + 天數**

import 加：
```ts
import { loadShelfLife } from "@/lib/shelfLife";
import { estimateDaysFromName } from "@/lib/expiryAI";
```
把結尾：
```ts
  const recognized = await recognizeFood(bytes, file.type || "image/jpeg");
  return Response.json({ photoId: photo.id, capturedAt: capturedAt.toISOString(), recognized });
```
改為：
```ts
  const recognized = await recognizeFood(bytes, file.type || "image/jpeg");
  const top = recognized[0] ?? null;
  let item: { name: string; category: string; days: number | null } | null = null;
  if (top) {
    let days = await estimateDaysFromName(top.name);
    if (days == null) {
      const shelf = await loadShelfLife();
      days = shelf[top.category] ?? null;
    }
    item = { name: top.name, category: top.category, days };
  }
  return Response.json({ photoId: photo.id, capturedAt: capturedAt.toISOString(), item });
```

- [ ] **Step 3: `/api/food` GET 加 `photoId`（給編輯換照用）**

在 DTO map 加一欄（在 `photoUrl` 之後）：
```ts
    photoId: it.photoId,
```

- [ ] **Step 4: `/api/food/[id]` PATCH 白名單加 `photoId`**

在 `if ("locationId" in body) {...}` 區塊之後加：
```ts
  if ("photoId" in body) data.photoId = body.photoId || null;
```

- [ ] **Step 5: tsc + vitest + build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: 全綠;build 列出 `/api/estimate-expiry`。

- [ ] **Step 6: Commit**
```bash
git add src/app/api/estimate-expiry/route.ts src/app/api/photos/route.ts src/app/api/food/route.ts "src/app/api/food/[id]/route.ts"
git commit -m "feat(food): /api/estimate-expiry; photos returns single item+days; food GET photoId; PATCH photoId"
```

---

### Task 3: AddFoodForm — 多照片、一張一物

**Files:** Modify `src/components/AddFoodForm.tsx`（全檔替換）

- [ ] **Step 1: 全檔替換**
```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/recognition";
import { LocationChips } from "@/components/ui/LocationChips";
import { defaultLocationId } from "@/lib/locations";
import { addDays } from "@/lib/expiry";

interface Row {
  id: string;
  photoId: string | null;
  photoUrl: string | null;
  name: string;
  category: string;
  days: number | null;
  expiresAt: string;
  expiryEdited: boolean;
  fromAI: boolean;
}

const blankRow = (): Row => ({ id: crypto.randomUUID(), photoId: null, photoUrl: null, name: "", category: "其他", days: null, expiresAt: "", expiryEdited: false, fromAI: false });

interface PhotoResponse { photoId: string; capturedAt: string; item: { name: string; category: string; days: number | null } | null }

const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base text-[#3c4650] outline-none focus:border-[#5fbe91]";

export function AddFoodForm() {
  const router = useRouter();
  const [storedAt, setStoredAt] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
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

  function expiryFor(days: number | null, storedAtStr: string): string {
    if (days == null) return "";
    const base = storedAtStr ? new Date(storedAtStr) : new Date();
    if (Number.isNaN(base.getTime())) return "";
    return addDays(base, days).toISOString().slice(0, 10);
  }

  // Each selected photo → one item (its own photo). Uploaded sequentially.
  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    setBusy(true);
    let stored = storedAt;
    const added: Row[] = [];
    for (let i = 0; i < files.length; i++) {
      setProgress(`辨識中 ${i + 1}/${files.length}…`);
      try {
        const fd = new FormData(); fd.append("file", files[i]);
        const res = await fetch("/api/photos", { method: "POST", body: fd });
        if (!res.ok) throw new Error();
        const data: PhotoResponse = await res.json();
        if (i === 0 && !stored) stored = data.capturedAt.slice(0, 16);
        const it = data.item;
        added.push({
          id: crypto.randomUUID(),
          photoId: data.photoId,
          photoUrl: `/api/photo/${data.photoId}`,
          name: it?.name ?? "",
          category: it?.category ?? "其他",
          days: it?.days ?? null,
          expiresAt: expiryFor(it?.days ?? null, stored),
          expiryEdited: false,
          fromAI: !!it,
        });
      } catch {
        // skip a failed photo; user can still 手動加一筆
      }
    }
    if (!storedAt && stored) setStoredAt(stored);
    setRows((rs) => [...rs, ...added]);
    setProgress(null);
    setBusy(false);
  }

  function update(id: string, patch: Partial<Row>) { setRows((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r)); }
  function changeCategory(id: string, category: string) { update(id, { category }); }
  function changeStoredAt(v: string) {
    setStoredAt(v);
    setRows((rs) => rs.map((r) => r.expiryEdited ? r : { ...r, expiresAt: expiryFor(r.days, v) }));
  }
  function addManualRow() { setRows((rs) => [...rs, blankRow()]); }
  function removeRow(id: string) { setRows((rs) => rs.filter((r) => r.id !== id)); }

  async function save() {
    setBusy(true);
    const stored = storedAt ? new Date(storedAt).toISOString() : new Date().toISOString();
    try {
      const res = await fetch("/api/food", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: rows.filter((r) => r.name.trim()).map((r) => ({
          name: r.name, category: r.category, photoId: r.photoId, locationId, storedAt: stored,
          expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null, isRecognized: r.fromAI,
        })) }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      router.push("/");
    } catch {
      setBusy(false);
    }
  }

  const canSave = !busy && !!locationId && rows.some((r) => r.name.trim());

  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#5fbe91]/50 bg-white py-8 text-center">
        <span className="text-3xl">📷</span>
        <span className="text-sm font-medium text-[#3e9e73]">拍照或選相簿（可多張）</span>
        <span className="text-xs text-[#8a8178]">📸 一張照片 = 一項物品</span>
        <input type="file" accept="image/*" capture="environment" multiple onChange={onPhotos} className="hidden" />
      </label>

      {progress && (
        <div className="rounded-2xl bg-white p-4 text-center text-sm text-[#8a8178] shadow-sm">{progress}</div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">存放點</label>
            <LocationChips locations={locations} selected={locationId} onSelect={setLocationId} allowAll={false} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">放入時間（這批共用）</label>
            <input className={inputCls} type="datetime-local" value={storedAt} onChange={(e) => changeStoredAt(e.target.value)} />
          </div>

          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
              {r.photoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={r.photoUrl} alt={r.name || "照片"} className="h-32 w-full rounded-xl object-cover" />
              )}
              <input className={inputCls} placeholder="名稱" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
              <select className={inputCls} value={r.category} onChange={(e) => changeCategory(r.id, e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <label className="text-xs text-[#8a8178]">到期日（AI 估算，可改）</label>
              <input className={inputCls} type="date" value={r.expiresAt} onChange={(e) => update(r.id, { expiresAt: e.target.value, expiryEdited: true })} />
              <button className="self-end text-sm text-red-600" onClick={() => removeRow(r.id)}>刪除這筆</button>
            </div>
          ))}

          <button className="rounded-xl border border-[#5fbe91] py-3 text-sm font-medium text-[#3e9e73]" onClick={addManualRow}>＋ 手動加一筆</button>
          <button disabled={!canSave} className="rounded-xl bg-[#5fbe91] py-3 font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50" onClick={save}>
            {busy ? "處理中…" : "儲存"}
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: tsc + vitest + build** → 全綠/成功。

- [ ] **Step 3: Commit**
```bash
git add src/components/AddFoodForm.tsx
git commit -m "feat(food): multi-photo add — one photo per item, each with its own photo + AI expiry"
```

---

### Task 4: EditFoodSheet — 改名重判(確認)、改放入日順移、換照片

**Files:** Modify `src/components/EditFoodSheet.tsx`（全檔替換）; Modify `src/components/FoodList.tsx`（FoodItemDTO 加 `photoId`）

- [ ] **Step 1: FoodList 的 `FoodItemDTO` 介面加一欄**

在 `interface FoodItemDTO {` 內 `photoUrl?: string | null;` 之後加：
```tsx
  photoId?: string | null;
```

- [ ] **Step 2: 全檔替換 `src/components/EditFoodSheet.tsx`**
```tsx
"use client";
import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/recognition";
import { LocationChips } from "@/components/ui/LocationChips";
import { addDays } from "@/lib/expiry";

interface Item {
  id: string;
  name: string;
  category: string;
  storedAt: string;
  expiresAt: string | null;
  locationId?: string | null;
  photoId?: string | null;
}

const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base text-[#3c4650] outline-none focus:border-[#5fbe91]";

export function EditFoodSheet({
  item,
  locations,
  onClose,
  onSaved,
}: {
  item: Item;
  locations: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const origName = item.name;
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [locationId, setLocationId] = useState<string | null>(item.locationId ?? null);
  const [storedAt, setStoredAt] = useState(item.storedAt ? item.storedAt.slice(0, 16) : "");
  const [expiresAt, setExpiresAt] = useState(item.expiresAt ? item.expiresAt.slice(0, 10) : "");
  const [photoId, setPhotoId] = useState<string | null>(item.photoId ?? null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);

  // Changing the stored time shifts the expiry by the same span it currently has.
  function changeStoredAt(v: string) {
    if (expiresAt) {
      const od = new Date(storedAt), nd = new Date(v), ex = new Date(`${expiresAt}T00:00:00`);
      if (!Number.isNaN(od.getTime()) && !Number.isNaN(nd.getTime()) && !Number.isNaN(ex.getTime())) {
        const delta = ex.getTime() - od.getTime();
        setExpiresAt(new Date(nd.getTime() + delta).toISOString().slice(0, 10));
      }
    }
    setStoredAt(v);
  }

  // Editing the name re-judges expiry via the text AI; show a suggestion to confirm.
  useEffect(() => {
    const n = name.trim();
    if (!n || n === origName) { setSuggestion(null); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/estimate-expiry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: n }) });
        if (!res.ok) return;
        const { days } = await res.json();
        if (days == null) { setSuggestion(null); return; }
        const base = storedAt ? new Date(storedAt) : new Date();
        if (Number.isNaN(base.getTime())) return;
        setSuggestion(addDays(base, days).toISOString().slice(0, 10));
      } catch {}
    }, 700);
    return () => clearTimeout(t);
  }, [name, origName, storedAt]);

  async function swapPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true); setError("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/photos", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      setPhotoId((await res.json()).photoId);
    } catch {
      setError("照片上傳失敗");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!name.trim()) { setError("請填名稱"); return; }
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/food/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          locationId,
          photoId,
          storedAt: storedAt ? new Date(storedAt).toISOString() : item.storedAt,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "儲存失敗"); return; }
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function fmt(d: string) { const x = new Date(`${d}T00:00:00`); return `${x.getMonth() + 1}/${x.getDate()}`; }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#fbf7f0]" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      <div className="mx-auto w-full max-w-md px-4 pb-10">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-[#3c4650]">編輯食物</h1>
          <button onClick={onClose} className="text-sm text-[#8a8178]">取消</button>
        </div>
        <div className="flex flex-col gap-3">
          {photoId && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`/api/photo/${photoId}`} alt="照片" className="h-40 w-full rounded-xl object-cover" />
          )}
          <label className="cursor-pointer rounded-xl border border-[#5fbe91] py-2.5 text-center text-sm font-medium text-[#3e9e73]">
            {uploading ? "上傳中…" : photoId ? "換照片" : "📷 加照片"}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={swapPhoto} />
          </label>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">名稱</label>
            <input className={inputCls} placeholder="名稱" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">類別</label>
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {locations.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8a8178]">存放點</label>
              <LocationChips locations={locations} selected={locationId} onSelect={setLocationId} allowAll={false} />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">到期日</label>
            <input className={inputCls} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            {suggestion && suggestion !== expiresAt && (
              <button onClick={() => { setExpiresAt(suggestion); setSuggestion(null); }} className="self-start rounded-lg bg-[#5fbe91]/10 px-3 py-1.5 text-xs font-medium text-[#3e9e73]">
                🤖 依「{name.trim()}」建議到期日 {fmt(suggestion)}，套用
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">放入時間（改了到期日會跟著順移）</label>
            <input className={inputCls} type="datetime-local" value={storedAt} onChange={(e) => changeStoredAt(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy || uploading} onClick={save} className="rounded-xl bg-[#5fbe91] py-3 font-semibold text-white active:bg-[#3e9e73] disabled:opacity-50">
            {busy ? "儲存中…" : "儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: tsc + vitest + build** → 全綠/成功。

- [ ] **Step 4: Commit**
```bash
git add src/components/EditFoodSheet.tsx src/components/FoodList.tsx
git commit -m "feat(food): edit re-judges expiry on name change (confirm), shifts on stored-date change, swappable photo"
```

---

## 部署（實作 + 本機驗證全綠、合併 main 後）

1. 合併 main（無 schema 變更）。
2. `npx zeabur@latest service redeploy --id 6a2d5ceed131a64afc9f3e19 -y -i=false` → 等 RUNNING。
3. **真機 QA**：
   - 新增:一次選多張 → 每張一筆、各自照片、到期日依名稱(文字 AI)帶入;有「一張=一物」提醒;共用放入日/存放點;手動加一筆可用。
   - 編輯:改名 → 跳出「🤖 建議到期日 X，套用」可點;改放入時間 → 到期日順移;換照片 → 預覽更新、儲存後卡片照片換掉。
   - AI Hub 故障時 fallback 類別表、再不行留空,不崩。

---

## Self-Review 註記

- **Spec coverage**：文字判天數 + addDays(T1)、estimate-expiry/photos 單品項+天數/food photoId 讀寫(T2)、多照片一物新增(T3)、編輯重判+順移+換照(T4)、部署/QA。皆涵蓋。
- **不改 schema**：天數不存,順移用「到期−放入」間距;photoId 既有欄位。
- **一致性**：`estimateDaysFromName`(server) 回 number|null;`parseDays`/`addDays` 純函式測;`/api/photos` 回 `item:{name,category,days}|null`,AddFoodForm 的 `PhotoResponse` 對應;`/api/estimate-expiry` 回 `{days}`,EditFoodSheet 對應;food GET 多回 `photoId`,FoodItemDTO + EditFoodSheet Item 都加 `photoId`;PATCH 接受 photoId。
- **雷**：text AI 用 `AI_HUB_VISION_MODEL`(同一模型跑文字);多照片 sequential 避免一次打爆 AI；date 輸入 `YYYY-MM-DD` 轉 Date 用 `T00:00:00` 避免時區位移;`e.target.value=""` 讓同檔可重選。
