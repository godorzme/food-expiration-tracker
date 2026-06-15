# 照片顯示 + 「誰加的食物」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 冰箱清單每筆食物顯示縮圖（點擊放大）與加入者名字；並完成 middleware→proxy 改名與刪除舊測試帳號。

**Architecture:** 照片用 MinIO 公開網域 presigned URL serve（簽名 client 走 `S3_PUBLIC_ENDPOINT`，上傳 client 走內部 `S3_ENDPOINT`）。`/api/food` 為每筆附 `photoUrl`（presigned）與 `createdByName`（household 成員 id→名字對照）。

**Tech Stack:** Next.js 16 App Router、Prisma 7、@aws-sdk/client-s3 + s3-request-presigner、vitest。

**Spec:** `docs/superpowers/specs/2026-06-15-photo-display-and-attribution-design.md`

---

## File Structure

- `src/lib/storage.ts` — modify：重構成 lazy client（讀 env at call time），新增 presign client 走 `S3_PUBLIC_ENDPOINT`
- `src/lib/storage.test.ts` — new：getPhotoUrl 簽名 endpoint 測試
- `src/lib/foodView.ts` (+ test) — new：`buildCreatorNameMap` / `creatorNameFor`
- `src/app/api/food/route.ts` — modify GET：DTO 加 `photoUrl` + `createdByName`
- `src/components/PhotoLightbox.tsx` — new：點擊放大的 lightbox client 元件
- `src/components/FoodList.tsx` — modify：縮圖 + lightbox + 加入者小字
- `src/proxy.ts` — new（由 `src/middleware.ts` 改名而來）
- `src/middleware.ts` — delete
- `.env.example` — modify：加 `S3_PUBLIC_ENDPOINT`

---

### Task 1: storage.ts — lazy clients + 公開 endpoint 簽名

**Files:**
- Modify: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/storage.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { getPhotoUrl } from "./storage";

const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

describe("getPhotoUrl", () => {
  it("signs against S3_PUBLIC_ENDPOINT when set", async () => {
    process.env.S3_PUBLIC_ENDPOINT = "https://photos.example.com";
    process.env.S3_ENDPOINT = "http://minio.internal:9000";
    process.env.S3_ACCESS_KEY = "k";
    process.env.S3_SECRET_KEY = "s";
    process.env.S3_BUCKET = "zeabur";
    process.env.S3_FORCE_PATH_STYLE = "true";
    const url = await getPhotoUrl("hh1/abc.jpg");
    expect(url.startsWith("https://photos.example.com")).toBe(true);
    expect(url).toContain("zeabur");
    expect(url).toContain("X-Amz-Signature");
  });

  it("falls back to S3_ENDPOINT when no public endpoint set", async () => {
    delete process.env.S3_PUBLIC_ENDPOINT;
    process.env.S3_ENDPOINT = "http://minio.internal:9000";
    process.env.S3_ACCESS_KEY = "k";
    process.env.S3_SECRET_KEY = "s";
    process.env.S3_BUCKET = "zeabur";
    process.env.S3_FORCE_PATH_STYLE = "true";
    const url = await getPhotoUrl("abc.jpg");
    expect(url).toContain("minio.internal:9000");
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL（目前 getPhotoUrl 用模組層 client，URL host 不會跟著 `S3_PUBLIC_ENDPOINT` 走）

- [ ] **Step 3: 全檔替換 storage.ts**

```ts
// src/lib/storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// All config is read at call time (not module load) so the upload path and the
// presign path can target different endpoints, and so tests can vary env.

function bucket(): string {
  return process.env.S3_BUCKET || process.env.R2_BUCKET || "";
}

function r2Endpoint(): string | undefined {
  return process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined;
}

function makeClient(endpoint: string | undefined): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint,
    // MinIO/RustFS need path-style; default on when any S3 endpoint is configured.
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE
      ? process.env.S3_FORCE_PATH_STYLE === "true"
      : !!(process.env.S3_ENDPOINT || process.env.S3_PUBLIC_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_KEY || process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });
}

// Server→storage uploads use the internal endpoint (fast, no egress charge).
function uploadClient(): S3Client {
  return makeClient(process.env.S3_ENDPOINT || r2Endpoint());
}

// Presigned GET URLs must be signed against the PUBLIC endpoint so a browser can
// fetch them; signing covers the host, so the signing client must use that host.
function presignClient(): S3Client {
  return makeClient(process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || r2Endpoint());
}

export async function putPhoto(key: string, bytes: Uint8Array, contentType: string) {
  await uploadClient().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: bytes, ContentType: contentType }),
  );
  return key;
}

export async function getPhotoUrl(key: string, expiresInSec = 3600) {
  return getSignedUrl(presignClient(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: expiresInSec,
  });
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: 確認沒打壞既有測試 + 型別**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 全綠、tsc 0 錯

- [ ] **Step 6: Commit**
```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat(storage): presign photo URLs against public endpoint (S3_PUBLIC_ENDPOINT)"
```
（commit body 末行加：`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`，用 heredoc。）

---

### Task 2: foodView.ts — 加入者名字對照

**Files:**
- Create: `src/lib/foodView.ts`
- Test: `src/lib/foodView.test.ts`

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/foodView.test.ts
import { describe, it, expect } from "vitest";
import { buildCreatorNameMap, creatorNameFor } from "./foodView";

describe("creator name mapping", () => {
  const members = [
    { id: "u1", displayName: "媽" },
    { id: "u2", displayName: "老公" },
  ];
  it("builds an id→name map", () => {
    expect(buildCreatorNameMap(members)).toEqual({ u1: "媽", u2: "老公" });
  });
  it("resolves a known creator", () => {
    expect(creatorNameFor("u1", buildCreatorNameMap(members))).toBe("媽");
  });
  it("returns null for unknown / missing creator", () => {
    const map = buildCreatorNameMap(members);
    expect(creatorNameFor("gone", map)).toBeNull();
    expect(creatorNameFor(null, map)).toBeNull();
    expect(creatorNameFor(undefined, map)).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/foodView.test.ts`
Expected: FAIL（找不到模組）

- [ ] **Step 3: 實作**

```ts
// src/lib/foodView.ts
export interface MemberLike { id: string; displayName: string }

export function buildCreatorNameMap(members: MemberLike[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of members) map[m.id] = m.displayName;
  return map;
}

export function creatorNameFor(
  createdBy: string | null | undefined,
  map: Record<string, string>,
): string | null {
  if (!createdBy) return null;
  return map[createdBy] ?? null;
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/foodView.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**
```bash
git add src/lib/foodView.ts src/lib/foodView.test.ts
git commit -m "feat(food): creator id→name mapping helpers"
```
（commit body 末行加 Co-Authored-By trailer。）

---

### Task 3: /api/food GET — DTO 加 photoUrl + createdByName

**Files:**
- Modify: `src/app/api/food/route.ts`（只改 GET，POST 不動）

- [ ] **Step 1: 替換 GET handler**

把現有的 `export async function GET()` 整段替換為：

```ts
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const [items, members] = await Promise.all([
    db.foodItem.findMany({
      where: { householdId: user.householdId, status: "active" },
      orderBy: [{ expiresAt: "asc" }],
      include: { photo: true },
    }),
    db.user.findMany({ where: { householdId: user.householdId } }),
  ]);
  const nameMap = buildCreatorNameMap(members);
  const dto = await Promise.all(
    items.map(async (it) => ({
      id: it.id,
      name: it.name,
      category: it.category,
      storedAt: it.storedAt,
      expiresAt: it.expiresAt,
      photoUrl: it.photo?.objectKey ? await getPhotoUrl(it.photo.objectKey) : null,
      createdByName: creatorNameFor(it.createdBy, nameMap),
    })),
  );
  return Response.json({ items: dto });
}
```

- [ ] **Step 2: 補 imports（在檔案頂部既有 import 群）**

```ts
import { getPhotoUrl } from "@/lib/storage";
import { buildCreatorNameMap, creatorNameFor } from "@/lib/foodView";
```

- [ ] **Step 3: 型別 + 測試 + build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: tsc 0 錯；vitest 全綠；build 成功。

- [ ] **Step 4: Commit**
```bash
git add src/app/api/food/route.ts
git commit -m "feat(food): include photoUrl + createdByName in food list API"
```
（commit body 末行加 Co-Authored-By trailer。）

---

### Task 4: FoodList 縮圖 + lightbox + 加入者小字

**Files:**
- Create: `src/components/PhotoLightbox.tsx`
- Modify: `src/components/FoodList.tsx`

- [ ] **Step 1: 建 PhotoLightbox 元件**

```tsx
// src/components/PhotoLightbox.tsx
"use client";
import { useEffect } from "react";

export function PhotoLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="關閉"
        className="absolute right-4 top-4 text-3xl leading-none text-white"
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
```

- [ ] **Step 2: 改 FoodList — DTO 欄位 + 縮圖 + lightbox + 加入者**

`src/components/FoodList.tsx`：

(a) 在 `import` 區加：
```tsx
import { PhotoLightbox } from "@/components/PhotoLightbox";
```

(b) 把 `FoodItemDTO` 介面替換為：
```tsx
interface FoodItemDTO {
  id: string;
  name: string;
  category: string;
  storedAt: string;
  expiresAt: string | null;
  photoUrl?: string | null;
  createdByName?: string | null;
}
```

(c) 在 `FoodList` 元件函式體最前面（`const now = ...` 那行之後）加 lightbox 狀態：
```tsx
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
```

(d) 把 `return (...)` 的清單渲染整段替換為（保留既有顏色/吃掉/丟掉邏輯，新增縮圖與加入者）：
```tsx
  return (
    <>
      <ul className="flex flex-col gap-2">
        {items.map((it) => {
          const exp = it.expiresAt ? new Date(it.expiresAt) : null;
          const state = expiryState(exp, now, leadDays);
          return (
            <li key={it.id} className={`flex items-center gap-3 rounded-lg border-l-4 p-3 ${COLOR[state]}`}>
              {it.photoUrl ? (
                <img
                  src={it.photoUrl}
                  alt={it.name}
                  loading="lazy"
                  onClick={() => setLightbox({ src: it.photoUrl as string, alt: it.name })}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  className="h-14 w-14 flex-shrink-0 cursor-pointer rounded-md object-cover"
                />
              ) : null}
              <div className="flex flex-1 items-center justify-between">
                <div>
                  <div className="font-semibold">{it.name}</div>
                  <div className="text-sm text-gray-500">
                    {it.category} · 放入 {new Date(it.storedAt).toLocaleDateString()}
                    {exp ? ` · 到期 ${exp.toLocaleDateString()}` : " · 無到期日"}
                    {it.createdByName ? ` · ${it.createdByName} 加的` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="text-sm text-green-700" onClick={() => mark(it.id, "consumed")}>吃掉</button>
                  <button className="text-sm text-red-700" onClick={() => mark(it.id, "discarded")}>丟掉</button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {lightbox && <PhotoLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </>
  );
```

> 註：原本的 loading / error / 空清單三種早退 return（`if (loading) ...`、`if (error) ...`、`if (items.length === 0) ...`）保持不變，放在這段 return 之前。

- [ ] **Step 3: 型別 + 測試 + build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: tsc 0 錯；vitest 全綠（52）；build 成功。

- [ ] **Step 4: Commit**
```bash
git add src/components/PhotoLightbox.tsx src/components/FoodList.tsx
git commit -m "feat(food): thumbnail + tap-to-enlarge lightbox + creator name in list"
```
（commit body 末行加 Co-Authored-By trailer。）

---

### Task 5: middleware.ts → proxy.ts（Next 16）

**Files:**
- Create: `src/proxy.ts`
- Delete: `src/middleware.ts`

- [ ] **Step 1: 先查 Next 16 慣例**

依 AGENTS.md，確認 `node_modules/next/dist/docs/` 對 proxy 的說明：檔名 `proxy.ts`（與原 middleware 同層，即 `src/`）、匯出函式名為 `proxy`、`config`/`matcher` 維持。

- [ ] **Step 2: 建 src/proxy.ts**

內容與原 `src/middleware.ts` 完全相同，只把匯出函式名 `middleware` 改為 `proxy`：

```ts
// src/proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/cookie";

// Paths that must stay reachable without a session.
const PUBLIC_PREFIXES = ["/login", "/api/auth/login", "/api/cron/remind"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  const ok = !!(await verifySession(token));
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Absolute URL (Next 16 rejects relative redirect Locations).
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|manifest.json|sw.js|icons/|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest)$).*)"],
};
```

- [ ] **Step 3: 刪除舊檔**
```bash
git rm src/middleware.ts
```

- [ ] **Step 4: build 確認無 deprecation 警告 + 仍作用**

Run: `npx next build 2>&1 | grep -iE "deprecat|proxy|middleware|Compiled"`
Expected: 「Compiled successfully」、輸出仍顯示 Proxy（Middleware）作用中、**不再有 "middleware file convention is deprecated" 警告**。若改名後 Next 不認得，回 Step 1 重讀 docs 確認正確檔名/匯出。

- [ ] **Step 5: 確認 edge bundle 仍乾淨（沿用上次的雷）**

Run: `grep -rlE "node:util/types|adapter-pg|PrismaClient" .next/server/edge/ --include="*.js" || echo CLEAN`
Expected: `CLEAN`（proxy 只 import 自 edge-safe 的 `@/lib/auth/cookie`）

- [ ] **Step 6: 型別 + 測試**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc 0 錯、vitest 52 綠

- [ ] **Step 7: Commit**
```bash
git add src/proxy.ts
git commit -m "refactor(auth): rename middleware.ts to proxy.ts (Next 16 convention)"
```
（commit body 末行加 Co-Authored-By trailer。`git rm` 的刪除已 staged。）

---

### Task 6: .env.example — S3_PUBLIC_ENDPOINT

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: 在 S3 區塊加一行（`S3_FORCE_PATH_STYLE` 之後）**

```
S3_PUBLIC_ENDPOINT=""   # 照片看圖用的公開網域（綁在 MinIO 9000 port），presigned URL 以此簽名；本機留空則 fallback S3_ENDPOINT
```

- [ ] **Step 2: Commit**
```bash
git add .env.example
git commit -m "docs: document S3_PUBLIC_ENDPOINT env var"
```
（commit body 末行加 Co-Authored-By trailer。）

---

## 部署（實作 + 本機驗證全綠、合併 main 後執行）

> 機械任務 #4「刪舊帳號」是一次性資料操作，列在這裡。

1. **綁 MinIO 公開網域**：對 `minio` 服務（id `6a2f7968150d2427fabdc45e`）的 `web`(9000) port 綁一個網域（用 zeabur 網域 skill / Dashboard）。取得公開 endpoint，例如 `https://fridge-photos-api.zeabur.app`。
2. **設環境變數**：`npx zeabur@latest variable create --id 6a2d5ceed131a64afc9f3e19 -k "S3_PUBLIC_ENDPOINT=<公開網域>" -y -i=false`
3. **redeploy web**：`npx zeabur@latest service redeploy --id 6a2d5ceed131a64afc9f3e19 -y -i=false`，等 deployment list 該 commit 顯示 RUNNING。
4. **一次性刪舊「我」帳號**（Postgres 對外 TCP，連線見 CLAUDE.md）：
   執行一個 tsx 腳本：先 `db.pushSubscription.deleteMany({ where: { user: { lineUserId: "local-default" } } })`，再 `db.user.deleteMany({ where: { lineUserId: "local-default" } })`，印出刪除筆數。
5. **Smoke**：
   - 登入後上傳一張食物照 → `GET /api/food` 該筆有 `photoUrl` 且 `createdByName` 為登入者名字。
   - `curl -s -o /dev/null -w "%{http_code}" "<photoUrl>"` → 200（圖片真的讀得到）。
   - 未登入訪 `/` → 仍 307 導向 `/login`（proxy 作用正常）。
   - `GET /api/admin/users` 不再含「我」帳號。

---

## Self-Review 註記

- **Spec coverage**：照片 serve（Task 1 presign 公開 endpoint）、photoUrl+createdByName API（Task 3）、縮圖+lightbox+加入者 UI（Task 4）、誰加的對照（Task 2）、middleware→proxy（Task 5）、S3_PUBLIC_ENDPOINT 文件（Task 6）、刪舊帳號（部署步驟 4）、綁公開網域（部署步驟 1）。皆涵蓋。
- **Placeholder scan**：無 TBD；每段都有完整 code/指令。
- **Type consistency**：DTO 欄位 `photoUrl`/`createdByName` 在 Task 3（API）與 Task 4（FoodList 介面）一致；`getPhotoUrl`/`buildCreatorNameMap`/`creatorNameFor` 簽章跨 Task 一致；`SESSION_COOKIE`/`verifySession` 來源（`@/lib/auth/cookie`）與既有一致。
- **雷**：Task 5 沿用上次教訓——proxy 僅 import edge-safe 的 cookie 模組，並用 grep 驗證 edge bundle 不含 Prisma。
