# 設計：管理員功能 + 電話登入

**日期**：2026-06-15
**狀態**：已通過設計討論，待寫實作計畫

## 背景與目標

目前 App 是「免登入、單一共用 household」：任何人打開網址即看到同一份冰箱清單，`session.ts` 回傳寫死的 `LOCAL_PROFILE`。

本功能把 App 改為**登入制的存取控制**：

1. **登入制**：每個人用自己的電話登入才能使用 App。
2. **電話登入、不驗證**：登入只需輸入電話號碼，不做簡訊/PIN 驗證（家人完全信任的低安全取捨，由使用者明確選定）。
3. **白名單**：只有「管理員加過的電話」或「管理員本人電話」能登入；其他電話被擋下。
4. **管理員**：唯一管理員 = 寫死的電話 `0926-571-988`（正規化為 `0926571988`）。只有管理員能進管理後台、新增/刪除使用者。
5. **共用冰箱不變**：所有登入者仍共用同一個 household，看到同一份冰箱清單。
6. 登入後以 cookie 保持登入（約一年），不必每次重打。

非目標（YAGNI）：簡訊 OTP、PIN、多 household、角色分級、LINE 登入（保留欄位但不實作）、主動撤銷單一裝置 session、照片顯示。

## 架構決策

**Session 機制：簽章 Cookie（方案 A）**。登入後將 userId 放進一個 HMAC 簽章、HttpOnly 的 cookie；每次請求由 middleware 驗簽章、由 `getCurrentUser()` 回 DB 確認使用者仍在名單。不裝新套件、刪人即時生效。已排除 DB session 表（殺雞用牛刀）與 next-auth（剛移除、beta、不合此情境）。

## 資料模型（Prisma `User` 表）

沿用現有 `User` 表，不新增表：

| 欄位 | 變更 | 說明 |
|---|---|---|
| `phone` | **新增** `String? @unique` | 登入鑰匙，存正規化後數字（`0926571988`）。可為 null 以相容舊的 `local-default` 列 |
| `lineUserId` | 改為 `String?`（選填、仍 `@unique`） | 電話使用者無 LINE；保留給未來 LINE 登入 |
| `displayName` | 不變 | = 新增使用者時填的名字 |
| 其餘（id / householdId / pushSubs / createdAt） | 不變 | |

- **管理員不存 DB 欄位**：以常數 `ADMIN_PHONE = "0926571988"` 比對；`isAdmin` = `user.phone === ADMIN_PHONE`。
- 需對 prod DB 跑 `prisma db push`（schema 變更）。

## 模組與介面（小單元、各自可測）

- `src/lib/auth/phone.ts` — `normalizePhone(input): string`：去空白/破折號、`+886`→`0`、只留數字。
- `src/lib/auth/cookie.ts` — `signSession(userId): string` / `verifySession(token): userId | null`，用 Web Crypto HMAC-SHA256 + `SESSION_SECRET`（可在 edge middleware 與 node route 共用）。Cookie payload 僅含 `userId`；登入時效由 cookie `maxAge`（約一年）控制，`verifySession` 只驗簽章。
- `src/lib/auth/admin.ts` — `ADMIN_PHONE` 常數 + `isAdminPhone(phone): boolean`。
- `src/lib/session.ts` — 改寫 `getCurrentUser()`：讀 cookie → `verifySession` → 依 id 查 DB → 回 `{id, householdId, phone, name, isAdmin}` 或 `null`。
- `src/lib/household.ts` — 新增 `getSharedHousehold(db)`：回傳唯一 household（無則建立）。
- `src/lib/auth/authorize.ts` — `resolveLogin(phone, db)`：管理員→ get-or-create 管理員 user；名單內→回該 user；否則→ null（未授權）。純邏輯，易測。

## 路由

**頁面**
- `/login` — 單欄位（電話）+ 送出；錯誤顯示未授權訊息。免登入可達。
- `/`（首頁）— server component 先 `getCurrentUser()`，null → redirect `/login`（絕對網址）。管理員多顯示「⚙️ 管理」入口與「登出」。
- `/admin` — `getCurrentUser().isAdmin` 為否 → redirect `/`。顯示使用者名單 + 新增表單。

**API**
- `POST /api/auth/login` — body `{phone}`；正規化 → `resolveLogin`；成功 set-cookie 回 `{ok:true}`，未授權回 403 友善訊息。
- `POST /api/auth/logout` — 清 cookie。
- `GET /api/admin/users` — 管理員列名單。
- `POST /api/admin/users` — 管理員新增 `{phone, name}`：正規化、擋空白、擋重複、擋與 ADMIN_PHONE 同號。
- `DELETE /api/admin/users/[id]` — 管理員刪除：不可刪自己/管理員；連帶刪該 user 的 `PushSubscription`。
- 既有 `food` / `food/[id]` / `photos` / `push/subscribe` — 不改邏輯，靠已存在的 `if (!user) return 401`。
- `GET/POST /api/cron/remind` — **不受登入牆影響**，維持 `CRON_SECRET` 驗證。

**Middleware（`src/middleware.ts`）**
- 放行：`/login`、`/api/auth/login`、`/api/cron/remind`、Next 靜態資源、PWA 檔（`/manifest.json`、`/sw.js`、icons）。
- 其餘：驗 cookie 簽章（Web Crypto，不查 DB）。無效 → 頁面 redirect `/login`（絕對網址，取 `x-forwarded-host`）；`/api/*` 回 401 JSON。
- DB「是否仍在名單」的最終確認由 `getCurrentUser()` 每請求負責（middleware 不接 Prisma）。

## 資料流

登入：`/login` → `POST /api/auth/login` → `normalizePhone` → `resolveLogin`（管理員 get-or-create / 名單查找 / 未授權）→ set 簽章 cookie → 導首頁。
一般請求：middleware 驗簽 → route 呼叫 `getCurrentUser()` 回 DB 查 → 用 `householdId`（= `getSharedHousehold`）操作冰箱資料。
刪除使用者：管理員在 `/admin` 刪 → 該人 cookie 仍在但 DB 查不到 → `getCurrentUser()` 回 null → 下次請求被導回 `/login`。

## 既有資料遷移

- 現有唯一 household 即「共用冰箱」，所有登入者掛上它；清單以 `householdId` 查，**舊食物資料一筆不失**。
- 舊 `local-default` 假使用者：`phone` 留 null（登不進、無害），不清除。
- `getSharedHousehold` 確保只用這一個 household（不因新登入暴增 household）。

## 錯誤處理 / 邊界

- 電話正規化涵蓋：含破折號、空白、`+886`、純數字。
- 未授權電話 → 友善「此電話未獲授權，請聯絡管理員」。
- 已登入者被刪 → 下次請求自動回登入頁。
- 管理員不可刪自己；新增不可與 ADMIN_PHONE 重號（管理員自動存在）。
- 缺 `SESSION_SECRET` → 啟動即明確報錯（不可用空密鑰簽 session）。
- cron 路徑不套登入牆。
- LINE 推播對無 lineUserId 的電話使用者本就 return false；Web Push 正常。

## 測試（vitest，維持現有 37 綠）

純函式 / 邏輯單元測試：
- `normalizePhone`：各種輸入格式 → 一致輸出。
- `cookie` sign/verify：正常往返、竄改/錯密鑰驗不過。
- `isAdminPhone`：管理員號碼 true、其他 false。
- `resolveLogin`：管理員（get-or-create）、名單內、名單外三種分支（以 in-memory / mock db）。
- 管理 API 權限守衛：非管理員呼叫 → 403。

## 部署注意

- 設 `SESSION_SECRET`（強隨機）到 Zeabur `web` 服務環境變數。
- schema 變更後對 prod DB 跑 `prisma db push`（沿用既有「Postgres 對外 TCP + 本機跑」流程，見專案 CLAUDE.md）。
- 既有殘留 env（`NEXTAUTH_SECRET` 等）可順手清。
- 部署後 smoke：未登入訪 `/` 應導 `/login`；管理員電話可登入並見 `/admin`；非名單電話被擋。
