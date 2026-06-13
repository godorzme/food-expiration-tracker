# 冰箱食物追蹤 (Fridge Tracker)

家人共用的食物記錄 App：放食物時拍張照,系統用 AI 辨識內容物、估算保存期,追蹤每樣東西放了多久,並在快壞掉前用 App 清單 / LINE / 手機推播主動提醒。

> 設計文件：`docs/superpowers/specs/2026-06-13-fridge-tracker-design.md`
> 實作計畫：`docs/superpowers/plans/2026-06-13-fridge-tracker.md`

## 功能

- **拍照記錄**：上傳照片即記錄,原圖永久保存到物件儲存;放入時間預設＝照片 EXIF 拍照時間。
- **AI 辨識**：照片送多模態視覺模型,回傳品項清單(可多項),預填名稱/類別,可手動修改、拆筆、刪除。
- **到期追蹤**：到期日「手動填優先,否則依類別保存期自動估算」;首頁清單依到期日排序並用顏色標示(已過期/今明到期/接近/充足)。
- **三種提醒**：App 內清單、LINE 推播、手機 Web Push;每日排程找出快過期的食物推播給家庭成員,並去重避免重複轟炸。
- **家庭共用**：LINE 登入,同一家庭(household)共用一份清單。

## 技術棧

- Next.js 16 (App Router) + TypeScript + Tailwind CSS,PWA(manifest + service worker)
- Prisma 7 + PostgreSQL(透過 `@prisma/adapter-pg` 驅動)
- Cloudflare R2(S3 相容)儲存原圖
- AI Hub(OpenAI 相容)視覺模型辨識
- NextAuth (Auth.js) v5 + LINE Login;LINE Messaging API + `web-push` 做推播
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
| `LINE_LOGIN_CHANNEL_ID` / `LINE_LOGIN_CHANNEL_SECRET` | LINE Login channel |
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | LINE Messaging API channel(推播用) |
| `NEXTAUTH_SECRET` | NextAuth session 加密金鑰(`openssl rand -base64 32`) |
| `APP_BASE_URL` | 對外網址(本機 `http://localhost:3000`) |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | Cloudflare R2 |
| `AI_HUB_BASE_URL` / `AI_HUB_API_KEY` / `AI_HUB_VISION_MODEL` | AI Hub 視覺辨識(OpenAI 相容端點) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push 金鑰(`npx web-push generate-vapid-keys`) |
| `CRON_SECRET` | 提醒 API 的存取密鑰(GitHub Actions 帶同一組) |

未設定 AI Hub / VAPID / LINE 時對應功能會「優雅降級」:辨識回空清單(仍可手動輸入)、推播回 false(App 清單永遠是 fallback),不會中斷主要流程。

## LINE Provider 設定(一次性)

在 LINE Developers Console 建立**一個 Provider**,底下開兩個 channel:

1. **LINE Login channel** → Channel ID/Secret 填入 `LINE_LOGIN_*`,Callback URL 設 `${APP_BASE_URL}/api/auth/callback/line`。
2. **Messaging API channel** → access token 填入 `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`(用於推播)。

兩個 channel 放在同一 Provider 下,`userId` 才會一致(登入拿到的 id 就是推播目標)。使用者需把官方帳號加為好友,才收得到 LINE 推播。

## 部署(Zeabur + GitHub)

1. 推到 GitHub。
2. 在 Zeabur 開 PostgreSQL,並部署本 repo 為 Next.js 服務。
3. 把 `.env.example` 內所有變數設到 Zeabur 服務環境(`APP_BASE_URL` 用部署後網址)。
4. 對 Zeabur DB 跑 `npx prisma db push` 與 `npx prisma db seed`。
5. 在 LINE Login channel 的 Callback URL 加上部署網址的 `/api/auth/callback/line`。

### 每日提醒 cron

`.github/workflows/remind.yml` 每天 UTC 01:00(台灣早上 9 點)`POST ${APP_BASE_URL}/api/cron/remind`。
在 GitHub repo 的 Actions secrets 設定 `APP_BASE_URL` 與 `CRON_SECRET`(與部署環境一致)。可用 workflow 的「Run workflow」(workflow_dispatch)手動測試。

## 專案結構

- `src/lib/` — 純邏輯與服務模組(各有單元測試):`exif`、`expiry`、`food`、`expiryState`、`recognition`、`reminders`、`aiVision`、`linePush`、`webPush`、`storage`、`shelfLife`、`db`、`auth`、`session`、`household`。
- `src/app/api/` — route handlers:`photos`(上傳+辨識)、`food`(清單/新增)、`food/[id]`(更新/標記)、`push/subscribe`、`cron/remind`、`auth/[...nextauth]`。
- `src/components/` — `FoodList`、`AddFoodForm`、`EnablePush`。
- `prisma/` — schema 與 seed。
