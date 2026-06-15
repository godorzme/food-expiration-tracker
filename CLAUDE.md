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

### 登入 / 權限（2026-06-15 上線）
- **全站需登入**：輸入電話即登入（不驗證，家人信任情境）；中介層擋未登入。
- **管理員**：寫死常數 `ADMIN_PHONE = "0926571988"`（`src/lib/auth/admin.ts`），只有此號碼能進 `/admin` 增刪使用者。
- Session：HMAC 簽章 cookie `fridge_session`，需 `SESSION_SECRET`（已設 web 服務）；`getCurrentUser()` 每請求回 DB 確認 → 刪人即時失效。
- 設計/計畫：`docs/superpowers/specs/2026-06-15-admin-phone-login-design.md`、`docs/superpowers/plans/2026-06-15-admin-phone-login.md`。
- ⚠️ **edge middleware 雷**：`src/middleware.ts` 在 edge runtime 跑，**不可**(直接或間接)匯入 Prisma / `next/headers` / 任何 Node-only 模組，否則 `node:util/types` 載入失敗、全站 500。故 `SESSION_COOKIE` 常數放在無依賴的 `src/lib/auth/cookie.ts`，middleware 只從那裡匯入。驗證法：build 後 grep `.next/server/edge/chunks/*.js` 不得出現 `adapter-pg`/`node:util/types`。本機 `next build` 不會擋下此錯，只在 Zeabur runtime 爆。

### 灌 seed（保存期資料）
production 是 standalone build、無 prisma/tsx CLI，從本機用 Postgres 對外 TCP 跑：
```bash
DATABASE_URL="postgresql://root:<pw>@<public-host>:<port>/zeabur" npx tsx prisma/seed.ts
```
（對外 host:port 用 `service network --id <postgresql>` 取得；seed 為 upsert，可重跑）

### 待辦
- 照片「顯示」功能尚未做（`getPhotoUrl` 未被前端使用）；之後要顯示，需對 MinIO `web`(9000) 綁公開網域，presigned URL 才能被瀏覽器讀取。
- web 服務尚有 `NEXTAUTH_SECRET` / `LINE_LOGIN_*` / `AUTH_TRUST_HOST` 殘留變數（無害，未用）。
- Next 16 已 deprecate `middleware.ts`，建議改名 `proxy.ts` + export `proxy`（目前仍可運作、只是 build 警告）。
- 舊 `local-default` 假使用者（名「我」、phone=null）仍在使用者名單顯示；登不進、可由管理員自行刪。
