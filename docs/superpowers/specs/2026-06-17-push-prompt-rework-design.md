# 設計：推播提示改版（登入跳出 + 我的頁開關 + 移除頂部常駐）

**日期**：2026-06-17
**狀態**：已通過設計討論，待寫實作計畫

## 背景與目標

目前「開啟手機推播」是首頁頂部一條常駐藍色連結（`<EnablePush>`），佔位置。改成：

1. **登入後主動跳出提示**：使用者進首頁時若尚未開啟推播且未關閉過提示，跳出一個置中小卡提示，可一鍵開啟或「以後再說」。
2. **「我的」頁可開關**：`/me` 新增一塊推播通知狀態 + 開啟控制，隨時可開。
3. **移除首頁頂部常駐**那條，不再佔版面。

**提示頻率**（使用者確認）：未開啟才跳、按過「以後再說」或開啟成功後不再每次登入彈（記在本裝置 localStorage）；隨時可從「我的」開啟。

非目標（YAGNI）：關閉推播（取消訂閱）、iOS PWA 安裝引導頁、後端改動。沿用既有 `/api/push/subscribe` + `public/sw.js` + VAPID。

## 架構決策

- **抽出共用 hook** `usePushSubscription(vapidPublicKey)`：把目前散在 `EnablePush` 的訂閱邏輯（SW 註冊、權限請求、`pushManager.subscribe`、POST `/api/push/subscribe`、反映既有訂閱）集中，給「提示」與「我的」共用。`EnablePush` 元件移除。
- 提示與控制都是 client 元件；VAPID public key 由 server component（首頁、`/me` 頁）以 prop 傳入（沿用現狀，不需 `NEXT_PUBLIC_`）。

## 模組與介面

- `src/lib/push/usePushSubscription.ts`（new，client hook）
  - 回傳 `{ supported, subscribed, busy, error, enable }`。
    - `supported`：`'serviceWorker' in navigator && 'PushManager' in window && !!vapidPublicKey`。
    - `subscribed`：mount 時查既有訂閱反映。
    - `enable()`：註冊 `/sw.js` → `Notification.requestPermission()` → `subscribe`（用 `urlBase64ToUint8Array(vapidPublicKey)`）→ POST `/api/push/subscribe` → 設 `subscribed=true`；失敗設 `error`。
  - `urlBase64ToUint8Array` 移到此檔（純函式，可測）。
- `src/components/PushPrompt.tsx`（new，client）：props `{ vapidPublicKey }`。
  - mount 時：若 `supported && !subscribed && localStorage['push-prompt-dismissed'] !== '1'` → 顯示置中 modal 小卡（半透明背景 + 白卡，手機友善）。標題「開啟手機推播？」+ 一句說明（食物快過期時主動提醒）。
  - 按鈕：「開啟通知」（呼叫 `enable()`，成功則關閉 modal）、「以後再說」（設 `localStorage['push-prompt-dismissed']='1'` 並關閉）。
  - 失敗顯示 `error`；不阻擋關閉。未 `supported` 或已 `subscribed` → 不顯示（render null）。
- `src/components/PushControl.tsx`（new，client）：props `{ vapidPublicKey }`。
  - 一塊卡片：標題「🔔 手機推播通知」+ 狀態列。已開啟顯示「已開啟」綠勾；未開啟顯示「開啟」按鈕（綠底）。不支援顯示淡灰提示「此裝置/瀏覽器不支援」。失敗顯示 error。
- `src/app/page.tsx`（首頁）：移除 `<EnablePush .../>`；改放 `<PushPrompt vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />`（預設不顯示、不佔版面）。
- `src/app/me/page.tsx` + `src/components/MyProfile.tsx`：`/me` 頁把 `process.env.VAPID_PUBLIC_KEY` 傳給 `MyProfile`，在頭像卡片下方加 `<PushControl vapidPublicKey={...} />`（或頁面直接放 PushControl）。
- 刪除 `src/components/EnablePush.tsx`（被取代）。

## 資料流

- 開啟：`enable()` → SW + 權限 + subscribe → POST `/api/push/subscribe`（沿用，寫 `PushSubscription` 綁登入者）。
- 狀態：hook mount 查 `reg.pushManager.getSubscription()` 反映 `subscribed`。
- 提示出現條件：首頁 mount + supported + 未訂閱 + 未 dismissed。

## 錯誤處理 / 邊界

- VAPID 未設（`vapidPublicKey` 空）→ `supported=false` → 提示不跳、控制顯示不支援，不報錯擾民。
- 權限被拒 / 瀏覽器不支援 → `error` 文字（「未授權通知」「此瀏覽器不支援推播」「開啟推播失敗」），不崩。
- iOS 需先「加到主畫面」才可推播：`enable()` 失敗時的既有錯誤訊息涵蓋（不另做引導頁）。
- localStorage 不可用（隱私模式）→ try/catch 包，視為未 dismissed（最多每次登入彈，可接受）。
- 提示為單一裝置狀態（localStorage），換裝置會再問，合理。

## 測試（vitest，維持 68 綠）

- `usePushSubscription` 內的 `urlBase64ToUint8Array` 抽為可匯出純函式，補單元測試（已知 base64 → 正確 byte 長度/值）。
- hook/元件其餘依賴瀏覽器 API（serviceWorker/Notification/PushManager），不單元測試，靠 build + 真機 QA。

## 部署

1. 合併 main（無 schema 變更）。
2. `service redeploy web` → 等 RUNNING。
3. 真機 QA：登入後跳出推播提示、按「開啟通知」可授權並訂閱、按「以後再說」收起且重整不再彈;`/me` 有推播開關且狀態正確;首頁頂部不再有常駐推播連結。
