# 對齊租寓 UI 規範 + 破圖修 + 新增頁照片/到期日 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 對齊租寓 UI 規範（保留奶油底）、修掉真機破圖、新增頁照片置頂 + AI 到期日先帶出可編輯。

**Architecture:** 純呈現/前端 + 兩個小唯讀 API；不改 schema、不改商業邏輯。

**Tech Stack:** Next.js 16、Tailwind v4、vitest。

**Spec:** `docs/superpowers/specs/2026-06-17-ui-spec-alignment-design.md`

**通則：** 每 Task 結束 `npx tsc --noEmit`（0）、`npx vitest run`（綠）、`npx next build`（成功）。commit body 末行 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`（heredoc）。

---

### Task 1: 文字色對齊租寓灰 + token

**Files:** Modify `src/app/globals.css` + 全 src 取代 `#2d2a26`→`#3c4650`

- [ ] **Step 1: `globals.css`** — `--ink` 改色 + 加輔助色 token：
把 `:root { ... }` 區塊改為：
```css
:root {
  --bg: #fbf7f0;        /* 奶油白背景（使用者保留） */
  --card: #ffffff;
  --brand: #5fbe91;     /* 租寓綠 */
  --brand-ink: #3e9e73;
  --ink: #3c4650;       /* 租寓灰（主文字） */
  --muted: #8a8178;     /* 次要文字 */
  --accent-yellow: #ffe450; /* 租寓黃 */
  --accent-blue: #2d8fd2;   /* 租寓藍 */
}
```

- [ ] **Step 2: 全 src 取代主文字色**

Run（Git Bash）：先看有哪些檔案用到：
```bash
grep -rl "#2d2a26" src/
```
把 `src/` 下所有檔案中的 `#2d2a26` 字串全部換成 `#3c4650`（含 `text-[#2d2a26]`）。可用：
```bash
grep -rl "#2d2a26" src/ | while read f; do sed -i 's/#2d2a26/#3c4650/g' "$f"; done
```
（這是純色碼替換，語意不變。）

- [ ] **Step 3: 確認沒有非品牌色殘留**

Run: `grep -rnE "#d4960f|#f5d623|#2e5339" src/ || echo "no off-brand colors"`
Expected: `no off-brand colors`（若有，回報，不自行亂改）。

- [ ] **Step 4: tsc + build + commit**
```bash
npx tsc --noEmit && npx next build
git add src/app/globals.css src/
git commit -m "style: align body text to 租寓灰 #3C4650 + add brand accent tokens"
```

---

### Task 2: StatusPill —「安全」+ 不換行 + 調色

**Files:** Modify `src/components/ui/StatusPill.tsx`, `src/components/ui/StatusPill.test.ts`

- [ ] **Step 1: 改測試斷言（先讓它失敗）**

把 `StatusPill.test.ts` 內 `expect(statusMeta("ok").label).toBe("充足");` 改為：
```ts
    expect(statusMeta("ok").label).toBe("安全");
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/components/ui/StatusPill.test.ts`
Expected: FAIL（label 還是「充足」）

- [ ] **Step 3: 改 StatusPill.tsx**

把 `META` 與 `StatusPill` 改為：
```tsx
const META: Record<ExpiryState, Meta> = {
  expired: { label: "已過期", emoji: "🔴", pill: "bg-red-50 text-red-700", edge: "#e5484d" },
  urgent:  { label: "今明到期", emoji: "🟠", pill: "bg-orange-50 text-orange-700", edge: "#f5821f" },
  soon:    { label: "接近到期", emoji: "🟡", pill: "bg-[#fff3b0] text-[#7a6512]", edge: "#ffe450" },
  ok:      { label: "安全", emoji: "🟢", pill: "bg-green-50 text-green-700", edge: "#5fbe91" },
  none:    { label: "無到期日", emoji: "⚪", pill: "bg-gray-100 text-gray-500", edge: "#b8b2a8" },
};

export function statusMeta(state: ExpiryState): Meta {
  return META[state];
}

export function StatusPill({ state }: { state: ExpiryState }) {
  const m = META[state];
  return (
    <span className={`inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${m.pill}`}>
      {m.emoji} {m.label}
    </span>
  );
}
```
（保留 `interface Meta` 與 import 不動。重點：`whitespace-nowrap flex-shrink-0`。）

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/components/ui/StatusPill.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/ui/StatusPill.tsx src/components/ui/StatusPill.test.ts
git commit -m "feat(ui): rename status ok 充足→安全; pill never wraps/shrinks; palette colors"
```

---

### Task 3: 首頁卡片到期日獨立行（修截斷）

**Files:** Modify `src/components/FoodList.tsx`

- [ ] **Step 1: 重排卡片資訊**

把卡片右側內容區（`<div className="flex min-w-0 flex-1 flex-col gap-1">` 內，從品名那行到加入者那行）替換為：
```tsx
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-[#3c4650]">{it.name}</span>
                  <StatusPill state={state} />
                </div>
                <div className="text-xs font-medium text-[#3c4650]">
                  {exp ? `到期 ${exp.getMonth() + 1}/${exp.getDate()}` : "無到期日"}
                </div>
                <div className="truncate text-xs text-[#8a8178]">
                  {it.category}{it.locationName ? ` · ${it.locationName}` : ""}
                </div>
                {it.createdByName && (
                  <div className="flex items-center gap-1.5 text-xs text-[#8a8178]">
                    <Avatar src={it.createdByAvatar} name={it.createdByName} size={18} />
                    {it.createdByName} 加的
                  </div>
                )}
                <div className="mt-1 flex gap-2">
                  <button onClick={() => mark(it.id, "consumed")} className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">✓ 吃掉</button>
                  <button onClick={() => mark(it.id, "discarded")} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">🗑 丟掉</button>
                </div>
              </div>
```
（重點：到期日獨立一行、短格式 `M/D`、不再塞進會 truncate 的那行。）

- [ ] **Step 2: tsc + vitest + build** → 全綠/成功。

- [ ] **Step 3: Commit**
```bash
git add src/components/FoodList.tsx
git commit -m "fix(ui): show expiry date on its own line (M/D), no longer truncated"
```

---

### Task 4: AdminUsers / AdminLocations 載入失敗加重新整理 + 按鈕列防爆

**Files:** Modify `src/components/AdminUsers.tsx`, `src/components/AdminLocations.tsx`

- [ ] **Step 1: AdminUsers — error 區塊加重新整理鈕**

把 `{error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}` 替換為：
```tsx
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2">
          <span className="text-sm text-red-600">{error}</span>
          <button onClick={() => { setLoading(true); load(); }} className="flex-shrink-0 rounded-lg bg-[#5fbe91] px-3 py-1.5 text-sm font-semibold text-white">重新整理</button>
        </div>
      )}
```

- [ ] **Step 2: AdminLocations — error 區塊加重新整理鈕**

同樣把 `{error && <p ...>{error}</p>}` 替換為上面那段（一字不差，`load`/`setLoading` 同名存在）。

- [ ] **Step 3: AdminLocations — 三鈕列防爆（窄螢幕可換行）**

把該列的 `<div className="flex flex-shrink-0 gap-2">`（含 換照/改名/刪除）改為：
```tsx
                    <div className="flex flex-shrink-0 flex-wrap justify-end gap-2">
```

- [ ] **Step 4: tsc + vitest + build** → 全綠/成功。

- [ ] **Step 5: Commit**
```bash
git add src/components/AdminUsers.tsx src/components/AdminLocations.tsx
git commit -m "fix(ui): retry button on admin list load failure; wrap location action buttons on narrow screens"
```

---

### Task 5: `GET /api/shelf-life` + 辨識回應附估算到期日

**Files:** Create `src/app/api/shelf-life/route.ts`; Modify `src/app/api/photos/route.ts`

- [ ] **Step 1: 建 `src/app/api/shelf-life/route.ts`**
```ts
// src/app/api/shelf-life/route.ts
import { getCurrentUser } from "@/lib/session";
import { loadShelfLife } from "@/lib/shelfLife";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ shelfLife: await loadShelfLife() });
}
```

- [ ] **Step 2: `photos/route.ts` 辨識結果附估算到期日**

import 加：
```ts
import { loadShelfLife } from "@/lib/shelfLife";
import { estimateExpiry } from "@/lib/expiry";
```
把結尾兩行：
```ts
  const recognized = await recognizeFood(bytes, file.type || "image/jpeg");
  return Response.json({ photoId: photo.id, capturedAt: capturedAt.toISOString(), recognized });
```
改為：
```ts
  const recognized = await recognizeFood(bytes, file.type || "image/jpeg");
  const shelf = await loadShelfLife();
  const recognizedWithExpiry = recognized.map((r) => ({
    ...r,
    expiresAt: estimateExpiry(r.category, capturedAt, shelf)?.toISOString() ?? null,
  }));
  return Response.json({ photoId: photo.id, capturedAt: capturedAt.toISOString(), recognized: recognizedWithExpiry });
```

- [ ] **Step 3: tsc + vitest + build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: 全綠；build 列出 `/api/shelf-life`。

- [ ] **Step 4: Commit**
```bash
git add src/app/api/shelf-life/route.ts src/app/api/photos/route.ts
git commit -m "feat(food): GET /api/shelf-life + estimated expiry per recognized item"
```

---

### Task 6: 新增頁照片置頂 + AI 到期日先帶出可編輯

**Files:** Modify `src/components/AddFoodForm.tsx`（全檔替換）

- [ ] **Step 1: 全檔替換 `src/components/AddFoodForm.tsx`**
```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/recognition";
import { LocationChips } from "@/components/ui/LocationChips";
import { defaultLocationId } from "@/lib/locations";

interface Row { id: string; name: string; category: string; expiresAt: string; fromAI: boolean; expiryEdited: boolean }

const blankRow = (): Row => ({ id: crypto.randomUUID(), name: "", category: "其他", expiresAt: "", fromAI: false, expiryEdited: false });

interface RecognizedItem { name: string; category: string; confidence: number; expiresAt?: string | null }
interface PhotoResponse { photoId: string; capturedAt: string; recognized?: RecognizedItem[] }

const inputCls = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base outline-none focus:border-[#5fbe91]";

export function AddFoodForm() {
  const router = useRouter();
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [storedAt, setStoredAt] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [shelfLife, setShelfLife] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => (r.ok ? r.json() : { locations: [] }))
      .then((d) => {
        const locs = d.locations ?? [];
        setLocations(locs);
        setLocationId((cur) => cur ?? defaultLocationId(locs));
      })
      .catch(() => {});
    fetch("/api/shelf-life")
      .then((r) => (r.ok ? r.json() : { shelfLife: {} }))
      .then((d) => setShelfLife(d.shelfLife ?? {}))
      .catch(() => {});
  }, []);

  // Estimate an expiry date (YYYY-MM-DD) from category shelf-life + stored time.
  function estimate(category: string, storedAtStr: string): string {
    const days = shelfLife[category];
    const base = storedAtStr ? new Date(storedAtStr) : new Date();
    if (days == null || Number.isNaN(base.getTime())) return "";
    return new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10);
  }

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
        ? recognized.map((r) => ({ id: crypto.randomUUID(), name: r.name, category: r.category, expiresAt: r.expiresAt ? r.expiresAt.slice(0, 10) : "", fromAI: true, expiryEdited: false }))
        : [blankRow()]);
    } catch {
      setRows([blankRow()]);
    } finally {
      setBusy(false); setRecognizing(false);
    }
  }

  function update(id: string, patch: Partial<Row>) { setRows((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r)); }
  function changeCategory(id: string, category: string) {
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, category, expiresAt: r.expiryEdited ? r.expiresAt : estimate(category, storedAt) } : r));
  }
  function changeStoredAt(v: string) {
    setStoredAt(v);
    setRows((rs) => rs.map((r) => r.expiryEdited ? r : { ...r, expiresAt: estimate(r.category, v) }));
  }
  function addRow() { setRows((rs) => [...rs, blankRow()]); }
  function removeRow(id: string) { setRows((rs) => rs.filter((r) => r.id !== id)); }

  async function save() {
    setBusy(true);
    const stored = storedAt ? new Date(storedAt).toISOString() : new Date().toISOString();
    try {
      const res = await fetch("/api/food", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: rows.filter((r) => r.name.trim()).map((r) => ({
          name: r.name, category: r.category, photoId, locationId, storedAt: stored,
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
      {photoId ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photo/${photoId}`} alt="食物照片" className="max-h-64 w-full object-cover" />
          <label className="block cursor-pointer py-3 text-center text-sm font-medium text-[#3e9e73]">
            重拍 / 換照片
            <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
          </label>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#5fbe91]/50 bg-white py-8 text-center">
          <span className="text-3xl">📷</span>
          <span className="text-sm font-medium text-[#3e9e73]">拍照或選相簿</span>
          <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
        </label>
      )}

      {recognizing && (
        <div className="rounded-2xl bg-white p-4 text-center text-sm text-[#8a8178] shadow-sm">辨識中…</div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">存放點</label>
            <LocationChips locations={locations} selected={locationId} onSelect={setLocationId} allowAll={false} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8a8178]">放入時間（預設＝拍照時間）</label>
            <input className={inputCls} type="datetime-local" value={storedAt} onChange={(e) => changeStoredAt(e.target.value)} />
          </div>

          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
              <input className={inputCls} placeholder="名稱" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
              <select className={inputCls} value={r.category} onChange={(e) => changeCategory(r.id, e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <label className="text-xs text-[#8a8178]">到期日（AI 估算，可改）</label>
              <input className={inputCls} type="date" value={r.expiresAt} onChange={(e) => update(r.id, { expiresAt: e.target.value, expiryEdited: true })} />
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

- [ ] **Step 2: tsc + vitest + build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: 全綠/成功。

- [ ] **Step 3: Commit**
```bash
git add src/components/AddFoodForm.tsx
git commit -m "feat(food): photo preview atop add form + AI-estimated editable expiry per item"
```

---

## 部署（實作 + 本機驗證全綠、合併 main 後）

1. 合併 main（無 schema 變更）。
2. `npx zeabur@latest service redeploy --id 6a2d5ceed131a64afc9f3e19 -y -i=false` → 等 RUNNING。
3. **真機 QA（320 + 390px）**：
   - 狀態膠囊「安全」不換行；到期日獨立行不截斷。
   - 文字是租寓灰、主色租寓綠，無金色/米色字。
   - 新增頁：拍照後照片顯示在最上方 + 「重拍」；到期日自動帶出（AI 估算）可直接改；改類別/放入時間會重算（手動改過的不被覆蓋）。
   - `/admin`、`/admin/locations` 載入失敗有「重新整理」；存放點三鈕窄螢幕不爆。

---

## Self-Review 註記

- **Spec coverage**：配色/字型對齊(T1)、StatusPill 安全+不換行+調色(T2)、首頁到期日獨立行(T3)、admin retry 三態 + 按鈕防爆(T4)、shelf-life API + 辨識附估算(T5)、新增頁照片置頂 + 到期日預填可編輯重算(T6)、部署/QA。皆涵蓋。
- **不改 schema / 邏輯**：只動呈現 + 兩個唯讀 API + 辨識回應多帶一欄。
- **Placeholder scan**：無 TBD；新檔/全檔替換完整，既有檔精確 edit。
- **一致性**：`estimateExpiry(category, storedAt, shelf)` 用既有 `@/lib/expiry`（回 Date|null）；AddFoodForm client 端 `estimate()` 自算（回 YYYY-MM-DD 字串）兩者都用 `days*86400000`；`expiryEdited` 旗標一致；StatusPill `ok` label 與測試一致；文字色 `#3c4650` 全域一致。
- **雷**：T1 sed 取代是純色碼字串替換（`#2d2a26` 不是任何 code identifier）；T6 全檔替換注意 `changeCategory`/`changeStoredAt` 取代原本 inline onChange；photos 估算用 capturedAt（不是 upload time）才跟「放入時間預設＝拍照時間」一致。
```
