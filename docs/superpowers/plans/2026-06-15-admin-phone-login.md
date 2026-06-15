# 管理員功能 + 電話登入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 App 從「免登入單一 household」改成「電話登入(不驗證) + 管理員白名單」的存取控制,管理員可增刪使用者,冰箱清單維持全家共用。

**Architecture:** 登入後發一個 HMAC 簽章的 HttpOnly cookie(內含 userId)。middleware 驗簽章放行,`getCurrentUser()` 每請求回 DB 確認使用者仍在名單。管理員以寫死常數 `ADMIN_PHONE` 判定。沿用既有 `User`/`Household` 表與既有 household 資料。

**Tech Stack:** Next.js 16 (App Router) + TypeScript、Prisma 7 + Postgres、Web Crypto(HMAC-SHA256,edge/node 共用)、vitest。

**Spec:** `docs/superpowers/specs/2026-06-15-admin-phone-login-design.md`

---

## File Structure

- `prisma/schema.prisma` — modify：`User.phone String? @unique`、`User.lineUserId String?`
- `src/lib/auth/phone.ts` (+ `.test.ts`) — `normalizePhone`
- `src/lib/auth/admin.ts` (+ `.test.ts`) — `ADMIN_PHONE`、`isAdminPhone`
- `src/lib/auth/cookie.ts` (+ `.test.ts`) — `signSession`/`verifySession`(Web Crypto)
- `src/lib/auth/authorize.ts` (+ `.test.ts`) — `resolveLogin`
- `src/lib/household.ts` — modify：加 `getSharedHousehold`
- `src/lib/session.ts` — modify：`getCurrentUser` 改讀 cookie；型別改為可 null；加 `SESSION_COOKIE` 常數
- `src/app/api/auth/login/route.ts` / `logout/route.ts` — new
- `src/app/api/admin/users/route.ts`(GET/POST)、`src/app/api/admin/users/[id]/route.ts`(DELETE) — new
- `src/app/login/page.tsx` + `src/components/LoginForm.tsx` — new
- `src/app/admin/page.tsx` + `src/components/AdminUsers.tsx` — new
- `src/app/page.tsx` — modify：null user → redirect、管理員入口、登出
- `src/middleware.ts` — new
- `.env.example` — modify：加 `SESSION_SECRET`

---

### Task 1: Schema — phone 欄位 + lineUserId 選填

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 改 `User` model**

把 `User` 內這兩行：
```prisma
  id          String             @id @default(cuid())
  lineUserId  String             @unique
```
改成：
```prisma
  id          String             @id @default(cuid())
  phone       String?            @unique
  lineUserId  String?            @unique
```
（其餘欄位不動。）

- [ ] **Step 2: 重新產生 client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`

- [ ] **Step 3: 型別檢查通過**

Run: `npx tsc --noEmit`
Expected: 可能在 `household.ts`/`session.ts` 報 `lineUserId` 相關錯（之後任務會改）。若只有這些預期錯誤可先繼續；本步驟目的是確認 schema 本身合法、client 有產出。

- [ ] **Step 4: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add User.phone unique, make lineUserId optional"
```

---

### Task 2: 電話正規化 `normalizePhone`

**Files:**
- Create: `src/lib/auth/phone.ts`
- Test: `src/lib/auth/phone.test.ts`

- [ ] **Step 1: 寫失敗測試**

```ts
import { describe, it, expect } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("strips dashes and spaces", () => {
    expect(normalizePhone("0926-571-988")).toBe("0926571988");
    expect(normalizePhone(" 0926 571 988 ")).toBe("0926571988");
  });
  it("converts +886 prefix to leading 0", () => {
    expect(normalizePhone("+886926571988")).toBe("0926571988");
    expect(normalizePhone("886-926-571-988")).toBe("0926571988");
  });
  it("keeps a plain 10-digit number", () => {
    expect(normalizePhone("0926571988")).toBe("0926571988");
  });
  it("returns empty string for input with no digits", () => {
    expect(normalizePhone("abc")).toBe("");
    expect(normalizePhone("")).toBe("");
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/auth/phone.test.ts`
Expected: FAIL（找不到模組 `./phone`）

- [ ] **Step 3: 實作**

```ts
// src/lib/auth/phone.ts
// Normalize a Taiwan phone number to a comparable canonical form: digits only,
// with a leading-0 local format (+886 / 886 international prefix → 0).
export function normalizePhone(input: string): string {
  let digits = (input ?? "").replace(/\D/g, "");
  if (digits.startsWith("886")) digits = "0" + digits.slice(3);
  return digits;
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/auth/phone.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**
```bash
git add src/lib/auth/phone.ts src/lib/auth/phone.test.ts
git commit -m "feat(auth): phone normalization helper"
```

---

### Task 3: 管理員判定 `isAdminPhone`

**Files:**
- Create: `src/lib/auth/admin.ts`
- Test: `src/lib/auth/admin.test.ts`

- [ ] **Step 1: 寫失敗測試**

```ts
import { describe, it, expect } from "vitest";
import { ADMIN_PHONE, isAdminPhone } from "./admin";

describe("isAdminPhone", () => {
  it("matches the hardcoded admin phone (already normalized)", () => {
    expect(ADMIN_PHONE).toBe("0926571988");
    expect(isAdminPhone("0926571988")).toBe(true);
  });
  it("rejects any other number", () => {
    expect(isAdminPhone("0900000000")).toBe(false);
    expect(isAdminPhone("")).toBe(false);
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/auth/admin.test.ts`
Expected: FAIL（找不到模組）

- [ ] **Step 3: 實作**

```ts
// src/lib/auth/admin.ts
// The single admin is identified by a hardcoded, already-normalized phone.
// Compare callers must pass a normalizePhone()-ed value.
export const ADMIN_PHONE = "0926571988";

export function isAdminPhone(normalizedPhone: string): boolean {
  return normalizedPhone === ADMIN_PHONE;
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/auth/admin.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**
```bash
git add src/lib/auth/admin.ts src/lib/auth/admin.test.ts
git commit -m "feat(auth): hardcoded admin phone + isAdminPhone"
```

---

### Task 4: Session cookie 簽章 `signSession`/`verifySession`

**Files:**
- Create: `src/lib/auth/cookie.ts`
- Test: `src/lib/auth/cookie.test.ts`

- [ ] **Step 1: 寫失敗測試**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { signSession, verifySession } from "./cookie";

beforeAll(() => { process.env.SESSION_SECRET = "test-secret-please-change"; });

describe("session cookie", () => {
  it("round-trips a userId", async () => {
    const token = await signSession("user_123");
    expect(token).toContain(".");
    expect(await verifySession(token)).toBe("user_123");
  });
  it("rejects a tampered token", async () => {
    const token = await signSession("user_123");
    const tampered = token.replace("user_123", "user_999");
    expect(await verifySession(tampered)).toBeNull();
  });
  it("rejects garbage", async () => {
    expect(await verifySession("not-a-token")).toBeNull();
    expect(await verifySession("")).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/auth/cookie.test.ts`
Expected: FAIL（找不到模組）

- [ ] **Step 3: 實作（Web Crypto，無 Buffer 依賴,可在 edge/node 共用）**

```ts
// src/lib/auth/cookie.ts
// HMAC-SHA256 signed token "<userId>.<sig>". Uses Web Crypto + btoa/atob so it
// runs in both the edge middleware runtime and node route handlers.
function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

const encoder = new TextEncoder();

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function hmac(payload: string): Promise<string> {
  const key = await importKey(getSecret());
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toB64Url(new Uint8Array(sig));
}

export async function signSession(userId: string): Promise<string> {
  const sig = await hmac(userId);
  return `${userId}.${sig}`;
}

export async function verifySession(token: string): Promise<string | null> {
  if (!token || !token.includes(".")) return null;
  const idx = token.lastIndexOf(".");
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!userId) return null;
  const expected = await hmac(userId);
  // constant-time-ish compare
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? userId : null;
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/auth/cookie.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**
```bash
git add src/lib/auth/cookie.ts src/lib/auth/cookie.test.ts
git commit -m "feat(auth): HMAC-signed session cookie helpers"
```

---

### Task 5: `getSharedHousehold` helper

**Files:**
- Modify: `src/lib/household.ts`
- Test: `src/lib/household.test.ts`（檔案已存在,append 一個 describe）

- [ ] **Step 1: 寫失敗測試（append 到 `src/lib/household.test.ts`）**

```ts
import { describe, it, expect } from "vitest";
import { getSharedHousehold } from "./household";

describe("getSharedHousehold", () => {
  it("returns the existing household when one exists", async () => {
    const db = {
      household: {
        findFirst: async () => ({ id: "hh_1", name: "家" }),
        create: async () => { throw new Error("should not create"); },
      },
    } as any;
    const hh = await getSharedHousehold(db);
    expect(hh.id).toBe("hh_1");
  });
  it("creates a household when none exists", async () => {
    let created = false;
    const db = {
      household: {
        findFirst: async () => null,
        create: async ({ data }: any) => { created = true; return { id: "hh_new", name: data.name }; },
      },
    } as any;
    const hh = await getSharedHousehold(db);
    expect(created).toBe(true);
    expect(hh.id).toBe("hh_new");
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/household.test.ts`
Expected: FAIL（`getSharedHousehold` 未匯出）

- [ ] **Step 3: 實作（append 到 `src/lib/household.ts`）**

```ts
type HouseholdDb = { household: { findFirst: (args?: unknown) => Promise<{ id: string; name: string } | null>; create: (args: { data: { name: string } }) => Promise<{ id: string; name: string }> } };

// The app uses a single shared household for everyone. Return the existing one,
// or create it on first use. Created lazily so a fresh DB still works.
export async function getSharedHousehold(db: HouseholdDb): Promise<{ id: string; name: string }> {
  const existing = await db.household.findFirst();
  if (existing) return existing;
  return db.household.create({ data: { name: "我家的冰箱" } });
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/household.test.ts`
Expected: PASS（既有測試 + 新 2 tests）

- [ ] **Step 5: Commit**
```bash
git add src/lib/household.ts src/lib/household.test.ts
git commit -m "feat(auth): getSharedHousehold helper"
```

---

### Task 6: 登入授權 `resolveLogin`

**Files:**
- Create: `src/lib/auth/authorize.ts`
- Test: `src/lib/auth/authorize.test.ts`

- [ ] **Step 1: 寫失敗測試**

```ts
import { describe, it, expect } from "vitest";
import { resolveLogin } from "./authorize";

function fakeDb(users: Array<{ id: string; phone: string; householdId: string; displayName: string }>) {
  return {
    user: {
      findUnique: async ({ where }: any) => users.find((u) => u.phone === where.phone) ?? null,
      create: async ({ data }: any) => { const u = { id: "u_admin", ...data }; users.push(u); return u; },
    },
    household: {
      findFirst: async () => ({ id: "hh_1", name: "家" }),
      create: async ({ data }: any) => ({ id: "hh_1", name: data.name }),
    },
  } as any;
}

describe("resolveLogin", () => {
  it("returns null for an unauthorized phone", async () => {
    const db = fakeDb([]);
    expect(await resolveLogin("0900000000", db)).toBeNull();
  });
  it("returns an allowlisted user", async () => {
    const db = fakeDb([{ id: "u1", phone: "0911222333", householdId: "hh_1", displayName: "媽" }]);
    const u = await resolveLogin("0911-222-333", db);
    expect(u?.id).toBe("u1");
  });
  it("get-or-creates the admin user for the admin phone", async () => {
    const db = fakeDb([]);
    const u = await resolveLogin("0926-571-988", db);
    expect(u?.phone).toBe("0926571988");
    expect(u?.householdId).toBe("hh_1");
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/auth/authorize.test.ts`
Expected: FAIL（找不到模組）

- [ ] **Step 3: 實作**

```ts
// src/lib/auth/authorize.ts
import { normalizePhone } from "./phone";
import { isAdminPhone } from "./admin";
import { getSharedHousehold } from "../household";

export interface AuthUser { id: string; phone: string | null; householdId: string; displayName: string }

type AuthorizeDb = {
  user: {
    findUnique: (args: { where: { phone: string } }) => Promise<AuthUser | null>;
    create: (args: { data: { phone: string; displayName: string; householdId: string } }) => Promise<AuthUser>;
  };
  household: Parameters<typeof getSharedHousehold>[0]["household"] extends never ? never : any;
};

// Decide whether a phone may log in, and return the corresponding user.
// - admin phone: get-or-create the admin user (so the admin works on a fresh DB)
// - allowlisted phone: return that user
// - anything else: null (unauthorized)
export async function resolveLogin(rawPhone: string, db: any): Promise<AuthUser | null> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) return existing;
  if (isAdminPhone(phone)) {
    const hh = await getSharedHousehold(db);
    return db.user.create({ data: { phone, displayName: "管理員", householdId: hh.id } });
  }
  return null;
}
```

> 註：`AuthorizeDb` 型別僅為文件用途；實作以 `db: any` 接 Prisma client，測試以 fake db 注入。保持簡單。

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/auth/authorize.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**
```bash
git add src/lib/auth/authorize.ts src/lib/auth/authorize.test.ts
git commit -m "feat(auth): resolveLogin authorization logic"
```

---

### Task 7: 改寫 `getCurrentUser` 讀 cookie

**Files:**
- Modify: `src/lib/session.ts`

- [ ] **Step 1: 全檔替換**

```ts
// src/lib/session.ts
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/cookie";
import { isAdminPhone } from "@/lib/auth/admin";

export const SESSION_COOKIE = "fridge_session";

export interface CurrentUser {
  id: string;
  householdId: string;
  phone: string | null;
  name: string;
  isAdmin: boolean;
}

// Reads the signed session cookie and re-confirms the user still exists in the
// DB on every request — so deleting a user immediately revokes their access.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = await verifySession(token);
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    id: user.id,
    householdId: user.householdId,
    phone: user.phone,
    name: user.displayName,
    isAdmin: !!user.phone && isAdminPhone(user.phone),
  };
}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: `page.tsx` 會報錯（`user.householdId` possibly null）— 預期,Task 13 修。其餘 API route 因早有 `if (!user)` 應 OK。若 `household.ts` 仍有舊 `ensureUserAndHousehold` 用到 `lineUserId` 必填的型別問題,確認其 `LineProfile.lineUserId` 仍是 string（建立時帶值)即可,不需改。

- [ ] **Step 3: 全測試仍綠**

Run: `npx vitest run`
Expected: PASS（既有 + 新增,session.ts 無單元測試,靠後續整合）

- [ ] **Step 4: Commit**
```bash
git add src/lib/session.ts
git commit -m "feat(auth): getCurrentUser reads signed cookie + DB recheck"
```

---

### Task 8: 登入 / 登出 API

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`

- [ ] **Step 1: 登入 route**

```ts
// src/app/api/auth/login/route.ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolveLogin } from "@/lib/auth/authorize";
import { signSession } from "@/lib/auth/cookie";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const user = await resolveLogin(phone, db);
  if (!user) return Response.json({ error: "此電話未獲授權，請聯絡管理員" }, { status: 403 });
  const token = await signSession(user.id);
  const res = Response.json({ ok: true });
  res.headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 365}`,
  );
  return res;
}
```

- [ ] **Step 2: 登出 route**

```ts
// src/app/api/auth/logout/route.ts
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append("set-cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
  return res;
}
```

- [ ] **Step 3: 型別檢查 + build**

Run: `npx tsc --noEmit`
Expected: 同 Task 7（僅 page.tsx 預期錯）

- [ ] **Step 4: Commit**
```bash
git add src/app/api/auth
git commit -m "feat(auth): login/logout API routes"
```

---

### Task 9: Middleware 登入牆

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: 實作**

```ts
// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/cookie";
import { SESSION_COOKIE } from "@/lib/session";

// Paths that must stay reachable without a session.
const PUBLIC_PREFIXES = ["/login", "/api/auth/login", "/api/cron/remind"];

export async function middleware(req: NextRequest) {
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
  // Exclude Next internals and PWA/static assets so the login page itself loads.
  matcher: ["/((?!_next/|favicon.ico|manifest.json|sw.js|icons/|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest)$).*)"],
};
```

- [ ] **Step 2: build 驗證 middleware 編得過**

Run: `npx next build`
Expected: build 成功（會列出 Middleware）。若 middleware 因 Web Crypto/edge 限制報錯,確認 `cookie.ts` 未用到 Node-only API（本實作只用 Web Crypto + btoa,符合）。

- [ ] **Step 3: Commit**
```bash
git add src/middleware.ts
git commit -m "feat(auth): middleware login wall (cron + login excluded)"
```

---

### Task 10: 管理員使用者 API

**Files:**
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/[id]/route.ts`

- [ ] **Step 1: list + create route**

```ts
// src/app/api/admin/users/route.ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { normalizePhone } from "@/lib/auth/phone";
import { isAdminPhone } from "@/lib/auth/admin";
import { getSharedHousehold } from "@/lib/household";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  return Response.json({
    users: users.map((u) => ({ id: u.id, phone: u.phone, name: u.displayName, createdAt: u.createdAt, isAdmin: !!u.phone && isAdminPhone(u.phone) })),
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(typeof body?.phone === "string" ? body.phone : "");
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!phone) return Response.json({ error: "電話格式不正確" }, { status: 400 });
  if (!name) return Response.json({ error: "請填名字" }, { status: 400 });
  if (isAdminPhone(phone)) return Response.json({ error: "管理員帳號已存在，無需新增" }, { status: 400 });
  const dup = await db.user.findUnique({ where: { phone } });
  if (dup) return Response.json({ error: "此電話已在名單中" }, { status: 409 });
  const hh = await getSharedHousehold(db);
  const created = await db.user.create({ data: { phone, displayName: name, householdId: hh.id } });
  return Response.json({ id: created.id, phone: created.phone, name: created.displayName, createdAt: created.createdAt });
}
```

- [ ] **Step 2: delete route**

```ts
// src/app/api/admin/users/[id]/route.ts
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  if (id === admin.id) return Response.json({ error: "不能刪除自己（管理員）" }, { status: 400 });
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return Response.json({ error: "找不到此使用者" }, { status: 404 });
  // Remove their push subscriptions first (FK), then the user.
  await db.pushSubscription.deleteMany({ where: { userId: id } });
  await db.user.delete({ where: { id } });
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 僅 page.tsx 預期錯（Task 13 修）

- [ ] **Step 4: Commit**
```bash
git add src/app/api/admin
git commit -m "feat(admin): list/add/delete users API (admin-guarded)"
```

---

### Task 11: `/login` 頁面

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/components/LoginForm.tsx`

- [ ] **Step 1: page（server wrapper）**

```tsx
// src/app/login/page.tsx
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center p-6">
      <h1 className="mb-2 text-2xl font-bold">冰箱食物追蹤</h1>
      <p className="mb-6 text-sm text-gray-500">請用電話登入</p>
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 2: client form**

```tsx
// src/components/LoginForm.tsx
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
        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[#5FBE91] px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {loading ? "登入中…" : "登入"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 僅 page.tsx 預期錯

- [ ] **Step 4: Commit**
```bash
git add src/app/login src/components/LoginForm.tsx
git commit -m "feat(auth): /login page + phone login form"
```

---

### Task 12: `/admin` 頁面

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/components/AdminUsers.tsx`

- [ ] **Step 1: page（server，擋非管理員）**

```tsx
// src/app/admin/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AdminUsers } from "@/components/AdminUsers";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");
  return (
    <main className="mx-auto max-w-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">使用者管理</h1>
        <Link href="/" className="text-sm text-gray-500">‹ 返回</Link>
      </div>
      <AdminUsers />
    </main>
  );
}
```

- [ ] **Step 2: client component（list + add + delete）**

```tsx
// src/components/AdminUsers.tsx
"use client";
import { useEffect, useState } from "react";

interface UserRow { id: string; phone: string | null; name: string; createdAt: string; isAdmin: boolean }

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

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

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold">新增使用者</h2>
        <div className="flex flex-col gap-2">
          <input type="text" placeholder="名字（例：媽）" value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-gray-300 px-3 py-2" required />
          <input type="tel" inputMode="tel" placeholder="電話（例：0912-345-678）" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded border border-gray-300 px-3 py-2" required />
          <button type="submit" disabled={adding} className="rounded bg-[#5FBE91] px-4 py-2 font-semibold text-white disabled:opacity-50">{adding ? "新增中…" : "新增"}</button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">載入中…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <div className="font-semibold">{u.name}{u.isAdmin && <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">管理員</span>}</div>
                <div className="text-sm text-gray-500">{u.phone}</div>
              </div>
              {!u.isAdmin && (
                <button onClick={() => remove(u.id, u.name)} className="text-sm text-red-700">刪除</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 僅 page.tsx 預期錯（下一個任務修）

- [ ] **Step 4: Commit**
```bash
git add src/app/admin src/components/AdminUsers.tsx
git commit -m "feat(admin): /admin page with user list + add/delete"
```

---

### Task 13: 首頁 — null 導向、管理入口、登出

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 全檔替換**

```tsx
// src/app/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { FoodList } from "@/components/FoodList";
import { EnablePush } from "@/components/EnablePush";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const hh = await db.household.findUnique({ where: { id: user.householdId } });
  return (
    <main className="mx-auto max-w-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">冰箱清單</h1>
        <div className="flex items-center gap-3">
          {user.isAdmin && <Link href="/admin" className="text-sm text-gray-600">⚙️ 管理</Link>}
          <LogoutButton />
          <Link href="/add" className="rounded bg-black px-3 py-1 text-white">＋ 新增</Link>
        </div>
      </div>
      <EnablePush vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
      <FoodList leadDays={hh?.reminderLeadDays ?? 2} />
    </main>
  );
}
```

- [ ] **Step 2: 新增登出按鈕 component**

```tsx
// src/components/LogoutButton.tsx
"use client";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return <button onClick={logout} className="text-sm text-gray-500">登出</button>;
}
```

- [ ] **Step 3: 型別檢查 + 全測試 + build**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: tsc 0 錯；vitest 全綠；build 成功。**此時整包應 0 型別錯。**

- [ ] **Step 4: Commit**
```bash
git add src/app/page.tsx src/components/LogoutButton.tsx
git commit -m "feat(auth): home redirects when logged out + admin link + logout"
```

---

### Task 14: 環境變數範本 + 最終驗證

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: 加 `SESSION_SECRET`（在 `# Cron auth` 之前）**

```
# Session 簽章密鑰（強隨機）— 產生：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=""
```

- [ ] **Step 2: 全套最終驗證**

Run: `npx vitest run && npx tsc --noEmit && npx next build`
Expected: 全綠、0 錯、build 成功。

- [ ] **Step 3: Commit**
```bash
git add .env.example
git commit -m "docs: document SESSION_SECRET env var"
```

---

## 部署（實作完成後執行，沿用專案 CLAUDE.md 流程）

> 這些是部署步驟,非 coding 任務。實作 + 本機驗證全綠後再做。

1. **設 `SESSION_SECRET`** 到 Zeabur `web` 服務（service id `6a2d5ceed131a64afc9f3e19`）：
   `npx zeabur@latest variable create --id 6a2d5ceed131a64afc9f3e19 -k "SESSION_SECRET=<強隨機>" -y -i=false`
2. **prod DB schema 更新**（Postgres 對外 TCP + 本機跑,連線字串見 CLAUDE.md/`service network`）：
   `DATABASE_URL="postgresql://root:<pw>@<host>:<port>/zeabur" npx prisma db push`
3. **重新部署 web**：`npx zeabur@latest service redeploy --id 6a2d5ceed131a64afc9f3e19 -y -i=false`，等 `deployment list` 顯示 RUNNING。
4. **Smoke test**：
   - 未登入訪 `https://food-expiration-tracker.zeabur.app/` → 應 307/redirect 到 `/login`
   - `POST /api/auth/login {"phone":"0926571988"}` → 回 `set-cookie` + `{ok:true}`；帶 cookie 訪 `/admin` → 200
   - `POST /api/auth/login {"phone":"0900000000"}` → 403 未授權
   - `GET /api/cron/remind`（帶 `CRON_SECRET`）→ 不受登入牆影響
5. 可順手清掉殘留 env（`NEXTAUTH_SECRET` / `LINE_LOGIN_*` / `AUTH_TRUST_HOST`）。

---

## Self-Review 註記

- **Spec coverage**：資料模型(T1)、normalizePhone(T2)、admin(T3)、cookie(T4)、getSharedHousehold(T5)、resolveLogin(T6)、getCurrentUser(T7)、login/logout(T8)、middleware 含 cron 放行(T9)、admin API 含權限守衛/不可刪自己/連帶刪 push(T10)、/login(T11)、/admin(T12)、首頁 null 導向+管理入口+登出(T13)、SESSION_SECRET(T14)、既有資料以 householdId 共用(T5+T13)。皆有對應任務。
- **型別一致**：`SESSION_COOKIE`、`getCurrentUser(): CurrentUser|null`、`isAdmin` 欄位、`resolveLogin(rawPhone, db)`、`getSharedHousehold(db)` 全程一致。
- **Next 16 雷**：middleware 用絕對 URL（`new URL("/login", req.url)`）；`cookies()` 以 `await` 取用；cookie 簽章用 Web Crypto（edge 相容）。實作前若不確定 Next 16 API,依 AGENTS.md 查 `node_modules/next/dist/docs/`。
