# 設計：多存放點 + 位置照片

**日期**：2026-06-16
**狀態**：已通過設計討論，待寫實作計畫

## 背景與目標

食物的存放點不限於冰箱（還有冷凍、櫥櫃、儲藏室…）。需求：

1. **管理員可新增/編輯/刪除存放點**。
2. **每個存放點可拍照記錄位置**（拍下它在家裡哪，當參考圖）；照片**可選、之後能補/換**。
3. **新增食物時必選存放點**，預設選第一個。
4. **首頁頂部存放點篩選 chip**（全部 / 各存放點），點選只看該點的食物。

`Location` 表與 `FoodItem.locationId` 已存在於 schema 但未使用——本功能啟用它們並加上位置照片。

非目標（YAGNI）：存放點排序拖曳、巢狀位置、每點獨立提醒設定、location 層級權限（沿用：管理員管、全家共用單一 household）。

## 架構決策

- **位置照片重用既有照片管線**：上傳走 `POST /api/photos`（回 `photoId`），檢視走既有的已登入路由 `GET /api/photo/[id]`。不新增照片基礎建設。
- **存放點清單給一般使用者讀**（首頁 chip + 新增頁 picker 都要），故 `GET /api/locations` 只需登入；**寫入（增/改/刪）限管理員**。
- **首頁篩選在 client 端**：`GET /api/food` 回每筆的 `locationId`，首頁抓存放點清單後依選取 chip 過濾，免加 server 查詢參數。

## 資料模型（Prisma）

```prisma
model Location {
  id          String     @id @default(cuid())
  household   Household  @relation(fields: [householdId], references: [id])
  householdId String
  name        String
  photo       Photo?     @relation(fields: [photoId], references: [id])
  photoId     String?
  foodItems   FoodItem[]
}

model Photo {
  // ...existing fields...
  foodItems  FoodItem[]
  locations  Location[]   // 新增反向關聯
}
```
- `FoodItem.locationId` 維持現狀（optional）。
- 需對 prod DB `prisma db push`。

## 模組與介面

- `src/lib/locations.ts`（new，純邏輯 + 測試）
  - `ensureDefaultLocation(db, householdId)`：若該 household 無任何 location，建一個「冰箱」並回傳；否則回傳既有清單第一個。供 `GET /api/locations` 與遷移用。
  - `defaultLocationId(locations)`：回傳清單第一個的 id（給「預設選第一個」用），空清單回 null。
  - `canDeleteLocation(location, activeItemCount)`：`activeItemCount === 0`。純判斷，易測。
- `GET /api/locations`（`src/app/api/locations/route.ts`，new）：登入即可。`ensureDefaultLocation` 後回 `[{ id, name, photoUrl, itemCount }]`（`photoUrl = photoId ? '/api/photo/'+photoId : null`；`itemCount` = 該點 active 食物數）。
- `POST /api/admin/locations`（`src/app/api/admin/locations/route.ts`，new）：管理員；body `{ name, photoId? }`；名字 trim 非空、同 household 不可重名（409）。
- `PATCH /api/admin/locations/[id]`（`.../[id]/route.ts`，new）：管理員；改 `name` 與/或 `photoId`（傳 null 可清除照片）。重名檢查（排除自己）。
- `DELETE /api/admin/locations/[id]`：管理員；先數該點 active 食物，`canDeleteLocation` 為否 → 409「此存放點還有食物，請先清空或移動」；否則刪。
- `POST /api/food`：在現有 item 映射補 `locationId`（目前漏接）。驗證：`locationId` 必填且屬於本 household（否則 400）。
- `GET /api/food`：`findMany` 加 `include: { location: true }`；DTO 每筆加 `locationId: it.locationId` 與 `locationName: it.location?.name ?? null`。
- **UI**
  - `src/components/LocationChips.tsx`（new，client）：吃 `locations` + 選取狀態，渲染「全部 + 各點」chip，純呈現 + onChange。
  - `FoodList.tsx`：抓 `/api/locations`、頂部放 `LocationChips`、依選取過濾 items；卡片小字加「· {locationName}」。
  - `AddFoodForm.tsx`：抓 `/api/locations`、加存放點選擇器（chip 或 select，預設 `defaultLocationId`、必選），送出帶 `locationId`。
  - `src/app/admin/locations/page.tsx` + `src/components/AdminLocations.tsx`（new）：列存放點（名稱 + 位置縮圖點開放大）、新增表單（名字 + 可選「📷 拍位置照」重用上傳）、每列編輯（改名/換照）/刪除（擋下非空）。沿用溫暖卡片風 + `inputCls`。
  - `/admin` 使用者管理頁加一個「📍 管理存放點」連結到 `/admin/locations`。

## 資料流

- 首頁：`GET /api/locations`（含自動建預設「冰箱」）→ 渲染 chips；`GET /api/food`（含 locationId）→ 依選取 chip client 過濾。
- 新增：載入 locations → 預設選第一個 → 送出 `POST /api/food` 帶 `locationId`。
- 管理存放點：`/admin/locations` → 上傳照片(`/api/photos`)拿 photoId → `POST/PATCH /api/admin/locations`。

## 錯誤處理 / 邊界

- 無存放點時 `GET /api/locations` 自動建「冰箱」→ 首頁/新增永遠至少一個可選。
- 新增食物 `locationId` 不屬本 household → 400。
- 刪除非空存放點 → 409 友善訊息，不刪。
- 重名 → 409。
- 位置照片載入失敗 → `onError` 隱藏，不破版。
- 長存放點名 → chip 與小字 `truncate` 不爆框。
- 遷移：既有 `locationId` 為 null 的 active 食物 → 回填到預設「冰箱」（部署一次性腳本）。

## 測試（vitest，維持現有 59 綠）

- `locations.ts`：`defaultLocationId`（空/非空）、`canDeleteLocation`（0 / >0）、`ensureDefaultLocation`（無→建、有→不建，用 fake db）。
- 其餘 route/UI 靠 tsc + build + 部署 smoke + 真機 QA。

## 部署

1. 合併 main → 對 prod DB `prisma db push`（Location.photoId + Photo.locations）。
2. 一次性遷移：active 食物 `locationId` 為 null → 設為預設「冰箱」的 id（先 `ensureDefaultLocation`）。
3. `service redeploy web` → 等 RUNNING。
4. Smoke + 真機 QA：建存放點(含拍照)、新增食物選存放點、首頁 chip 過濾、刪除非空被擋。
