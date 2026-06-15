# 冰箱食物追蹤 (Fridge Tracker)

家人共用的食物記錄 App：放食物時拍張照,系統用 AI 辨識內容物、估算保存期,追蹤每樣東西放了多久,並在快壞掉前用 App 清單與手機推播主動提醒。目前未設登入,打開網址即用、共用同一份清單。

> 設計文件：`docs/superpowers/specs/2026-06-13-fridge-tracker-design.md`
> 實作計畫：`docs/superpowers/plans/2026-06-13-fridge-tracker.md`

## 功能

- **拍照記錄**：上傳照片即記錄,原圖永久保存到物件儲存;放入時間預設＝照片 EXIF 拍照時間。
- **AI 辨識**：照片送多模態視覺模型,回傳品項清單(可多項),預填名稱/類別,可手動修改、拆筆、刪除。
- **到期追蹤**：到期日「手動填優先,否則依類別保存期自動估算」;首頁清單依到期日排序並用顏色標示(已過期/今明到期/接近/充足)。
- **提醒**：App 內清單 + 手機 Web Push;每日排程找出快過期的食物並推播提醒,去重避免重複轟炸。
- **免登入共用**：打開網址即用,所有人共用同一份冰箱清單(單一 household)。目前未設登入,日後可再加回 LINE Login。

## 技術棧

- Next.js 16 (App Router) + TypeScript + Tailwind CSS,PWA(manifest + service worker)
- Prisma 7 + PostgreSQL(透過 `@prisma/adapter-pg` 驅動)
- Cloudflare R2(S3 相容)儲存原圖
- AI Hub(OpenAI 相容)視覺模型辨識
- `web-push` 做手機推播(目前未設登入)
- 每日提醒由 GitHub Actions cron 觸發

## 本機開發

```bash
npm install
cp .env.example .env   # 填入下列環境變數
npx prisma generate
npx prisma db push     # 需要可連線的 PostgreSQL（見下方 DATABASE_URL）
npx prisma db seed     # 寫入 12 類食物的預設保存期
npm run dev            # http://localhost:3000
```

測試與建置：

```bash
npm run test    # 或 npx vitest run —— 純邏輯單元測試
npx tsc --noEmit
npx next build
```

> 註：本專案的 Prisma 7 用 `prisma.config.ts` 設定 `DATABASE_URL` 與 seed 指令;runtime 透過 `@prisma/adapter-pg` 連線,所以 `src/lib/db.ts` 以連線字串建立 adapter。

## 環境變數(`.env.example`)

| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 連線字串 |
| `APP_BASE_URL` | 對外網址(本機 `http://localhost:3000`) |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` | S3 相容物件儲存(原圖)。生產環境用 Zeabur Object Storage(MinIO)。另可選 `S3_REGION`、`S3_FORCE_PATH_STYLE`(MinIO 須為 `true`) |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | (相容用)未設 `S3_ENDPOINT` 時改走 Cloudflare R2 |
| `AI_HUB_BASE_URL` / `AI_HUB_API_KEY` / `AI_HUB_VISION_MODEL` | 視覺辨識(OpenAI 相容端點,可填 Zeabur AI Hub 或自有 key) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push 金鑰(`npx web-push generate-vapid-keys`) |
| `CRON_SECRET` | 提醒 API 的存取密鑰(GitHub Actions 帶同一組) |

未設定 AI Hub / VAPID 時對應功能會「優雅降級」:辨識回空清單(仍可手動輸入)、推播回 false(App 清單永遠是 fallback),不會中斷主要流程。

## 部署(Zeabur + GitHub)

1. 推到 GitHub。
2. 在 Zeabur 開 PostgreSQL,並部署本 repo 為 Next.js 服務。
3. 把 `.env.example` 內所有變數設到 Zeabur 服務環境(`APP_BASE_URL` 用部署後網址)。
4. 對 Zeabur DB 跑 `npx prisma db push` 與 `npx prisma db seed`。

### 每日提醒 cron

`.github/workflows/remind.yml` 每天 UTC 01:00(台灣早上 9 點)`POST ${APP_BASE_URL}/api/cron/remind`。
在 GitHub repo 的 Actions secrets 設定 `APP_BASE_URL` 與 `CRON_SECRET`(與部署環境一致)。可用 workflow 的「Run workflow」(workflow_dispatch)手動測試。

## 專案結構

- `src/lib/` — 純邏輯與服務模組(各有單元測試):`exif`、`expiry`、`food`、`expiryState`、`recognition`、`reminders`、`aiVision`、`linePush`、`webPush`、`storage`、`shelfLife`、`db`、`session`(免登入,get-or-create 單一 household)、`household`。
- `src/app/api/` — route handlers:`photos`(上傳+辨識)、`food`(清單/新增)、`food/[id]`(更新/標記)、`push/subscribe`、`cron/remind`。
- `src/components/` — `FoodList`、`AddFoodForm`、`EnablePush`。
- `prisma/` — schema 與 seed。
