# 設計：改名「食物存放清單」+ 使用者頭像

**日期**：2026-06-16
**狀態**：已通過設計討論，待寫實作計畫

## 背景與目標

1. **改名**：這是食物過期管理工具，不是「冰箱清單」。正式名稱統一為「**食物存放清單**」，替換所有對外文案（App 標題、PWA 名稱、登入頁、首頁標題、空狀態文案）。圖示 🧊 → 🍱。純文案，不動邏輯。
2. **使用者頭像**：每位登入者可上傳/更換自己的頭像，顯示於①首頁頂部（自己）②食物卡片「誰加的」旁③管理頁使用者名單。上傳入口為「我的」頁（點首頁頂部名字/頭像進入）。

非目標（YAGNI）：頭像裁切/濾鏡、在 /me 改自己名字（名字仍由管理員管）、頭像歷史。

## 架構決策

- **頭像重用既有照片管線 + `User.pictureUrl`**：`User.pictureUrl`（schema 已有、未使用）存頭像的 app 路徑 `/api/photo/<photoId>`。上傳走 `POST /api/photos`（回 photoId）→ `PATCH /api/me` 寫回 `pictureUrl`。**不需改 schema**。
- 頭像顯示走既有 `GET /api/photo/[id]`（需登入）；App 所有畫面都在登入後，瀏覽器自帶 cookie，可正常讀取。
- fallback：無頭像時顯示「名字首字圓底」，不破版。

## 模組與介面

- `src/lib/avatar.ts`（new，純函式 + 測試）：`initials(name): string`（取名字第一個字元當 fallback；空字串回 "?"）。
- `src/components/ui/Avatar.tsx`（new，純呈現）：props `{ src?: string | null; name: string; size?: number }`。有 `src` → 圓形 `<img>`（`onError` 退回首字）；否則首字圓底（品牌綠系）。
- `src/lib/session.ts`：`CurrentUser` 加 `avatarUrl: string | null`（= user.pictureUrl）。
- `GET /api/me`（`src/app/api/me/route.ts`，new）：登入者回 `{ id, name, phone, isAdmin, avatarUrl }`。
- `PATCH /api/me`：body `{ photoId }`；驗證 photoId 為非空字串 → 設 `pictureUrl = '/api/photo/' + photoId`；回更新後 `{ avatarUrl }`。只改本人（用 `getCurrentUser().id`）。
- `GET /api/food`：在 `src/lib/foodView.ts` 加 `buildCreatorAvatarMap(members): Record<string, string | null>`（id→pictureUrl）；DTO 每筆加 `createdByAvatar: avatarMap[it.createdBy] ?? null`。
- `GET /api/admin/users`：每筆回傳加 `avatarUrl`（= user.pictureUrl）。
- **UI**
  - `src/app/me/page.tsx` + `src/components/MyProfile.tsx`（new）：顯示名字 + 大頭像（`Avatar`）+「📷 上傳/更換頭像」（重用 `/api/photos` → `PATCH /api/me` → 重新整理）。`AppHeader` + ‹返回。
  - `src/app/page.tsx`（首頁）：`AppHeader` actions 右側加一個 `Avatar`（登入者，size 小）包成 `<Link href="/me">`。需要 `getCurrentUser().avatarUrl` + `name`。
  - `src/components/FoodList.tsx`：DTO 加 `createdByAvatar?`；卡片「· {createdByName} 加的」改為小 `Avatar`（size ~18）+ 名字。
  - `src/components/AdminUsers.tsx`：每列名字左側加 `Avatar`（size ~36）。DTO `UserRow` 加 `avatarUrl`。
  - **改名文案**：`layout.tsx`（metadata.title/description）、`public/manifest.json`（name/short_name）、`login/page.tsx`（標題 + 🧊→🍱）、`page.tsx`（`AppHeader` title「冰箱清單」→「食物存放清單」）、`FoodList` 空狀態（🧊→🍱、「冰箱是空的…」→「還沒有食物，點下方『＋ 新增食物』記錄第一樣吧。」）。

## 資料流

- 設頭像：`/me` 上傳 → `/api/photos` 回 photoId → `PATCH /api/me` 寫 pictureUrl → reload。
- 顯示：首頁頂部用 `getCurrentUser().avatarUrl`；食物卡片用 `GET /api/food` 的 `createdByAvatar`；管理頁用 `GET /api/admin/users` 的 `avatarUrl`。皆經 `Avatar`（無則首字）。

## 錯誤處理 / 邊界

- 無頭像 → 首字圓底 fallback。
- 頭像載入失敗（`onError`）→ 退回首字，不破版。
- `PATCH /api/me` photoId 空/非字串 → 400。
- 長名字首字：只取第一個字元（中文/英文皆可）。
- 改名不影響任何 code identifier / data key（只改顯示文案）。

## 測試（vitest，維持現有 64 綠）

- `avatar.ts`：`initials`（中文取首字、英文取首字、空字串回 "?"、含空白 trim）。
- 其餘 route/UI 靠 tsc + build + 部署 smoke + 真機 QA。

## 部署

1. 合併 main（無 schema 變更，不需 db push）。
2. `service redeploy web` → 等 RUNNING。
3. Smoke + 真機 QA：標題/PWA 名稱顯示「食物存放清單」；`/me` 上傳頭像；首頁頂部、食物卡片、管理頁都看到頭像（無則首字）。
