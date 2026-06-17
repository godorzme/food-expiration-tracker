# 設計：對齊租寓 UI 規範 + 破圖修正 + 新增頁照片/到期日

**日期**：2026-06-17
**狀態**：已通過設計討論，待寫實作計畫

## 背景與目標

依 `portal-app/docs/UI規範.md`（租寓 UI single source of truth）對齊本 App 的 UI，並修掉真機檢出的破圖、補上新增流程的兩個體驗（照片置頂、AI 到期日先帶出可編輯）。

**使用者明確覆寫**：保留先前的「奶油白底 `#FBF7F0`」溫暖風（規範的合法組合是白底，但使用者選擇保留奶油底）。其餘規範條目照走。

適用規範條目（其餘 portal 專屬如 RagicPicker / ProgressPanel / $金額 / 不出現 Ragic / SSO / 簽核不適用本 App）：品牌色與字型、手機六大必檢、每頁返回鍵、載入失敗三態、按鈕列可橫滑、不爆框。

非目標（YAGNI）：改 schema、改後端資料模型、動既有商業邏輯。

## 1. 配色 / 字型對齊（保留奶油底）

- 背景維持奶油白 `#FBF7F0`、卡片白。
- **主色租寓綠 `#5FBE91`**（已用）、深綠按下態 `#3E9E73`。
- **文字色改為租寓灰 `#3C4650`**（取代現用的 `#2D2A26`）；次要文字維持柔和灰 `#8A8178`（保留，屬奶油風中性色，不違反品牌）。
- 輔助色僅限：租寓黃 `#FFE450`、租寓藍 `#2D8FD2`。**禁用**：金色（`#D4960F`/`#F5D623`…）、自創深綠（`#2E5339`…）、襯線體。
- 字型維持 Noto Sans TC。
- 集中於 `globals.css` 的 token（`--ink` 改 `#3C4650`，新增 `--accent-yellow`/`--accent-blue` 備用）。

## 2. 狀態標籤（StatusPill）

- 文案：`ok` 由「充足」改為「**安全**」。
- 顏色（語意保留紅，其餘貼近品牌）：過期 `expired` 紅 `#E5484D`；今明 `urgent` 橘 `#F5821F`；接近 `soon` 黃（用租寓黃 `#FFE450` 底 + 灰字，避免白底黃字對比不足）；安全 `ok` 租寓綠 `#5FBE91`；無到期 `none` 灰。
- **不換行**：`StatusPill` 加 `whitespace-nowrap flex-shrink-0`，卡片品名 `truncate` 讓位（修破圖：320px 長品名時「充足」變「充/足」）。
- `statusMeta` 的 `label` 與測試一併更新（`ok` → 「安全」）。

## 3. 手機六大必檢 + 三件套（照規範逐項）

- **頂部瀏海**：`AppHeader` 已用 `env(safe-area-inset-top)`，保留。
- **底部 home indicator**：首頁固定「＋ 新增食物」已用 `env(safe-area-inset-bottom)`，保留；確認其餘無被遮。
- **返回鍵**：`/add`、`/me`、`/admin`、`/admin/locations` 皆有「‹ 返回」；首頁為根頁（免）；登入頁（免）。維持。
- **載入失敗三態（補齊）**：`FoodList` 已有 loading/error/retry。**`AdminUsers`、`AdminLocations` 目前只有紅字 → 補上醒目「重新整理」按鈕**（綠底白字 `#5FBE91`，點擊重設 loading 重新 fetch，不 reload page）。`MyProfile` 由 server 傳 props 無載入態（免）。
- **按鈕列可橫滑 / 不爆框**：`LocationChips` 已 `overflow-x-auto`。`AdminLocations` 每列「換照/改名/刪除」三鈕在窄螢幕加 `flex-wrap` 或縮短，避免擠爆；`AdminUsers` 列同檢查。卡片內仍用 flex + `min-w-0` + truncate，不寫死 px。

## 4. 首頁卡片到期日（修破圖 + 凸顯）

- 卡片資訊重排：
  - 第 1 行：品名（truncate）＋ StatusPill（不換行）。
  - 第 2 行：**到期日獨立顯示、短格式 `M/D`、不截斷**（例「到期 6/20」）；無到期日顯示「無到期日」。
  - 第 3 行：類別 · 存放點（可 truncate）。
  - 第 4 行：加入者頭像 + 名字（沿用）。
  - 動作鈕：吃掉 / 丟掉。

## 5. 新增頁：照片置頂（A）

- `AddFoodForm`：上傳取得 `photoId` 後，表單**最上方顯示該照片預覽**（圓角 `<img src="/api/photo/<photoId>">`，寬滿版、限高），下方一個「重拍 / 換照片」label（重用同一 `<input type=file>`）。未上傳時維持現在的虛線「📷 拍照或選相簿」大按鈕。

## 6. 新增頁：AI 到期日先帶出 + 可編輯（B）

- **`GET /api/shelf-life`**（登入即可，新）：回 `Record<category, days>`（讀 `loadShelfLife`）。
- **`/api/photos` 辨識回應**：對每個 recognized item 附 `expiresAt`（用 `capturedAt + shelfLife[category]` 估算，ISO date；無對應類別則 null）。
- **`AddFoodForm`**：
  - 載入時抓 `/api/shelf-life` 存 map。
  - 每筆 row 加 `expiryEdited: boolean`（使用者手動改過到期日才設 true）。
  - 預填：recognized 帶回的 `expiresAt` → row.expiresAt（顯示在到期日欄）。
  - 自動重算：當該 row 的「類別」或全域「放入時間」變動且 `!expiryEdited` → 重算 `storedAt + shelfLife[category]` 帶入。
  - 使用者直接編輯到期日欄 → 設 `expiryEdited=true`，之後不再被覆寫。
  - 到期日欄清楚標示（label「到期日（AI 估算，可改）」）。

## 模組與介面

- `src/app/globals.css`：`--ink` 改 `#3C4650`，加 `--accent-yellow:#FFE450`、`--accent-blue:#2D8FD2`。
- `src/components/ui/StatusPill.tsx` + `.test.ts`：`ok` label 改「安全」、加 `whitespace-nowrap flex-shrink-0`、色調整；測試更新。
- `src/components/FoodList.tsx`：卡片資訊重排（到期日獨立行、短格式）。
- `src/components/AdminUsers.tsx` / `src/components/AdminLocations.tsx`：load 失敗加 retry 按鈕；窄螢幕按鈕列防爆。
- `src/app/api/shelf-life/route.ts`（new）：GET 回類別→天數。
- `src/app/api/photos/route.ts`：辨識結果附估算 `expiresAt`（用既有 `loadShelfLife` + `resolveExpiresAt`/`estimateExpiry` + capturedAt）。
- `src/components/AddFoodForm.tsx`：照片預覽置頂 + 到期日預填/重算/可編輯邏輯。
- 文字色 `#2D2A26` → `#3C4650` 全面替換（各元件 className 內的 `text-[#2d2a26]`）。

## 錯誤處理 / 邊界

- 估算到期日：類別無 shelf-life → 不帶（留空，沿用「留空＝依類別自動估」server 行為）。
- 使用者手動清空到期日 → 視為手動（`expiryEdited=true`），server 端仍會在存檔時依類別補估（既有行為），一致。
- 破圖：品名/存放點過長 truncate；狀態膠囊不換行；到期日不截斷。
- retry：三態 loading/error/retry，error 顯示訊息 + 綠底「重新整理」按鈕，重設 state 重 fetch（不 reload page）。

## 測試（vitest，維持綠）

- `StatusPill.test.ts`：`ok` → 「安全」（更新既有斷言）。
- `avatar`/`locations`/其餘既有測試不受影響。
- 新增 `shelf-life` / 到期日預填邏輯：把「依類別+storedAt 估到期日」抽純函式（已有 `estimateExpiry`）—— 在 AddFoodForm 用它；若新增 client 端 helper 則補測試。
- 其餘靠 tsc + build + 部署 smoke + 真機 QA。

## 部署

1. 合併 main（無 schema 變更）。
2. `service redeploy web` → 等 RUNNING。
3. 真機 QA：320/390px 下狀態膠囊不換行、到期日不截斷;「安全」標籤;新增頁照片置頂、到期日自動帶出可改;AdminUsers/Locations 載入失敗有重整鈕;配色為奶油底+租寓綠+灰字。
