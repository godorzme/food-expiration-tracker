# 冰箱／收納食物追蹤 App — 設計文件

- 日期：2026-06-13
- 狀態：設計已與使用者討論定案，待最終 spec 審閱
- 專案代號：`fridge-tracker`

## 1. 目的與成功標準

記錄所有放進冰箱或收納櫃的食物，追蹤每樣東西放了多久，並在快壞掉前主動提醒，減少食物浪費。

成功標準：

- 放入食物時拍一張照就能完成記錄（照片時間自動帶入，最少手動輸入）。
- 系統能自動辨識照片內容物並建議名稱與保存期，使用者可一鍵修正。
- 原始照片永久保留。
- 家人都能看到同一份清單，並各自收到到期提醒。
- 首頁一眼看出哪些東西快壞了。

## 2. 範圍與關鍵決策

| 主題 | 決策 |
|------|------|
| 使用範圍 | 家人／同住者共用：一個「家庭(household)」共用一份清單 |
| 登入 | LINE Login（與 LINE 推播共用同一 LINE Provider，userId 一致） |
| 辨識 | AI 視覺模型辨識（AI Hub，OpenAI 相容端點），失敗可退回手動 |
| 到期日 | 兩者都要：預設用「類別保存期」自動估算，使用者可手動覆寫 |
| 提醒管道 | App 內清單顯示 + LINE 推播 + 手機 Web Push |
| 部署 | Next.js 全端，程式碼放 GitHub、部署到 Zeabur |
| 物件儲存 | Cloudflare R2（原圖儲存） |
| 排程 | GitHub Actions cron（同 ragic-cron 套路），每日打提醒 API |

不做（YAGNI，初版排除）：

- 多家庭／多冰箱分權管理（先一個家庭、位置用標籤處理）。
- 條碼掃描、營養成分、購物清單。
- 原生 App（用 PWA 取得 Web Push 與「加到主畫面」）。

## 3. 系統架構

```
[手機瀏覽器 / PWA]
      │ 拍照上傳、查看清單、編輯、標記吃掉/丟掉
      ▼
[Next.js (App Router) on Zeabur] ── API 路由
      ├─ LINE Login（身份）
      ├─ 圖片上傳 → Cloudflare R2（原圖）
      ├─ AI 視覺辨識 → AI Hub（結構化 JSON 回傳）
      └─ POST /api/cron/remind ← GitHub Actions 每日觸發
      ▼
[PostgreSQL on Zeabur]
      │
      ├─ LINE Messaging API 推播（到期提醒）
      └─ Web Push（瀏覽器推播）
```

### 元件邊界

- **Auth 模組**：處理 LINE Login OAuth、session、把 LINE userId 綁到 user/household。對外介面：`getCurrentUser()`、middleware 守衛。
- **儲存模組**：原圖上傳/取得（R2 預簽名 URL），介面 `putPhoto(file) -> {objectKey, url}`、`getPhotoUrl(objectKey)`。
- **辨識模組**：輸入圖片，輸出結構化候選品項。介面 `recognize(imageRef) -> RecognizedItem[]`。失敗回空陣列、不丟例外。
- **保存期模組**：`estimateExpiry(category, storedAt) -> Date | null`，查 `shelf_life` 表。
- **提醒模組**：`findDueItems(now)`、`notify(user, items)`（LINE + Web Push）、去重寫 `reminder_log`。
- **食物 CRUD**：建立/編輯/標記狀態，皆以 household 為界。

每個模組可獨立測試，彼此用上述函式介面溝通。

## 4. 資料模型（PostgreSQL，Prisma）

- **households**：`id`、`name`、`reminder_lead_days`（提前幾天提醒，預設 2）
- **users**：`id`、`line_user_id`(unique)、`display_name`、`picture_url`、`household_id`
- **locations**：`id`、`household_id`、`name`（冷藏／冷凍／收納櫃…），可選
- **photos**：`id`、`object_key`、`captured_at`、`uploaded_by`（原圖一定保留）
- **food_items**：`id`、`household_id`、`photo_id`(nullable)、`location_id`(nullable)、`name`、`category`、`stored_at`（預設=拍照時間）、`expires_at`(nullable)、`status`（active／consumed／discarded／expired）、`created_by`、`notes`、`is_recognized`、`created_at`、`updated_at`
- **shelf_life**：`category`(PK)、`default_days`。種子資料（熟食 3、葉菜 5、肉類 2、乳製品 7…，後續可調）
- **push_subscriptions**：`id`、`user_id`、`endpoint`、`p256dh`、`auth`
- **reminder_log**：`id`、`food_item_id`、`reminded_on`(date)、`channel`；以 (food_item_id, reminded_on) 去重

## 5. 主要流程

### 5.1 新增食物
1. 使用者拍照或選圖（`<input type=file accept=image/* capture=environment>`）。
2. 上傳原圖到 R2，建立 `photos`，讀 EXIF `DateTimeOriginal` 當 `captured_at`；讀不到用上傳時間。
3. 呼叫 AI 辨識，回傳候選品項陣列：每項含 `name`、`category`、`confidence`、`suggested_days`。
4. 畫面預填候選（可能多筆）。使用者可：改名稱／類別、改放入時間（預設=拍照時間）、改到期日、拆成多筆、刪除某筆。
5. 到期日決定：使用者有填 → 用手動值；沒填 → `stored_at + shelf_life[category]` 自動估；隨時可覆寫。
6. 存檔，逐筆建立 `food_items`（共用同一 `photo_id`）。

辨識失敗或逾時：流程不中斷，直接進手動輸入，照片照常保留。

### 5.2 查看清單（App 內提醒）
- 首頁依 `expires_at` 升冪排序，狀態用顏色標示：
  - 已過期（紅）／今明到期（橘）／接近 ≤lead_days（黃）／充足（綠）／無到期日（灰）
- 每筆可標記「吃掉(consumed)」「丟掉(discarded)」。
- 可依位置/類別篩選。

### 5.3 到期推播（每日）
1. GitHub Actions cron 每日打 `POST /api/cron/remind`（帶共享密鑰驗證）。
2. 找出 `status=active`、`expires_at <= today + household.reminder_lead_days`、且今天尚未在 `reminder_log` 出現的 item。
3. 依 household 聚合，對家庭成員發 LINE 推播 + Web Push（內容：N 樣東西快到期/已過期清單）。
4. 寫入 `reminder_log` 去重。推播失敗只記錄、不中斷。

## 6. 技術選型

- Next.js（App Router）+ TypeScript + Tailwind CSS
- PWA：manifest + service worker（Web Push 用）
- Prisma + PostgreSQL（Zeabur）
- Cloudflare R2（S3 相容，原圖儲存，前端走預簽名 URL 上傳）
- AI Hub 視覺模型（OpenAI 相容 API，要求回傳 JSON schema）
- LINE Login + LINE Messaging API（同一 Provider）
- `web-push` 套件（VAPID）
- EXIF 解析（`exifr` 或同類）

## 7. 錯誤處理

- AI 辨識失敗/逾時：退回手動輸入，照片仍保存，記錄一筆 log。
- 推播失敗（LINE 未加好友 / Web Push 端點失效）：記錄；失效的 Web Push 訂閱自動清除；App 內清單為永遠可靠的 fallback。
- 上傳失敗：明確錯誤訊息並可重試，未成功不建 `food_items`。
- LINE userId 與推播：同一 Provider 下 Login channel 與 Messaging API channel 的 userId 一致；onboarding 提示使用者加官方帳號好友才收得到 LINE 推播。

## 8. 測試策略

- 單元：`estimateExpiry`（各類別/邊界）、到期門檻判定、`reminder_log` 去重、EXIF 時間解析 fallback。
- 整合：上傳→辨識→存檔流程（AI 與 R2 用 mock）；cron 提醒端點（含密鑰驗證、去重）。
- 端到端（精簡）：LINE Login 後新增一筆、清單顯示、標記吃掉。

## 9. 未決/後續

- `shelf_life` 種子值上線後依實際使用微調。
- 提前提醒天數初版用 household 單一設定，未來可做每類別/每品項。
