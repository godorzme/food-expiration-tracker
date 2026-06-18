# 設計：文字判斷到期日 + 多照片一物 + 編輯重判/換照

**日期**：2026-06-18
**狀態**：已通過設計討論，待寫實作計畫

## 背景與目標

把「辨識 → 到期日 → 新增/編輯」整條流程升級：

1. **到期日改用「文字、兩步驟」判斷**：先用照片認出品項**名稱**，再用**文字 AI** 查該品項一般可放幾天（天數），到期日 = 放入日 + 天數。比現在的「12 類粗略保存期表」精準。類別表降為 AI 失敗時的後備。
2. **多照片、一張一物**：要記很多東西就一次拍/選**多張照片**，每張對應一項物品、各自辨識，並提醒使用者「一張照片 = 一項物品」。
3. **編輯邏輯**：
   - 改**品名** → AI 重新判斷，**跳出建議的新到期日讓使用者確認**（套用/保留）。
   - 改**放入日期** → 到期日**順移相同天數**（用原本「到期−放入」間距）。
   - **照片可換**（只換圖、不重判）。
4. 批次新增時所有照片**共用一個放入日期 + 存放點**；各品項到期日各自算（皆可手動改）。

非目標（YAGNI）：改 schema、一張照片辨識多項、換照片時自動重判、影片。

## 架構決策

- **兩步驟、文字優先**：視覺只負責「這是什麼（名稱+類別）」；天數由**文字 AI**（`estimateDaysFromName`）判斷。文字判斷比叫視覺模型猜天數可靠，且「編輯改名重判」本來就只有文字、沒有照片。
- **天數來源優先序**：文字 AI → 類別保存期表（既有 `loadShelfLife`）→ null（留空，使用者手填）。
- **批次新增 = client 端對每張照片各打一次 `/api/photos`**（沿用單張 endpoint，不改成多檔上傳），各回一項；前端組成多筆。
- **不存天數欄位**：到期日順移用「原到期−原放入」間距計算，免改 schema。

## 模組與介面

- `src/lib/expiryAI.ts`（new，server）：`estimateDaysFromName(name: string): Promise<number | null>`。
  - 呼叫 AI Hub `chat/completions`（純文字，無圖），prompt 要求只回 `{"days": <整數>}`（一般家庭冷藏可放天數）。解析、clamp 到 1..3650，失敗/未設定回 null。沿用 `AI_HUB_*` env。
- `src/app/api/estimate-expiry/route.ts`（new）：`POST { name }`（登入）→ `{ days: number | null }`（`estimateDaysFromName`，失敗再 fallback `loadShelfLife` 該類別？此 endpoint 僅依名稱，無類別 → 只回 textAI 結果，null 由前端決定）。給編輯改名重判 + 新增手動改名重算用。
- `src/app/api/photos/route.ts`（modify）：辨識改「**單一**品項」(取 `parseRecognition(...)[0]`)；對其名稱呼叫 `estimateDaysFromName`，天數 fallback 類別表；回傳改為：
  ```
  { photoId, capturedAt, item: { name, category, days } | null }
  ```
  （`item` 為 null 表示認不出 → 前端給空白列）。
- `src/lib/expiry.ts`：沿用 `estimateExpiry(category, storedAt, shelfLife)`（類別後備用）。新增小純函式 `addDays(base: Date, days: number): Date`（給天數→到期日；可測）。
- `src/app/api/food/[id]/route.ts`（modify）：PATCH 白名單加 `photoId`（`data.photoId = body.photoId || null`）。
- `src/components/AddFoodForm.tsx`（rework）：
  - 檔案輸入 `multiple`；選/拍多張 → 逐張 `POST /api/photos`（sequential，顯示「辨識中 n/N」）。
  - `Row` 介面改為每筆帶**自己的** `photoId`/`photoUrl`/`days`：`{ id, photoId, photoUrl, name, category, days, expiresAt, expiryEdited, fromAI }`。
  - 每張回來組一筆 row：`expiresAt = addDays(sharedStoredAt, days)`（days 為 null 則空）。
  - 共用 `storedAt` + `locationId`（必選、預設第一個）；改 `storedAt` → 對 `!expiryEdited` 的列用各自 days 重算。
  - 每筆 row 卡片顯示**自己的照片縮圖**；可改名稱/類別/到期日/刪該筆。
  - 提醒 banner：「📸 一張照片 = 一項物品」。
  - 保留「＋ 手動加一筆」(photoId null、days null、空白)。
  - 送出：每筆 item 帶**自己的** photoId、共用 storedAt/locationId、各自 expiresAt。
- `src/components/EditFoodSheet.tsx`（modify）：
  - 記 `origStored`、`origExpiry`、`origName`。
  - **改放入時間**：若有 `origExpiry`，`expiresAt = addDays(newStored, daysBetween(origStored, origExpiry))`（順移同間距）。
  - **改品名**：name != origName 且非空 → debounce 打 `/api/estimate-expiry` → 顯示建議列「🤖 依「{name}」建議到期日 {M/D} [套用]」；套用才改 `expiresAt`。
  - **換照片**：顯示現有照片 + 「換照片」→ `POST /api/photos` 取新 `photoId`（忽略其辨識結果）→ 更新預覽；儲存時 PATCH 帶 `photoId`。
  - 儲存照舊 PATCH（多帶 photoId）。

## 資料流

- 新增：選 N 張 → 逐張 `/api/photos`（vision→name、text→days）→ N 筆 row（各自 photo + 預填到期日）→ 共用放入日/存放點 → 送出。
- 編輯改名：`/api/estimate-expiry` → 建議到期日 → 使用者確認套用。
- 編輯改放入日：前端順移到期日（無需 AI）。
- 編輯換照：`/api/photos` 取 photoId（不取辨識）→ PATCH photoId。

## 錯誤處理 / 邊界

- 文字 AI / AI Hub 未設定或失敗 → `estimateDaysFromName` 回 null → fallback 類別表 → 再不行留空（沿用「留空＝可手填」）。
- 認不出品項（item null）→ 該張仍建立一筆（帶 photoId + 空名稱）讓使用者手填，不丟照片。
- 多張上傳：逐張 sequential、單張失敗只跳過該張（仍可手動加），顯示進度。
- 改放入日順移：需原本有到期日才順移；原本無到期日則不動（仍可手填或用 AI 重算鈕）。
- 換照片：上傳失敗顯示錯誤、保留原照片。
- PATCH photoId：來自本站 `/api/photos`（已登入）；可空（清除照片）。
- 批次很多張時 AI 成本/時間：sequential + 進度提示；使用者可中途先送出已辨識的。

## 測試（vitest，維持綠）

- `expiry.ts`：`addDays`（天數加法、跨月）。
- `expiryAI.ts`：解析 `{"days":N}` 的純 parse helper（抽出 `parseDays(raw): number|null`，含 clamp / 非法回 null）測試（不打網路）。
- 既有 recognition/foodView/avatar/locations 等測試不受影響（/api/photos 改回傳形狀，但無對應單元測試，靠 build + 真機）。
- 其餘 UI 靠 tsc + build + 真機 QA。

## 部署

1. 合併 main（無 schema 變更）。
2. `service redeploy web` → 等 RUNNING。
3. 真機 QA：
   - 新增:一次選多張照片 → 每張一筆、各自縮圖、各自到期日(文字 AI 判斷);有「一張=一物」提醒;共用放入日/存放點;可手動加一筆。
   - 編輯:改名 → 跳出 AI 建議到期日可套用;改放入日 → 到期日順移;換照片成功。
   - AI 未設情況下仍可手動操作不崩。
