# 設計：照片顯示 + 「誰加的食物」（含兩個機械任務）

**日期**：2026-06-15
**狀態**：已通過設計討論，待寫實作計畫

## 背景與目標

登入功能上線後，接著補三類事：

1. **照片顯示**：冰箱清單每筆食物若有照片，左側顯示**小縮圖**，點縮圖**放大看大圖**（lightbox）。目前 `getPhotoUrl`（presigned）已存在但沒被使用，且 MinIO 只有內部 endpoint，瀏覽器讀不到。
2. **「誰加的食物」**：每筆食物顯示加入者名字（登入後 `createdBy` 是真實 user）。查不到（舊資料／已刪使用者）則省略。
3. **機械任務**（無設計爭議，併入同一輪做）：
   - `middleware.ts` → `proxy.ts`（Next 16 已 deprecate middleware 慣例）。
   - 刪掉舊 `local-default` 假使用者（名「我」、phone=null），連同其 `PushSubscription`。

非目標（YAGNI）：相簿/多圖瀏覽、圖片編輯、CDN、縮圖預先產製（用瀏覽器縮放即可）、編輯既有食物的照片。

## 架構決策

**照片serve = 綁公開網域 + presigned 簽名網址（方案 A）**。幫 MinIO 的 `web`(9000) 綁公開網域；後端用**公開 endpoint** 簽 presigned GET URL，瀏覽器即可讀，且網址有簽名 + 1 小時時效（私密）。上傳仍走內部 endpoint（快、不計外部流量）。排除「bucket 公開讀取」（圖片不受保護，較不隱私）。

關鍵點：presigned URL 的簽章涵蓋 host，所以**簽名用的 client 必須用公開 endpoint**，否則簽出來的網址 host 是內部位址、瀏覽器連不到。

## 模組與介面

- `src/lib/storage.ts`（modify）：
  - 維持既有上傳 client（`S3_ENDPOINT` 內部）。
  - 新增「簽名用」client：endpoint 取 `S3_PUBLIC_ENDPOINT`（未設則 fallback 既有 `S3_ENDPOINT`），其餘設定（credentials / region / forcePathStyle）與上傳 client 相同。
  - `getPhotoUrl(key, expiresInSec=3600)` 改用簽名 client 產生 presigned GET URL。
  - `putPhoto` 不變（用上傳 client）。
- `src/lib/foodView.ts`（new，純函式 + 測試）：`buildCreatorNameMap(users)` 回 `Record<userId, displayName>`；以及/或 `creatorNameFor(createdBy, map): string | null`。讓「id→名字」邏輯可獨立測試。
- `src/app/api/food/route.ts`（modify GET）：
  - 既有 `findMany`（含 `photo: true`）後，對每筆有 `photoId`/`photo.objectKey` 的 item 產生 `photoUrl = await getPhotoUrl(objectKey)`。
  - 撈本 household 成員 `db.user.findMany({ where: { householdId } })`，用 `buildCreatorNameMap` 建對照，為每筆附 `createdByName = map[createdBy] ?? null`。
  - 回傳 DTO 每筆加 `photoUrl: string | null` 與 `createdByName: string | null`。
- `src/components/FoodList.tsx`（modify）：
  - DTO 介面加 `photoUrl?: string | null`、`createdByName?: string | null`。
  - 每列左側：有 `photoUrl` 時顯示 ~56px 圓角縮圖（`<img>`，`object-cover`，loading="lazy"）；無則不佔位或顯示淡灰 placeholder。
  - 點縮圖 → 開 lightbox（同檔的輕量 client 元件 `<PhotoLightbox>`：全螢幕半透明黑底 + 置中大圖 + 點背景/✕ 關閉；Esc 關閉）。
  - 品項詳情那行小字尾端加「· {createdByName} 加的」（`createdByName` 為 null 則不加）。
  - 維持既有到期顏色、吃掉/丟掉按鈕、手機觸控友善。
- `src/components/PhotoLightbox.tsx`（new client 元件）或併入 FoodList——獨立元件較清晰。

## 機械任務細節

- **middleware → proxy**：將 `src/middleware.ts` 改名 `src/proxy.ts`，匯出函式由 `middleware` 改名 `proxy`，`config.matcher` 不變；內容與 import（`@/lib/auth/cookie` 的 `verifySession` + `SESSION_COOKIE`）不變。依 AGENTS.md 對照 `node_modules/next/dist/docs/` 確認 Next 16 的 proxy 慣例（檔名/匯出名）。build 後不應再有 deprecation 警告，且仍顯示 Proxy/Middleware 作用中。
- **刪舊「我」帳號**：對 prod DB（Postgres 對外 TCP，連線見專案 CLAUDE.md）刪除 `phone IS NULL` 且 `lineUserId = 'local-default'` 的 user，先刪其 `PushSubscription`。屬一次性資料操作（非程式）。現無食物資料，無孤兒疑慮；即便有，食物以 `householdId` 查仍顯示，只是 `createdByName` 變 null。

## 資料流

清單載入：`/api/food` → 撈 items（含 photo 關聯）+ household 成員 → 每筆算 `photoUrl`(presigned, 公開 endpoint 簽) + `createdByName`(成員對照) → 回 client。`FoodList` 渲染縮圖、加入者小字；點縮圖開 lightbox。presigned URL 1 小時時效，清單每次重載重簽，足夠。

## 錯誤處理 / 邊界

- 未綁公開網域 / 未設 `S3_PUBLIC_ENDPOINT`：`getPhotoUrl` fallback 用內部 endpoint 簽（本機開發無妨）；prod 必設公開網域才看得到圖。部署步驟會設。
- item 無照片 → `photoUrl: null`，不顯示縮圖。
- 縮圖載入失敗（`<img onError>`）→ 隱藏該縮圖，不破版。
- `createdBy` 對不到成員（舊資料／已刪）→ `createdByName: null` → 不顯示「加的」字樣。
- presigned URL 過期（使用者停留超過 1 小時才點放大）→ 圖可能 403；lightbox 用的是清單當下的 URL，重新整理即可重簽。可接受。

## 測試（vitest，維持現有 52 綠）

- `foodView`：`buildCreatorNameMap` / `creatorNameFor`——成員對照、查不到回 null。
- `storage`（若可純測）：簽名 client 在有 `S3_PUBLIC_ENDPOINT` 時用公開 endpoint、無時 fallback。可用輕量驗證（檢查產生的 URL host）或至少型別/邏輯分支測試；若難以單元測試，於部署 smoke 階段以真實上傳→取得 photoUrl→curl 該 URL 回 200 驗證。
- UI 元件不寫單元測試（沿用本專案慣例：邏輯抽純函式測，UI 靠 build + 真人/ smoke）。

## 部署（實作 + 本機驗證全綠後）

1. Zeabur 後台幫 `minio` 服務的 `web`(9000) port **綁一個公開網域**（Dashboard 操作），取得公開 endpoint，例如 `https://<name>.zeabur.app`。
2. 設 `S3_PUBLIC_ENDPOINT=<該公開網域>` 到 `web` 服務環境變數。
3. 合併到 main → `service redeploy web` → 等 RUNNING。
4. 一次性：對 prod DB 刪舊「我」帳號（連 pushSubs）。
5. Smoke：登入後上傳一張食物照→`/api/food` 回 `photoUrl`→`curl` 該 URL 回 200（圖讀得到）；清單顯示縮圖 + 加入者名字；`proxy` 仍正確擋未登入。
