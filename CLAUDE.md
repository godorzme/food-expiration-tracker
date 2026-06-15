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
2. AI 辨識內容物 → `AI_HUB_*` OpenAI 相容視覺端點（未填則辨識回空清單、可手動輸入）
3. 估算有效期限 → Postgres + `ShelfLife` 12 類保存期（已 seed）

### 灌 seed（保存期資料）
production 是 standalone build、無 prisma/tsx CLI，從本機用 Postgres 對外 TCP 跑：
```bash
DATABASE_URL="postgresql://root:<pw>@<public-host>:<port>/zeabur" npx tsx prisma/seed.ts
```
（對外 host:port 用 `service network --id <postgresql>` 取得；seed 為 upsert，可重跑）

### 待辦
- AI 辨識（功能 2）：填 `AI_HUB_BASE_URL` / `AI_HUB_API_KEY` / `AI_HUB_VISION_MODEL` 到 web 服務後 redeploy。
- 照片「顯示」功能尚未做（`getPhotoUrl` 未被前端使用）；之後要顯示，需對 MinIO `web`(9000) 綁公開網域，presigned URL 才能被瀏覽器讀取。
- web 服務尚有 `NEXTAUTH_SECRET` / `LINE_LOGIN_*` / `AUTH_TRUST_HOST` 殘留變數（無害，免登入後未用）。
