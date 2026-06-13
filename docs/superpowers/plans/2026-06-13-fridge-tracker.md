# Fridge Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a family-shared web app to record food put into the fridge/cabinet by photo, auto-identify contents, track how long it has been stored, and remind everyone before food spoils.

**Architecture:** Next.js (App Router) full-stack monolith on Zeabur with PostgreSQL (Prisma). Original photos stored in Cloudflare R2. AI vision recognition via AI Hub (OpenAI-compatible). LINE Login for identity; LINE Messaging API + Web Push for reminders, triggered daily by GitHub Actions cron. PWA for "add to home screen" + Web Push.

**Tech Stack:** TypeScript, Next.js 15 (App Router), Prisma + PostgreSQL, Tailwind CSS, Cloudflare R2 (S3 SDK), `exifr`, `web-push`, LINE Login + Messaging API, Vitest for tests.

**Milestones (each ships working software):**
- M1 Foundation — scaffold, schema, LINE Login, household, auth guard
- M2 Record food — R2 upload, EXIF capture time, manual CRUD, in-app list with expiry states
- M3 AI recognition — vision recognition with editable, multi-item results
- M4 Reminders — shelf-life auto-estimate, daily cron, LINE + Web Push, dedup

**Conventions used throughout:**
- Domain logic lives in `src/lib/**` as pure functions with unit tests (`*.test.ts`) — no framework imports, so they test fast.
- Next.js route handlers/pages are thin adapters that call `src/lib/**`.
- Run a single test: `npx vitest run <path>`. Run all: `npx vitest run`.
- Commit after every passing step group.

---

## Milestone 1 — Foundation

### Task 1.1: Scaffold Next.js + TypeScript + Tailwind

**Files:**
- Create: project files via scaffolder in `/Users/zuyou/fridge-tracker`

- [ ] **Step 1: Scaffold into the existing repo**

The repo already exists with a `docs/` folder and git history. Scaffold into a temp dir and copy in, to avoid the "directory not empty" prompt.

```bash
cd /Users/zuyou/fridge-tracker
npx create-next-app@latest .tmp-scaffold \
  --typescript --tailwind --app --eslint \
  --src-dir --import-alias "@/*" --use-npm --no-turbopack
# move scaffold contents (including dotfiles) into repo root, keep our docs/ and .git/
shopt -s dotglob
mv .tmp-scaffold/* .
rm -rf .tmp-scaffold
shopt -u dotglob
```

- [ ] **Step 2: Verify dev server boots**

Run: `npm run dev` then open http://localhost:3000 — expect the Next.js starter page. Stop the server (Ctrl-C).

- [ ] **Step 3: Add Vitest**

```bash
npm install -D vitest @vitest/coverage-v8
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 4: Smoke test that Vitest runs**

Create `src/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => { it("runs", () => { expect(1 + 1).toBe(2); }); });
```

Run: `npx vitest run src/lib/smoke.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
rm src/lib/smoke.test.ts
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind and Vitest"
```

### Task 1.2: Prisma + PostgreSQL schema

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`, `.env.example`

- [ ] **Step 1: Install Prisma**

```bash
npm install @prisma/client
npm install -D prisma
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Write the schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model Household {
  id               String      @id @default(cuid())
  name             String
  reminderLeadDays Int         @default(2)
  createdAt        DateTime    @default(now())
  users            User[]
  locations        Location[]
  foodItems        FoodItem[]
}

model User {
  id            String   @id @default(cuid())
  lineUserId    String   @unique
  displayName   String
  pictureUrl    String?
  household     Household @relation(fields: [householdId], references: [id])
  householdId   String
  pushSubs      PushSubscription[]
  createdAt     DateTime @default(now())
}

model Location {
  id          String     @id @default(cuid())
  household   Household  @relation(fields: [householdId], references: [id])
  householdId String
  name        String
  foodItems   FoodItem[]
}

model Photo {
  id          String     @id @default(cuid())
  objectKey   String
  capturedAt  DateTime
  uploadedBy  String
  createdAt   DateTime   @default(now())
  foodItems   FoodItem[]
}

enum FoodStatus { active consumed discarded expired }

model FoodItem {
  id           String      @id @default(cuid())
  household    Household   @relation(fields: [householdId], references: [id])
  householdId  String
  photo        Photo?      @relation(fields: [photoId], references: [id])
  photoId      String?
  location     Location?   @relation(fields: [locationId], references: [id])
  locationId   String?
  name         String
  category     String
  storedAt     DateTime
  expiresAt    DateTime?
  status       FoodStatus  @default(active)
  createdBy    String
  notes        String?
  isRecognized Boolean     @default(false)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  reminders    ReminderLog[]
}

model ShelfLife {
  category    String @id
  defaultDays Int
}

model PushSubscription {
  id       String @id @default(cuid())
  user     User   @relation(fields: [userId], references: [id])
  userId   String
  endpoint String @unique
  p256dh   String
  auth     String
}

model ReminderLog {
  id         String   @id @default(cuid())
  foodItem   FoodItem @relation(fields: [foodItemId], references: [id])
  foodItemId String
  remindedOn DateTime @db.Date
  channel    String
  @@unique([foodItemId, remindedOn, channel])
}
```

- [ ] **Step 3: Create the Prisma client singleton**

Create `src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 4: Document env vars**

Create `.env.example`:

```
DATABASE_URL="postgresql://user:pass@localhost:5432/fridge"
# LINE
LINE_LOGIN_CHANNEL_ID=""
LINE_LOGIN_CHANNEL_SECRET=""
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=""
NEXTAUTH_SECRET=""
APP_BASE_URL="http://localhost:3000"
# Cloudflare R2
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET="fridge-photos"
# AI Hub
AI_HUB_BASE_URL=""
AI_HUB_API_KEY=""
AI_HUB_VISION_MODEL=""
# Web Push (VAPID) — generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:robynhuang@zuyou.com.tw"
# Cron auth
CRON_SECRET=""
```

Copy to a working `.env` and fill `DATABASE_URL` with a local Postgres (or a Zeabur dev DB).

- [ ] **Step 5: Generate client and push schema**

Run:
```bash
npx prisma generate
npx prisma db push
```
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema and db client"
```

### Task 1.3: LINE Login via NextAuth

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/lib/household.ts`, `src/lib/household.test.ts`

- [ ] **Step 1: Install NextAuth**

```bash
npm install next-auth
```

- [ ] **Step 2: Write the failing test for household-on-first-login logic**

The pure logic we test: given a LINE profile, `ensureUserAndHousehold` upserts a user and creates a household on first login. We test it against a mock db client (dependency-injected) so it stays a unit test.

Create `src/lib/household.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { ensureUserAndHousehold } from "./household";

function makeDb() {
  const state: any = { user: null };
  return {
    user: {
      findUnique: vi.fn(async () => state.user),
      create: vi.fn(async ({ data }: any) => (state.user = { id: "u1", ...data })),
    },
    household: {
      create: vi.fn(async ({ data }: any) => ({ id: "h1", ...data })),
    },
    _state: state,
  } as any;
}

describe("ensureUserAndHousehold", () => {
  it("creates household + user on first login", async () => {
    const db = makeDb();
    const user = await ensureUserAndHousehold(db, {
      lineUserId: "L1", displayName: "Robyn", pictureUrl: null,
    });
    expect(db.household.create).toHaveBeenCalledOnce();
    expect(db.user.create).toHaveBeenCalledOnce();
    expect(user.householdId).toBe("h1");
  });

  it("returns existing user without creating a household", async () => {
    const db = makeDb();
    db._state.user = { id: "u1", lineUserId: "L1", householdId: "h9" };
    const user = await ensureUserAndHousehold(db, {
      lineUserId: "L1", displayName: "Robyn", pictureUrl: null,
    });
    expect(db.household.create).not.toHaveBeenCalled();
    expect(user.householdId).toBe("h9");
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/lib/household.test.ts`
Expected: FAIL — cannot find module `./household`.

- [ ] **Step 4: Implement the logic**

Create `src/lib/household.ts`:

```ts
import type { PrismaClient } from "@prisma/client";

export interface LineProfile {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
}

type DbLike = Pick<PrismaClient, "user" | "household">;

export async function ensureUserAndHousehold(db: DbLike, profile: LineProfile) {
  const existing = await db.user.findUnique({ where: { lineUserId: profile.lineUserId } });
  if (existing) return existing;
  const household = await db.household.create({ data: { name: `${profile.displayName} 的家` } });
  return db.user.create({
    data: {
      lineUserId: profile.lineUserId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl ?? undefined,
      householdId: household.id,
    },
  });
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx vitest run src/lib/household.test.ts`
Expected: 2 passed.

- [ ] **Step 6: Wire NextAuth with the LINE provider**

Create `src/lib/auth.ts`:

```ts
import NextAuth from "next-auth";
import LineProvider from "next-auth/providers/line";
import { db } from "@/lib/db";
import { ensureUserAndHousehold } from "@/lib/household";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    LineProvider({
      clientId: process.env.LINE_LOGIN_CHANNEL_ID!,
      clientSecret: process.env.LINE_LOGIN_CHANNEL_SECRET!,
      authorization: { params: { scope: "openid profile" } },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.sub) return false;
      await ensureUserAndHousehold(db, {
        lineUserId: profile.sub as string,
        displayName: (profile.name as string) ?? "User",
        pictureUrl: (profile.picture as string) ?? null,
      });
      return true;
    },
    async session({ session, token }) {
      const lineUserId = token.sub!;
      const user = await db.user.findUnique({ where: { lineUserId } });
      if (user) {
        (session as any).user.id = user.id;
        (session as any).user.householdId = user.householdId;
        (session as any).user.lineUserId = user.lineUserId;
      }
      return session;
    },
  },
});
```

> Note: install NextAuth v5 (beta) which exports `handlers`/`auth`. If `npm install next-auth` pulled v4, run `npm install next-auth@beta`.

Create `src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: LINE Login via NextAuth + household bootstrap"
```

### Task 1.4: Auth guard + current-user helper + login page

**Files:**
- Create: `src/lib/session.ts`
- Create: `src/app/login/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Current-user helper**

Create `src/lib/session.ts`:

```ts
import { auth } from "@/lib/auth";

export interface CurrentUser { id: string; householdId: string; lineUserId: string; name: string; }

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const u = session?.user as any;
  if (!u?.id) return null;
  return { id: u.id, householdId: u.householdId, lineUserId: u.lineUserId, name: u.name ?? "" };
}
```

- [ ] **Step 2: Login page**

Create `src/app/login/page.tsx`:

```tsx
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">冰箱食物追蹤</h1>
      <p className="text-gray-500">用 LINE 登入,和家人共用同一份清單</p>
      <form action={async () => { "use server"; await signIn("line", { redirectTo: "/" }); }}>
        <button className="rounded-lg bg-[#06C755] px-6 py-3 font-semibold text-white">
          使用 LINE 登入
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Protect home page**

Replace `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">嗨 {user.name}</h1>
      <p className="text-gray-500">清單即將在 M2 完成。</p>
    </main>
  );
}
```

- [ ] **Step 4: Manual verification**

Set up a LINE Login channel (provider note below), fill `.env`, run `npm run dev`, visit `/` → redirected to `/login` → LINE login → back to `/` showing your name.

> **LINE provider setup (one-time, in LINE Developers Console):** Create ONE provider. Under it create (1) a *LINE Login* channel — put its Channel ID/secret in `LINE_LOGIN_*`, set callback URL `${APP_BASE_URL}/api/auth/callback/line`; and (2) a *Messaging API* channel — its access token goes in `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` (used in M4). Both under the same provider so the `userId` matches.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: auth guard, current-user helper, login page"
```

---

## Milestone 2 — Record food (photo upload, EXIF, manual CRUD, list)

### Task 2.1: EXIF capture-time extraction

**Files:**
- Create: `src/lib/exif.ts`, `src/lib/exif.test.ts`

- [ ] **Step 1: Install exifr**

```bash
npm install exifr
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/exif.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { resolveCapturedAt } from "./exif";

describe("resolveCapturedAt", () => {
  it("uses EXIF DateTimeOriginal when present", async () => {
    const exif = { DateTimeOriginal: new Date("2026-06-10T08:30:00Z") };
    const parse = vi.fn(async () => exif);
    const fallback = new Date("2026-06-13T00:00:00Z");
    const result = await resolveCapturedAt(new Uint8Array(), fallback, parse as any);
    expect(result.toISOString()).toBe("2026-06-10T08:30:00.000Z");
  });

  it("falls back to upload time when EXIF missing", async () => {
    const parse = vi.fn(async () => null);
    const fallback = new Date("2026-06-13T00:00:00Z");
    const result = await resolveCapturedAt(new Uint8Array(), fallback, parse as any);
    expect(result.toISOString()).toBe(fallback.toISOString());
  });

  it("falls back when parser throws", async () => {
    const parse = vi.fn(async () => { throw new Error("bad"); });
    const fallback = new Date("2026-06-13T00:00:00Z");
    const result = await resolveCapturedAt(new Uint8Array(), fallback, parse as any);
    expect(result.toISOString()).toBe(fallback.toISOString());
  });
});
```

- [ ] **Step 3: Run to confirm it fails**

Run: `npx vitest run src/lib/exif.test.ts`
Expected: FAIL — cannot find module `./exif`.

- [ ] **Step 4: Implement**

Create `src/lib/exif.ts`:

```ts
import exifr from "exifr";

type ParseFn = (input: Uint8Array) => Promise<{ DateTimeOriginal?: Date } | null>;

export async function resolveCapturedAt(
  bytes: Uint8Array,
  uploadTime: Date,
  parse: ParseFn = (b) => exifr.parse(b, ["DateTimeOriginal"]),
): Promise<Date> {
  try {
    const data = await parse(bytes);
    const dto = data?.DateTimeOriginal;
    if (dto instanceof Date && !Number.isNaN(dto.getTime())) return dto;
  } catch {
    // fall through to upload time
  }
  return uploadTime;
}
```

- [ ] **Step 5: Run to confirm it passes**

Run: `npx vitest run src/lib/exif.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: EXIF capture-time extraction with fallback"
```

### Task 2.2: R2 storage module

**Files:**
- Create: `src/lib/storage.ts`

- [ ] **Step 1: Install S3 SDK**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Implement the storage module**

Create `src/lib/storage.ts`:

```ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.R2_BUCKET!;

export async function putPhoto(key: string, bytes: Uint8Array, contentType: string) {
  await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: contentType }));
  return key;
}

export async function getPhotoUrl(key: string, expiresInSec = 3600) {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: expiresInSec });
}
```

> No unit test here — it's a thin SDK wrapper. Covered by the M2.4 integration test with the SDK mocked. Verified end-to-end in Task 2.5.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: R2 storage put/get module"
```

### Task 2.3: Category shelf-life seed + expiry estimator

**Files:**
- Create: `src/lib/expiry.ts`, `src/lib/expiry.test.ts`
- Create: `prisma/seed.ts`
- Modify: `package.json` (add prisma seed config)

- [ ] **Step 1: Write the failing test**

Create `src/lib/expiry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { estimateExpiry } from "./expiry";

const SHELF: Record<string, number> = { "熟食": 3, "葉菜": 5, "肉類": 2 };

describe("estimateExpiry", () => {
  it("adds category days to storedAt", () => {
    const r = estimateExpiry("熟食", new Date("2026-06-10T00:00:00Z"), SHELF);
    expect(r?.toISOString()).toBe("2026-06-13T00:00:00.000Z");
  });

  it("returns null for unknown category", () => {
    expect(estimateExpiry("外星食物", new Date(), SHELF)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run src/lib/expiry.test.ts`
Expected: FAIL — cannot find module `./expiry`.

- [ ] **Step 3: Implement**

Create `src/lib/expiry.ts`:

```ts
export function estimateExpiry(
  category: string,
  storedAt: Date,
  shelfLife: Record<string, number>,
): Date | null {
  const days = shelfLife[category];
  if (days == null) return null;
  return new Date(storedAt.getTime() + days * 24 * 60 * 60 * 1000);
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npx vitest run src/lib/expiry.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Seed the shelf-life table**

Create `prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const SHELF: Record<string, number> = {
  "熟食": 3, "葉菜": 5, "根莖蔬菜": 14, "水果": 7,
  "肉類": 2, "海鮮": 1, "乳製品": 7, "蛋": 21,
  "醬料": 30, "飲料": 7, "剩菜": 2, "其他": 5,
};

async function main() {
  for (const [category, defaultDays] of Object.entries(SHELF)) {
    await db.shelfLife.upsert({ where: { category }, update: { defaultDays }, create: { category, defaultDays } });
  }
}
main().finally(() => db.$disconnect());
```

Add to `package.json`:

```json
"prisma": { "seed": "npx tsx prisma/seed.ts" }
```

Install tsx: `npm install -D tsx`. Run: `npx prisma db seed`
Expected: completes with no error; `npx prisma studio` shows 12 ShelfLife rows.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: shelf-life seed + expiry estimator"
```

### Task 2.4: Create-food service (pure, testable core)

**Files:**
- Create: `src/lib/food.ts`, `src/lib/food.test.ts`

This is the decision core for "how is expiresAt resolved": manual value wins; else auto-estimate from category.

- [ ] **Step 1: Write the failing test**

Create `src/lib/food.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveExpiresAt } from "./food";

const SHELF = { "熟食": 3 };

describe("resolveExpiresAt", () => {
  it("uses manual expiresAt when provided", () => {
    const manual = new Date("2026-07-01T00:00:00Z");
    const r = resolveExpiresAt({ category: "熟食", storedAt: new Date("2026-06-10T00:00:00Z"), manualExpiresAt: manual }, SHELF);
    expect(r?.toISOString()).toBe(manual.toISOString());
  });

  it("auto-estimates when manual is null", () => {
    const r = resolveExpiresAt({ category: "熟食", storedAt: new Date("2026-06-10T00:00:00Z"), manualExpiresAt: null }, SHELF);
    expect(r?.toISOString()).toBe("2026-06-13T00:00:00.000Z");
  });

  it("returns null when no manual and unknown category", () => {
    const r = resolveExpiresAt({ category: "未知", storedAt: new Date(), manualExpiresAt: null }, SHELF);
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run src/lib/food.test.ts`
Expected: FAIL — cannot find module `./food`.

- [ ] **Step 3: Implement**

Create `src/lib/food.ts`:

```ts
import { estimateExpiry } from "./expiry";

export interface ResolveExpiryInput {
  category: string;
  storedAt: Date;
  manualExpiresAt: Date | null;
}

export function resolveExpiresAt(input: ResolveExpiryInput, shelfLife: Record<string, number>): Date | null {
  if (input.manualExpiresAt) return input.manualExpiresAt;
  return estimateExpiry(input.category, input.storedAt, shelfLife);
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npx vitest run src/lib/food.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: resolveExpiresAt — manual wins, else auto-estimate"
```

### Task 2.5: Photo upload API route

**Files:**
- Create: `src/app/api/photos/route.ts`
- Create: `src/lib/shelfLife.ts`

- [ ] **Step 1: Shelf-life loader (used by upload + create)**

Create `src/lib/shelfLife.ts`:

```ts
import { db } from "@/lib/db";

export async function loadShelfLife(): Promise<Record<string, number>> {
  const rows = await db.shelfLife.findMany();
  return Object.fromEntries(rows.map((r) => [r.category, r.defaultDays]));
}
```

- [ ] **Step 2: Upload route — stores original photo, returns photoId + capturedAt**

Create `src/app/api/photos/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { putPhoto } from "@/lib/storage";
import { resolveCapturedAt } from "@/lib/exif";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploadTime = new Date();
  const capturedAt = await resolveCapturedAt(bytes, uploadTime);

  const key = `${user.householdId}/${uploadTime.getTime()}-${file.name}`;
  await putPhoto(key, bytes, file.type || "image/jpeg");

  const photo = await db.photo.create({
    data: { objectKey: key, capturedAt, uploadedBy: user.id },
  });
  return NextResponse.json({ photoId: photo.id, capturedAt: capturedAt.toISOString() });
}
```

- [ ] **Step 3: Manual verification**

With `.env` R2 creds filled and dev server running, from the browser console on `/` (logged in):
```js
const fd = new FormData();
fd.append("file", new File([new Uint8Array([1,2,3])], "t.jpg", {type:"image/jpeg"}));
await (await fetch("/api/photos", {method:"POST", body: fd})).json();
```
Expected: `{ photoId: "...", capturedAt: "..." }`, and the object appears in the R2 bucket.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: photo upload API to R2 with capturedAt"
```

### Task 2.6: Food create/list/update API routes

**Files:**
- Create: `src/app/api/food/route.ts` (POST create, GET list)
- Create: `src/app/api/food/[id]/route.ts` (PATCH update, including status)

- [ ] **Step 1: Create + list route**

Create `src/app/api/food/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { resolveExpiresAt } from "@/lib/food";
import { loadShelfLife } from "@/lib/shelfLife";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await db.foodItem.findMany({
    where: { householdId: user.householdId, status: "active" },
    orderBy: [{ expiresAt: "asc" }],
    include: { photo: true },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  // body.items: [{ name, category, storedAt, expiresAt|null, photoId|null, notes?, isRecognized? }]
  const shelf = await loadShelfLife();
  const created = await db.$transaction(
    (body.items as any[]).map((it) => {
      const storedAt = new Date(it.storedAt);
      const expiresAt = resolveExpiresAt(
        { category: it.category, storedAt, manualExpiresAt: it.expiresAt ? new Date(it.expiresAt) : null },
        shelf,
      );
      return db.foodItem.create({
        data: {
          householdId: user.householdId,
          photoId: it.photoId ?? null,
          name: it.name,
          category: it.category,
          storedAt,
          expiresAt,
          notes: it.notes ?? null,
          isRecognized: !!it.isRecognized,
          createdBy: user.id,
        },
      });
    }),
  );
  return NextResponse.json({ created });
}
```

- [ ] **Step 2: Update route (rename/edit/mark status), household-scoped**

Create `src/app/api/food/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await db.foodItem.findUnique({ where: { id } });
  if (!existing || existing.householdId !== user.householdId)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const data: any = {};
  for (const f of ["name", "category", "notes", "status"]) if (f in body) data[f] = body[f];
  if ("storedAt" in body) data.storedAt = new Date(body.storedAt);
  if ("expiresAt" in body) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  const updated = await db.foodItem.update({ where: { id }, data });
  return NextResponse.json({ updated });
}
```

- [ ] **Step 3: Manual verification**

Logged in, in browser console:
```js
await (await fetch("/api/food", {method:"POST", headers:{"content-type":"application/json"},
  body: JSON.stringify({items:[{name:"剩菜",category:"剩菜",storedAt:new Date().toISOString(),expiresAt:null,photoId:null}]})})).json();
await (await fetch("/api/food")).json(); // shows item with auto expiresAt
```
Expected: created item has non-null `expiresAt` (storedAt + 2 days for 剩菜).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: food create/list/update APIs (household-scoped)"
```

### Task 2.7: Expiry state helper + list UI + add form

**Files:**
- Create: `src/lib/expiryState.ts`, `src/lib/expiryState.test.ts`
- Create: `src/app/page.tsx` (replace), `src/app/add/page.tsx`
- Create: `src/components/FoodList.tsx`, `src/components/AddFoodForm.tsx`

- [ ] **Step 1: Write the failing test for the color-state classifier**

Create `src/lib/expiryState.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { expiryState } from "./expiryState";

const now = new Date("2026-06-13T00:00:00Z");

describe("expiryState", () => {
  it("none when no expiry", () => { expect(expiryState(null, now, 2)).toBe("none"); });
  it("expired when past", () => { expect(expiryState(new Date("2026-06-12T00:00:00Z"), now, 2)).toBe("expired"); });
  it("urgent when within 1 day", () => { expect(expiryState(new Date("2026-06-13T20:00:00Z"), now, 2)).toBe("urgent"); });
  it("soon when within lead days", () => { expect(expiryState(new Date("2026-06-15T00:00:00Z"), now, 2)).toBe("soon"); });
  it("ok when far away", () => { expect(expiryState(new Date("2026-06-30T00:00:00Z"), now, 2)).toBe("ok"); });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run src/lib/expiryState.test.ts`
Expected: FAIL — cannot find module `./expiryState`.

- [ ] **Step 3: Implement the classifier**

Create `src/lib/expiryState.ts`:

```ts
export type ExpiryState = "none" | "expired" | "urgent" | "soon" | "ok";

export function expiryState(expiresAt: Date | null, now: Date, leadDays: number): ExpiryState {
  if (!expiresAt) return "none";
  const ms = expiresAt.getTime() - now.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (ms < 0) return "expired";
  if (ms <= day) return "urgent";
  if (ms <= leadDays * day) return "soon";
  return "ok";
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npx vitest run src/lib/expiryState.test.ts`
Expected: 5 passed.

- [ ] **Step 5: List component (client) with color states**

Create `src/components/FoodList.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { expiryState, type ExpiryState } from "@/lib/expiryState";

const COLOR: Record<ExpiryState, string> = {
  expired: "border-red-500 bg-red-50",
  urgent: "border-orange-500 bg-orange-50",
  soon: "border-yellow-500 bg-yellow-50",
  ok: "border-green-500 bg-green-50",
  none: "border-gray-300 bg-gray-50",
};

export function FoodList({ leadDays }: { leadDays: number }) {
  const [items, setItems] = useState<any[]>([]);
  const now = new Date();
  async function load() { setItems((await (await fetch("/api/food")).json()).items); }
  useEffect(() => { load(); }, []);

  async function mark(id: string, status: string) {
    await fetch(`/api/food/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((it) => {
        const exp = it.expiresAt ? new Date(it.expiresAt) : null;
        const state = expiryState(exp, now, leadDays);
        return (
          <li key={it.id} className={`rounded-lg border-l-4 p-3 ${COLOR[state]}`}>
            <div className="flex justify-between">
              <div>
                <div className="font-semibold">{it.name}</div>
                <div className="text-sm text-gray-500">
                  {it.category} · 放入 {new Date(it.storedAt).toLocaleDateString()}
                  {exp ? ` · 到期 ${exp.toLocaleDateString()}` : " · 無到期日"}
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
  );
}
```

- [ ] **Step 6: Add-food form (upload → manual fields → save)**

Create `src/components/AddFoodForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddFoodForm() {
  const router = useRouter();
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [storedAt, setStoredAt] = useState<string>("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("其他");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await (await fetch("/api/photos", { method: "POST", body: fd })).json();
    setPhotoId(res.photoId);
    setStoredAt(res.capturedAt.slice(0, 16)); // default stored = capture time
    setBusy(false);
  }

  async function save() {
    setBusy(true);
    await fetch("/api/food", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ name, category, photoId,
        storedAt: storedAt ? new Date(storedAt).toISOString() : new Date().toISOString(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null }] }),
    });
    router.push("/");
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="file" accept="image/*" capture="environment" onChange={onPhoto} />
      <input className="rounded border p-2" placeholder="名稱" value={name} onChange={(e) => setName(e.target.value)} />
      <select className="rounded border p-2" value={category} onChange={(e) => setCategory(e.target.value)}>
        {["熟食","葉菜","根莖蔬菜","水果","肉類","海鮮","乳製品","蛋","醬料","飲料","剩菜","其他"].map((c) => <option key={c}>{c}</option>)}
      </select>
      <label className="text-sm text-gray-500">放入時間（預設＝拍照時間）</label>
      <input className="rounded border p-2" type="datetime-local" value={storedAt} onChange={(e) => setStoredAt(e.target.value)} />
      <label className="text-sm text-gray-500">到期日（留空＝依類別自動估算）</label>
      <input className="rounded border p-2" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
      <button disabled={busy || !name} className="rounded bg-black p-2 text-white disabled:opacity-50" onClick={save}>儲存</button>
    </div>
  );
}
```

- [ ] **Step 7: Wire pages**

Replace `src/app/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { FoodList } from "@/components/FoodList";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const hh = await db.household.findUnique({ where: { id: user.householdId } });
  return (
    <main className="mx-auto max-w-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">冰箱清單</h1>
        <Link href="/add" className="rounded bg-black px-3 py-1 text-white">＋ 新增</Link>
      </div>
      <FoodList leadDays={hh?.reminderLeadDays ?? 2} />
    </main>
  );
}
```

Create `src/app/add/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AddFoodForm } from "@/components/AddFoodForm";

export default async function AddPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-xl font-bold">新增食物</h1>
      <AddFoodForm />
    </main>
  );
}
```

- [ ] **Step 8: Run unit tests + manual verify**

Run: `npx vitest run` → all pass.
Manual: log in → `/add` → pick a photo (capture time prefills) → name 「番茄」, category 「水果」, leave expiry blank → save → home list shows it green/yellow with auto expiry; 「吃掉」 removes it from the active list.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: expiry-state list UI + add-food form (M2 complete)"
```

---

## Milestone 3 — AI recognition

### Task 3.1: Recognition result schema + prompt builder

**Files:**
- Create: `src/lib/recognition.ts`, `src/lib/recognition.test.ts`

- [ ] **Step 1: Write the failing test for response parsing**

The AI returns JSON text; `parseRecognition` validates and normalizes it into `RecognizedItem[]`, tolerating junk.

Create `src/lib/recognition.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseRecognition } from "./recognition";

describe("parseRecognition", () => {
  it("parses a valid items array", () => {
    const raw = JSON.stringify({ items: [
      { name: "雞腿", category: "肉類", confidence: 0.9 },
      { name: "高麗菜", category: "葉菜", confidence: 0.7 },
    ]});
    const out = parseRecognition(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ name: "雞腿", category: "肉類", confidence: 0.9 });
  });

  it("returns [] on invalid JSON", () => {
    expect(parseRecognition("not json")).toEqual([]);
  });

  it("skips items missing name", () => {
    const raw = JSON.stringify({ items: [{ category: "肉類" }, { name: "蛋", category: "蛋" }] });
    const out = parseRecognition(raw);
    expect(out).toEqual([{ name: "蛋", category: "蛋", confidence: 0 }]);
  });

  it("extracts JSON embedded in code fences", () => {
    const raw = "```json\n{\"items\":[{\"name\":\"牛奶\",\"category\":\"乳製品\"}]}\n```";
    expect(parseRecognition(raw)).toEqual([{ name: "牛奶", category: "乳製品", confidence: 0 }]);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run src/lib/recognition.test.ts`
Expected: FAIL — cannot find module `./recognition`.

- [ ] **Step 3: Implement parser + prompt + categories**

Create `src/lib/recognition.ts`:

```ts
export const CATEGORIES = ["熟食","葉菜","根莖蔬菜","水果","肉類","海鮮","乳製品","蛋","醬料","飲料","剩菜","其他"] as const;

export interface RecognizedItem { name: string; category: string; confidence: number; }

export const RECOGNITION_PROMPT =
  `你是食物辨識助手。看這張冰箱/收納食物的照片,列出你看到的可食用品項。` +
  `只回 JSON,格式 {"items":[{"name":"品項中文名","category":"類別","confidence":0~1}]}。` +
  `category 只能從這幾個選:${CATEGORIES.join("、")}。看不出來就回 {"items":[]}。`;

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
}

export function parseRecognition(raw: string): RecognizedItem[] {
  let parsed: any;
  try { parsed = JSON.parse(extractJson(raw)); } catch { return []; }
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items
    .filter((it: any) => typeof it?.name === "string" && it.name.trim())
    .map((it: any) => ({
      name: String(it.name).trim(),
      category: (CATEGORIES as readonly string[]).includes(it.category) ? it.category : "其他",
      confidence: typeof it.confidence === "number" ? it.confidence : 0,
    }));
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npx vitest run src/lib/recognition.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: recognition prompt + tolerant JSON parser"
```

### Task 3.2: AI Hub vision client + recognize-on-upload

**Files:**
- Create: `src/lib/aiVision.ts`
- Modify: `src/app/api/photos/route.ts` (return recognized items too)

- [ ] **Step 1: Vision client (OpenAI-compatible, image as data URL)**

Create `src/lib/aiVision.ts`:

```ts
import { parseRecognition, RECOGNITION_PROMPT, type RecognizedItem } from "./recognition";

export async function recognizeFood(bytes: Uint8Array, contentType: string): Promise<RecognizedItem[]> {
  const base = process.env.AI_HUB_BASE_URL;
  const key = process.env.AI_HUB_API_KEY;
  const model = process.env.AI_HUB_VISION_MODEL;
  if (!base || !key || !model) return [];
  const b64 = Buffer.from(bytes).toString("base64");
  const dataUrl = `data:${contentType || "image/jpeg"};base64,${b64}`;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: [
          { type: "text", text: RECOGNITION_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ]}],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return parseRecognition(json?.choices?.[0]?.message?.content ?? "");
  } catch {
    return []; // failure must not block the upload flow
  }
}
```

- [ ] **Step 2: Call recognition during upload**

Edit `src/app/api/photos/route.ts` — after creating the photo, run recognition and include it. Replace the final return block:

```ts
  const photo = await db.photo.create({
    data: { objectKey: key, capturedAt, uploadedBy: user.id },
  });
  const recognized = await recognizeFood(bytes, file.type || "image/jpeg");
  return NextResponse.json({ photoId: photo.id, capturedAt: capturedAt.toISOString(), recognized });
```

Add the import at the top of the file:

```ts
import { recognizeFood } from "@/lib/aiVision";
```

- [ ] **Step 3: Manual verification**

Fill `AI_HUB_*` in `.env`. Upload a real food photo via `/add` (next task wires the UI; for now test the API). In console:
```js
const fd = new FormData(); fd.append("file", /* a File from an <input> */);
await (await fetch("/api/photos",{method:"POST",body:fd})).json();
```
Expected: response includes a `recognized` array with plausible items. With AI vars unset, `recognized` is `[]` and upload still succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: AI Hub vision recognition on photo upload"
```

### Task 3.3: Editable multi-item recognition UI

**Files:**
- Modify: `src/components/AddFoodForm.tsx`

- [ ] **Step 1: Replace AddFoodForm to support a list of editable recognized rows**

Replace `src/components/AddFoodForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["熟食","葉菜","根莖蔬菜","水果","肉類","海鮮","乳製品","蛋","醬料","飲料","剩菜","其他"];

interface Row { name: string; category: string; expiresAt: string; }

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
    const fd = new FormData(); fd.append("file", file);
    const res = await (await fetch("/api/photos", { method: "POST", body: fd })).json();
    setPhotoId(res.photoId);
    setStoredAt(res.capturedAt.slice(0, 16));
    const recognized: any[] = res.recognized ?? [];
    setRows(recognized.length
      ? recognized.map((r) => ({ name: r.name, category: r.category, expiresAt: "" }))
      : [{ name: "", category: "其他", expiresAt: "" }]);
    setBusy(false); setRecognizing(false);
  }

  function update(i: number, patch: Partial<Row>) { setRows((rs) => rs.map((r, j) => j === i ? { ...r, ...patch } : r)); }
  function addRow() { setRows((rs) => [...rs, { name: "", category: "其他", expiresAt: "" }]); }
  function removeRow(i: number) { setRows((rs) => rs.filter((_, j) => j !== i)); }

  async function save() {
    setBusy(true);
    const stored = storedAt ? new Date(storedAt).toISOString() : new Date().toISOString();
    await fetch("/api/food", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: rows.filter((r) => r.name.trim()).map((r) => ({
        name: r.name, category: r.category, photoId, storedAt: stored,
        expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null, isRecognized: true,
      })) }),
    });
    router.push("/");
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="file" accept="image/*" capture="environment" onChange={onPhoto} />
      {recognizing && <p className="text-sm text-gray-500">辨識中…</p>}
      {rows.length > 0 && (
        <>
          <label className="text-sm text-gray-500">放入時間（預設＝拍照時間）</label>
          <input className="rounded border p-2" type="datetime-local" value={storedAt} onChange={(e) => setStoredAt(e.target.value)} />
          {rows.map((r, i) => (
            <div key={i} className="rounded border p-3 flex flex-col gap-2">
              <input className="rounded border p-2" placeholder="名稱" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
              <select className="rounded border p-2" value={r.category} onChange={(e) => update(i, { category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input className="rounded border p-2" type="date" value={r.expiresAt}
                onChange={(e) => update(i, { expiresAt: e.target.value })} placeholder="到期日（留空＝自動估）" />
              <button className="self-end text-sm text-red-600" onClick={() => removeRow(i)}>刪除這筆</button>
            </div>
          ))}
          <button className="rounded border p-2" onClick={addRow}>＋ 再加一筆</button>
          <button disabled={busy} className="rounded bg-black p-2 text-white disabled:opacity-50" onClick={save}>儲存</button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

`/add` → take/select a food photo → recognized rows appear pre-filled and editable → can add/remove rows → save → all appear on the home list. With recognition empty, one blank row appears so manual entry still works.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: editable multi-item recognition UI (M3 complete)"
```

---

## Milestone 4 — Reminders (cron, LINE push, Web Push, dedup)

### Task 4.1: Due-items selection + dedup logic (pure core)

**Files:**
- Create: `src/lib/reminders.ts`, `src/lib/reminders.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/reminders.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isDue, toDateOnly } from "./reminders";

const now = new Date("2026-06-13T09:00:00Z");

describe("isDue", () => {
  it("due when expiresAt within lead window", () => {
    expect(isDue(new Date("2026-06-15T00:00:00Z"), now, 2)).toBe(true);
  });
  it("due when already expired", () => {
    expect(isDue(new Date("2026-06-10T00:00:00Z"), now, 2)).toBe(true);
  });
  it("not due when far in future", () => {
    expect(isDue(new Date("2026-06-30T00:00:00Z"), now, 2)).toBe(false);
  });
  it("not due when no expiry", () => {
    expect(isDue(null, now, 2)).toBe(false);
  });
});

describe("toDateOnly", () => {
  it("strips time to UTC midnight", () => {
    expect(toDateOnly(now).toISOString()).toBe("2026-06-13T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run src/lib/reminders.test.ts`
Expected: FAIL — cannot find module `./reminders`.

- [ ] **Step 3: Implement**

Create `src/lib/reminders.ts`:

```ts
export function isDue(expiresAt: Date | null, now: Date, leadDays: number): boolean {
  if (!expiresAt) return false;
  const threshold = new Date(now.getTime() + leadDays * 24 * 60 * 60 * 1000);
  return expiresAt.getTime() <= threshold.getTime();
}

export function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npx vitest run src/lib/reminders.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: reminder due-check + date-only helpers"
```

### Task 4.2: LINE push + Web Push senders

**Files:**
- Create: `src/lib/linePush.ts`, `src/lib/webPush.ts`

- [ ] **Step 1: LINE Messaging push**

Create `src/lib/linePush.ts`:

```ts
export async function pushLine(lineUserId: string, text: string): Promise<boolean> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }] }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Install web-push and write the sender**

```bash
npm install web-push
npm install -D @types/web-push
```

Create `src/lib/webPush.ts`:

```ts
import webpush from "web-push";
import { db } from "@/lib/db";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export async function pushWeb(userId: string, payload: { title: string; body: string }): Promise<boolean> {
  if (!process.env.VAPID_PRIVATE_KEY) return false;
  configure();
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let anyOk = false;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      anyOk = true;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await db.pushSubscription.delete({ where: { id: s.id } }); // prune dead endpoints
      }
    }
  }
  return anyOk;
}
```

- [ ] **Step 3: Generate VAPID keys**

Run: `npx web-push generate-vapid-keys`
Put the public/private keys in `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: LINE push + Web Push senders with dead-endpoint pruning"
```

### Task 4.3: Web Push subscription endpoint + service worker + client opt-in

**Files:**
- Create: `src/app/api/push/subscribe/route.ts`
- Create: `public/sw.js`, `public/manifest.json`
- Create: `src/components/EnablePush.tsx`
- Modify: `src/app/layout.tsx` (manifest link), `src/app/page.tsx` (mount EnablePush)

- [ ] **Step 1: Subscription save endpoint**

Create `src/app/api/push/subscribe/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sub = await req.json();
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, userId: user.id },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userId: user.id },
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Service worker + manifest (PWA)**

Create `public/sw.js`:

```js
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "冰箱提醒", body: "" };
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
```

Create `public/manifest.json`:

```json
{
  "name": "冰箱食物追蹤",
  "short_name": "冰箱追蹤",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#06C755",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" }]
}
```

> Provide a 192×192 `public/icon-192.png` (any placeholder PNG is fine for now).

- [ ] **Step 3: Opt-in component**

Create `src/components/EnablePush.tsx`:

```tsx
"use client";
import { useState } from "react";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function EnablePush({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [done, setDone] = useState(false);
  async function enable() {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.register("/sw.js");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
    setDone(true);
  }
  return <button className="text-sm text-blue-600 underline" onClick={enable}>{done ? "已開啟手機推播" : "開啟手機推播"}</button>;
}
```

- [ ] **Step 4: Mount it + manifest link**

In `src/app/layout.tsx`, add inside `<head>` (or via `metadata`): `<link rel="manifest" href="/manifest.json" />`.

In `src/app/page.tsx`, pass the key and mount the button under the header:

```tsx
import { EnablePush } from "@/components/EnablePush";
// ...inside the returned JSX, below the <h1>/<Link> row:
<EnablePush vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
```

> `process.env.VAPID_PUBLIC_KEY` is read in a Server Component (page.tsx) and passed as a prop, so it does not need a `NEXT_PUBLIC_` prefix.

- [ ] **Step 5: Manual verification**

`npm run dev` over `http://localhost:3000` (localhost is allowed for service workers). Log in → click 「開啟手機推播」 → grant permission → a row appears in `PushSubscription` (check `npx prisma studio`).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: Web Push subscription, service worker, PWA manifest, opt-in"
```

### Task 4.4: Daily reminder cron endpoint

**Files:**
- Create: `src/app/api/cron/remind/route.ts`
- Create: `.github/workflows/remind.yml`

- [ ] **Step 1: Cron endpoint — secret-guarded, dedup via reminder_log**

Create `src/app/api/cron/remind/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isDue, toDateOnly } from "@/lib/reminders";
import { pushLine } from "@/lib/linePush";
import { pushWeb } from "@/lib/webPush";

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const now = new Date();
  const today = toDateOnly(now);
  const households = await db.household.findMany({ include: { users: true } });
  let sent = 0;

  for (const hh of households) {
    const items = await db.foodItem.findMany({
      where: { householdId: hh.id, status: "active", expiresAt: { not: null } },
      orderBy: { expiresAt: "asc" },
    });
    const due = items.filter((it) => isDue(it.expiresAt, now, hh.reminderLeadDays));
    if (due.length === 0) continue;

    // dedup: only items not already reminded today (any channel)
    const fresh: typeof due = [];
    for (const it of due) {
      const already = await db.reminderLog.findFirst({ where: { foodItemId: it.id, remindedOn: today } });
      if (!already) fresh.push(it);
    }
    if (fresh.length === 0) continue;

    const lines = fresh.map((it) => {
      const exp = it.expiresAt!;
      const overdue = exp.getTime() < now.getTime();
      return `・${it.name}（${overdue ? "已過期" : "即將到期"} ${exp.toLocaleDateString("zh-TW")}）`;
    });
    const body = `冰箱有 ${fresh.length} 樣東西要注意:\n${lines.join("\n")}`;

    for (const u of hh.users) {
      const lineOk = await pushLine(u.lineUserId, body);
      const webOk = await pushWeb(u.id, { title: "冰箱提醒", body });
      for (const it of fresh) {
        if (lineOk) await db.reminderLog.create({ data: { foodItemId: it.id, remindedOn: today, channel: "line" } }).catch(() => {});
        if (webOk) await db.reminderLog.create({ data: { foodItemId: it.id, remindedOn: today, channel: "web" } }).catch(() => {});
      }
    }
    sent += fresh.length;
  }
  return NextResponse.json({ ok: true, sent });
}
```

> The `@@unique([foodItemId, remindedOn, channel])` constraint plus the per-item `findFirst` check makes re-runs idempotent: a second run the same day finds existing logs and sends nothing. `.catch(() => {})` absorbs the rare race on the unique constraint.

- [ ] **Step 2: Local verification**

With `CRON_SECRET` set in `.env` and at least one near-expiry active item:
```bash
curl -X POST http://localhost:3000/api/cron/remind -H "authorization: Bearer <CRON_SECRET>"
```
Expected: first call `{ ok: true, sent: N }` (N>0); immediate second call `{ ok: true, sent: 0 }` (deduped). Wrong/missing secret → 403.

- [ ] **Step 3: GitHub Actions daily cron**

Create `.github/workflows/remind.yml`:

```yaml
name: daily-food-reminder
# 每天台灣時間早上 9 點 (UTC 01:00) 打提醒 API，找出快過期的食物推播給家人
on:
  schedule:
    - cron: "0 1 * * *"
  workflow_dispatch:
jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger reminder endpoint
        run: |
          curl -fsS -X POST "${{ secrets.APP_BASE_URL }}/api/cron/remind" \
            -H "authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

> In the GitHub repo settings add Actions secrets `APP_BASE_URL` (the deployed Zeabur URL) and `CRON_SECRET` (matching the deployed env). `workflow_dispatch` lets you run it manually to verify.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: daily reminder cron endpoint + GitHub Actions (M4 complete)"
```

### Task 4.5: Deploy to Zeabur

**Files:**
- Create: `README.md` (deploy notes)

- [ ] **Step 1: Push to GitHub**

```bash
gh repo create fridge-tracker --private --source=. --remote=origin --push
```

- [ ] **Step 2: Provision on Zeabur**

Use the `zeabur:zeabur-project-create` and `zeabur:zeabur-template-deploy` skills (PostgreSQL template), then deploy this repo as a Next.js service. Set all env vars from `.env.example` on the service (use `zeabur:zeabur-variables`). Run `npx prisma db push` and `npx prisma db seed` against the Zeabur DB (locally with `DATABASE_URL` pointed at it, or via `zeabur:zeabur-service-exec`).

- [ ] **Step 3: Post-deploy checks**

- Visit the Zeabur URL → LINE login works (add the deployed callback URL `${APP_BASE_URL}/api/auth/callback/line` in the LINE Login channel).
- Add the official account as a friend; add a near-expiry item; manually run the GitHub Action (`workflow_dispatch`) → receive LINE + Web Push.

- [ ] **Step 4: Write README + commit**

Create `README.md` documenting: purpose, env vars, local dev (`npm run dev`), tests (`npm run test`), the LINE provider setup, and how the daily reminder cron works.

```bash
git add -A && git commit -m "docs: README with setup and deploy notes"
git push
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Photo + capture time → Task 2.1 (EXIF), 2.5 (upload stores capturedAt). ✓
- Stored time defaults to capture time, editable → AddFoodForm prefills `storedAt` from `capturedAt`. ✓
- Original image stored → R2 putPhoto (2.2, 2.5), never deleted. ✓
- AI auto-identify → 3.1–3.2; manual edit → 3.3. ✓
- Track how long stored + remind before spoiling → expiry estimate (2.3–2.4), list states (2.7), reminders (4.1–4.4). ✓
- Family shared → household model (1.2), all queries household-scoped (2.6, 4.4). ✓
- LINE Login → 1.3; LINE push + Web Push + in-app → 4.2–4.4 + 2.7. ✓
- Auto-estimate + manual override expiry → resolveExpiresAt (2.4). ✓
- Zeabur + GitHub + R2 + GH Actions cron → 4.4–4.5. ✓

**Placeholder scan:** No "TBD"/"add error handling"-style gaps; every code step has full code. The only deferred asset is a placeholder PNG icon (noted explicitly), which doesn't block functionality.

**Type consistency:** `RecognizedItem {name,category,confidence}` used identically in 3.1/3.2/3.3. `resolveExpiresAt` signature matches its callers (2.6). `isDue`/`toDateOnly` signatures match cron usage (4.4). `pushLine`/`pushWeb` return `boolean`, used as such in 4.4.
