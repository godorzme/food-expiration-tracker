@AGENTS.md

## Zeabur 部署

- Project：`food-expiration-tracker`（ID `6a2d5c6cd131a64afc9f3e03`）
- 對外網址：https://food-expiration-tracker.zeabur.app
- 服務（同專案內）：
  - `web`（Next.js）— Service ID `6a2d5ceed131a64afc9f3e19`，GitHub 連動 `godorzme/food-expiration-tracker` main，push 後用 `service redeploy --id <web>` 重建
  - `postgresql` — Service ID `6a2d5d6400b9937b8de212cd`，對外 TCP（供本機跑 `prisma db push`/`seed`）
  - `minio`（物件儲存，存照片原圖）— Service ID `6a2f7968150d2427fabdc45e`，預設 bucket `zeabur`，內部 endpoint `http://minio.zeabur.internal:9000`

### 重新部署 web
```bash
npx zeabur@latest service redeploy --id 6a2d5ceed131a64afc9f3e19 -y -i=false
# 等 deployment list 顯示 RUNNING（BUILDING→RUNNING 約 2-3 分）才算上線
```

### 三大功能與依賴
1. 拍照存原圖 → MinIO（`S3_*` 變數，已接好）
2. AI 辨識內容物 → `AI_HUB_*` OpenAI 相容視覺端點（已接 OpenAI gpt-4o-mini）
3. 估算有效期限 → Postgres + `ShelfLife` 12 類保存期（已 seed）

### 照片顯示 / 加入者（2026-06-15 上線）
- **照片由 App 自己出圖**：`GET /api/photo/[id]`（需登入）→ `storage.getPhotoBytes` 從 MinIO **內部** endpoint 讀 bytes → 串給瀏覽器（`private` 快取）。清單 `photoUrl = /api/photo/<photoId>`（同源、自動帶 cookie）。
- **刻意不用** presigned 公開網址 / MinIO 公開網域：照片因此「需登入才看得到」（較私密），且不依賴 MinIO 子網域 TLS（曾卡在憑證簽發，故放棄該路線；`S3_PUBLIC_ENDPOINT` 已移除）。
- 縮圖 + 點擊放大 lightbox 在 `FoodList`/`PhotoLightbox`；每筆顯示 `createdByName`（household 成員 id→名字，查不到省略）。
- 設計/計畫：`docs/superpowers/specs/2026-06-15-photo-display-and-attribution-design.md`（原設計為公開網域 presigned，部署時因憑證問題改為 App 出圖）。

### 登入 / 權限（2026-06-15 上線）
- **全站需登入**：輸入電話即登入（不驗證，家人信任情境）；中介層擋未登入。
- **管理員**：寫死常數 `ADMIN_PHONE = "0926571988"`（`src/lib/auth/admin.ts`），只有此號碼能進 `/admin` 增刪使用者。
- Session：HMAC 簽章 cookie `fridge_session`，需 `SESSION_SECRET`（已設 web 服務）；`getCurrentUser()` 每請求回 DB 確認 → 刪人即時失效。
- 設計/計畫：`docs/superpowers/specs/2026-06-15-admin-phone-login-design.md`、`docs/superpowers/plans/2026-06-15-admin-phone-login.md`。
- 登入牆在 `src/proxy.ts`（Next 16 的 `middleware.ts` 已改名 `proxy.ts`、export `proxy`；Next 16 proxy 預設跑 Node.js runtime，非 edge）。`SESSION_COOKIE` 仍放無依賴的 `src/lib/auth/cookie.ts`。
- ⚠️ **舊雷（仍留意）**：早期 `middleware.ts` 在 edge runtime 間接 import 到 Prisma（`@/lib/db`→`node:util/types`）導致全站 500。本機 `next build` 不會擋下此類 edge import 錯，只在 runtime 爆；改 proxy/middleware 時別讓它 import Node-only 模組。

### 灌 seed（保存期資料）
production 是 standalone build、無 prisma/tsx CLI，從本機用 Postgres 對外 TCP 跑：
```bash
DATABASE_URL="postgresql://root:<pw>@<public-host>:<port>/zeabur" npx tsx prisma/seed.ts
```
（對外 host:port 用 `service network --id <postgresql>` 取得；seed 為 upsert，可重跑）

### 存放點（2026-06-16 上線）
- 多存放點：`Location` 表（加了 `photoId` 位置照片 + `createdAt`）；`FoodItem.locationId` 啟用。
- `GET /api/locations`（登入即可）會在該 household 無存放點時自動建預設「冰箱」；寫入（`POST/PATCH/DELETE /api/admin/locations[/[id]]`）限管理員。
- 新增食物**必選存放點**（預設第一個）；首頁頂部 `LocationChips` 依存放點 client 過濾；卡片顯示存放點名。
- 刪除存放點：有 active 食物 → 409 擋下；否則先把非 active 項目 detach（避 FK）再刪。
- 位置照片重用既有照片管線（上傳 `POST /api/photos`、檢視 `/api/photo/[id]`）。
- 管理頁 `/admin/locations`（從 `/admin` 連入）。helpers 在 `src/lib/locations.ts`（有單元測試）。

### 待辦
- web 服務尚有 `NEXTAUTH_SECRET` / `LINE_LOGIN_*` / `AUTH_TRUST_HOST` 殘留變數（無害，未用）。
