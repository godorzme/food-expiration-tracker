# 設計：手機優先視覺改版（溫暖卡片風）

**日期**：2026-06-16
**狀態**：已通過設計討論，待寫實作計畫

## 背景與目標

App 幾乎只在手機上使用，但目前是 Next 預設的陽春樣式（白底、Arial、黑色按鈕、無 design system）。目標：**純視覺/版面改版**成「溫暖卡片風」、手機優先，套用到全部四個畫面（`/login`、`/`、`/add`、`/admin`）。

**硬界線**：只改呈現層。**不改任何 API、商業邏輯、資料模型、互動流程**。現有 57 單元測試維持綠；`next build` 過。

## 設計系統（溫暖卡片風）

集中定義在 `globals.css`（CSS 變數 + Tailwind v4 `@theme`），各畫面用一致的 token：

- **色彩**
  - 背景 `--bg: #FBF7F0`（奶油白）；卡片 `--card: #FFFFFF`
  - 主色（品牌租寓綠）`--brand: #5FBE91`；主色深 `--brand-ink: #3E9E73`（按鈕按下/文字對比）
  - 文字 `--ink: #2D2A26`；次要文字 `--muted: #8A8178`
  - 狀態色：過期 `#E5484D`、今明 `#F5821F`、接近 `#E5B72A`、充足 `#5FBE91`、無到期 `#B8B2A8`
- **字體**：中文 **Noto Sans TC**（`next/font/google`），fallback system-ui。移除預設的 Geist/Arial 與 `globals.css` 的 dark-mode 覆寫（避免奶油底被深色蓋掉）。
- **圓角**：卡片 16px、輸入框/按鈕 12px。**陰影**：卡片柔和 `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)`。
- **間距**：頁面左右 padding 16px、卡片內距 12–16px、卡片間距 12px。
- **觸控**：所有可點元素高度 ≥ 44px。
- **安全區**：`viewport-fit=cover` + 頂部 `env(safe-area-inset-top)`、底部固定列 `env(safe-area-inset-bottom)`（iOS 瀏海 / home indicator）。

## 各畫面（手機優先，單欄、`max-w` 收斂 ~ 28rem）

### `/`（冰箱清單，主畫面）— `FoodList` + 首頁 wrapper
- **頂部問候列**：左「冰箱清單」+ 今日日期小字；右 ⚙️管理（管理員才顯示）、登出。sticky、奶油底。
- **食物卡片**（`FoodList` 每列）：白卡、左側 **64px 圓角縮圖**（無照片顯示淡灰 placeholder icon；點縮圖開既有 `PhotoLightbox`）。右側：品項名（粗）、下一行 `類別 · 誰加的 · 到期日` 小字、**狀態膠囊**（如「🔴 已過期」「🟠 今明到期」）。卡片**左緣 4px 狀態色**粗邊。右側「吃掉/丟掉」改為小圖示按鈕（✓ / 🗑），觸控區足夠。
- **底部固定**：寬版綠色「＋ 新增食物」按鈕（取代現在頂部的小連結），留安全區。
- loading/error/空狀態：用柔和插圖式文案卡片（沿用現有文字內容）。

### `/add`（新增）— `AddFoodForm` + wrapper
- 頂部標題列 + ‹返回。
- **拍照/選相簿**：大型虛線卡片按鈕（相機 icon + 「拍照或選相簿」），取代裸 `<input type=file>`（input 隱藏、label 觸發）。
- 「辨識中…」改為帶 spinner 的卡片。
- 每筆食物一張白卡：大輸入框（名稱）、類別下拉、到期日；「刪除這筆」小紅字。
- 「＋ 再加一筆」次要按鈕；底部固定綠色「儲存」（取代黑色按鈕）。

### `/login`
- 垂直置中、奶油底。App 名稱 + 一句說明。大電話輸入框（圓角、置中）、綠色大「登入」鈕。錯誤訊息紅字卡片。

### `/admin`（管理）— `AdminUsers` + wrapper
- 沿用卡片風。每列白卡：名字（+管理員膠囊）、電話小字；右側「編輯」「刪除」改為清楚的文字+圖示按鈕（觸控區 ≥44px）。
- 新增表單卡片：大輸入框 + 綠色「新增」。
- 編輯模式：同卡片內切換為輸入框 + 儲存/取消（沿用現有邏輯）。

## 元件邊界

- `globals.css`：design tokens + base（body 奶油底、字體、移除 dark-mode 覆寫）。
- `layout.tsx`：載入 Noto Sans TC、設 `viewport` `viewportFit: "cover"`、套字體變數到 `<html>`。
- 共用小元件（新增，純呈現）：`src/components/ui/StatusPill.tsx`（吃 `ExpiryState` → 對應色 + 文案）、`src/components/ui/AppHeader.tsx`（頂部列：標題/日期/右側動作 slot）。讓首頁/管理頁共用、各檔聚焦。
- 既有元件改 className 為主：`FoodList`、`PhotoLightbox`(微調)、`AddFoodForm`、`AdminUsers`、`LoginForm`、各 `page.tsx` wrapper。
- **`expiryState` 邏輯不動**；`StatusPill` 只是把既有 state 對應到顏色/文字（文字對照可加測試）。

## 錯誤處理 / 邊界

- 無照片 → placeholder，不破版（沿用 `onError` 隱藏）。
- 長品項名/長名字 → `truncate` 或換行不溢出（手機 305px 寬也不爆框）。
- 固定底部按鈕不可遮住最後一張卡片 → 清單底部留 padding。
- 深色模式：統一用淺色設計，移除預設 dark 覆寫（避免半套深色）。

## 測試

- 不動邏輯，現有 **57 測試維持綠**。
- 新增 `StatusPill` 的純對照測試（`expiryState` 值 → 文案/狀態 key），其餘視覺靠 `next build` + 真機 QA。
- 完成後部署，於手機實測四個畫面（含 iOS 安全區、固定底部按鈕、縮圖點擊放大）。

## 部署

- 合併 main → `service redeploy web` → 等 RUNNING → 手機開 `https://food-expiration-tracker.zeabur.app` 真機看四頁。
- 無新環境變數、無 schema 變更。
