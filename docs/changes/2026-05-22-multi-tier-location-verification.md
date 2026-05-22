# 多元定位驗證系統 — 2026-05-22

> **範圍**：全站定位驗證機制
> **狀態**：實作中
> **部署 commit 範圍**：（待補）
> **相關 ADR**：[0021-multi-tier-location-verification.md](../decisions/0021-multi-tier-location-verification.md)

---

## 背景

### 使用者反饋（2026-05-22）

> 「GPS 定位有些時候還是有問題，定位運用請再做其他方式的元件，讓遊戲設計可以更順暢。
> 有遇到學校使用的設備定位被關閉，造成遊戲非常不順暢。
> 請針對定位的部分是否有其他方式更方便：出發設定一個點，其他點用相對應的設定來做定位？
> 除了 GPS 以外還有什麼其他訂方式？現場的手機訊號有，但是較薄弱，也有 WIFI 訊號。」

### 現況問題

1. **GPS 在學校場域常被關閉** — 校方統一禁用、玩家無法開啟
2. **室內 / 高樓 / 樹林 GPS 訊號弱** — 即使開啟也飄移嚴重
3. **玩家不會主動排查** — 不知道為何任務無法簽到
4. **目前只有 GPS 一條腿** — `qrFallback` 是備援不是主機制

### 已有基礎（不可丟）

- GPS 高精度模式 + Kalman 濾波（`useStableGeolocation`）
- Haversine 距離計算（前後端共用 `server/lib/geo.ts`）
- QR Code 簽到的基本能力（`qrCodeService.ts`）
- PDR 行人路徑推算（IMU 陀螺儀，目前作為 GPS 失效備援）
- 多人 GPS 融合（v2.0 已上線）

---

## 影響範圍

### 修改的檔案 / 模組

| 範圍 | 檔案 |
|------|------|
| Schema | `shared/schema/locations.ts`（新增欄位）|
| Migration | `migrations/00XX_location_verification.sql` |
| 後端 — 簽到 | `server/routes/location-tracking.ts` |
| 後端 — 個別點 QR | `server/qrCodeService.ts`（擴充）|
| 後端 — 列印 API | `server/routes/admin-locations-print.ts`（新增）|
| 後端 — 救援 | `server/routes/admin-rescue.ts`（新增）|
| 前端 — 玩家驗證元件 | `client/src/components/location/LocationVerifier.tsx`（新增）|
| 前端 — QR 掃描 | `client/src/components/location/QrCodeScanner.tsx`（新增）|
| 前端 — 代碼輸入 | `client/src/components/location/CodeVerifier.tsx`（新增）|
| 前端 — PDR Hook | `client/src/hooks/usePDRNavigation.ts`（新增）|
| 前端 — AR 驗證 | `client/src/components/location/ARVerifier.tsx`（新增）|
| 前端 — Admin editor | `client/src/components/admin/LocationVerificationConfig.tsx`（新增）|
| 前端 — Admin 救援 | `client/src/pages/admin/StuckPlayersPanel.tsx`（新增）|
| 文件 | `docs/domains/gps-system.md`（更新）+ `docs/decisions/0021-*.md`（新 ADR）|

### DB Schema 變動（只新增、不刪除）

```sql
ALTER TABLE locations ADD COLUMN verification_mode VARCHAR(20) DEFAULT 'gps';
-- 值：'gps' | 'qr' | 'code' | 'hybrid' | 'any'
-- 'gps' = 只能 GPS（向後相容預設）
-- 'qr' = 只能掃 QR
-- 'code' = 只能輸入代碼
-- 'hybrid' = GPS + QR / 代碼擇一
-- 'any' = 三種都可（最寬鬆）

ALTER TABLE locations ADD COLUMN verification_code VARCHAR(10);
-- 4-6 位代碼（admin 自訂或自動生成）

ALTER TABLE locations ADD COLUMN qr_token VARCHAR(64);
-- QR 內嵌的 token（驗證來源、防偽造）

ALTER TABLE locations ADD COLUMN allow_admin_rescue BOOLEAN DEFAULT true;

ALTER TABLE location_visits ADD COLUMN verify_method VARCHAR(20) DEFAULT 'gps';
-- 'gps' | 'qr' | 'code' | 'pdr' | 'ar' | 'admin'

ALTER TABLE location_visits ADD COLUMN verify_metadata JSONB;
-- 儲存對應驗證方式的詳細資料（QR token、代碼輸入時間、AR 比對分數等）
```

### API 異動

| 端點 | 變動 |
|------|------|
| `POST /api/sessions/:sid/locations/:lid/visit` | 新增 body 參數 `verifyMethod`（gps/qr/code/pdr/ar）+ `verifyPayload`|
| `POST /api/admin/locations/:lid/generate-code` | （新增）為單點生成短碼 |
| `GET /api/admin/games/:gid/locations/print-pdf` | （新增）下載場域 QR + 代碼 PDF |
| `POST /api/admin/sessions/:sid/rescue/:playerId/visit/:lid` | （新增）救援按鈕 |
| `GET /api/admin/sessions/:sid/stuck-players` | （新增）卡住玩家清單 |

---

## 解決方案

### 五層備援架構

```
GPS (預設) → QR Code → 數字代碼 → PDR (出發點相對) → 管理員救援
```

#### 第 1 層 — GPS（保留現有）
- 精度 < 30m 直接通過
- `verificationMode = 'gps'`（向後相容預設）

#### 第 2 層 — QR Code（主推備援）
- Admin 可選 `verificationMode = 'qr'` / `'hybrid'` / `'any'`
- 每個 location 自動產生 `qr_token`（含 locationId + HMAC 簽章）
- QR 內容：`{baseUrl}/v/{token}` 或在 session 內掃碼回傳給 server 驗
- 玩家進入 QR 掃描頁 → 比對 token → 通過則寫 visit

#### 第 3 層 — 數字代碼（最低門檻）
- 每個 location 4-6 位代碼（admin 自訂或一鍵亂數）
- 印在 QR 旁邊 / 或場域立牌
- 玩家輸入代碼 → server 比對 → 通過則寫 visit

#### 第 4 層 — PDR 相對定位
- 出發點需要 GPS 取得一次基準（或 admin 預設座標）
- 後續用 `DeviceMotionEvent` + `DeviceOrientationEvent` 估算位移
- **只作導引提示**，不作簽到驗證（誤差累積）
- 經過 QR 點時自動校正原點

#### 第 5 層 — Admin 救援
- Admin 控制台顯示「卡住玩家」清單（5 分鐘內無進度 + 簽到失敗 ≥ 2 次）
- 一鍵「強制標記到達」+ 寫 audit log + `verify_method = 'admin'`

### Phase 3 — AR 影像辨識（可選）
- `@mediapipe/tasks-vision` 已在依賴中
- Admin 上傳每個點的參考照片 → server 算 feature hash
- 玩家拍照 → 前端比對特徵點 → 通過上傳給 server

---

## 實作步驟（commit 對照）

### Phase 1：QR / 代碼主機制
1. Schema 擴充（commit pending）
2. Migration script
3. 後端簽到分流邏輯
4. `qrCodeService.ts` 擴充 — 單點 QR 生成
5. Admin API — generate-code、print-pdf
6. Admin editor UI — 驗證方式選單
7. 玩家端 `LocationVerifier`、`QrCodeScanner`、`CodeVerifier` 元件
8. 整合 `GpsMissionPage` / 其他簽到頁

### Phase 2：PDR 相對定位
9. `usePDRNavigation` Hook
10. 起點校準 UI
11. 漂移校正（經過 QR 點時 reset）

### Phase 3：AR 影像（可選）
12. MediaPipe scene matching
13. Admin 參考照片上傳
14. 玩家拍照驗證流程

### Phase 4：Admin 救援
15. `/api/admin/sessions/:sid/stuck-players` 端點
16. `/api/admin/.../rescue/:playerId/visit/:lid` 端點
17. Admin UI 卡住玩家面板

### Phase 5：文件
18. ADR-0021 寫定決策原因
19. 更新 `docs/domains/gps-system.md`
20. CHANGELOG

---

## 驗證

### 開發階段
- [ ] Vitest 單元測試（後端驗證分流、QR token 簽章）
- [ ] Playwright e2e：
  - admin 建立 location 設 verificationMode = 'qr'
  - 玩家進入頁面 → 掃 QR → visit 紀錄寫入
  - 玩家輸入代碼 → 通過
  - GPS 模式 + QR 模式 + 代碼模式可切換

### 真機測試
- [ ] 學校場域 — GPS 關閉時可用 QR / 代碼完成
- [ ] 室內 — PDR 指引方向正確（< 50m 距離內）
- [ ] iOS Safari + Android Chrome 都可掃 QR

---

## 已知限制 / 後續優化

- ⚠️ **WiFi SSID 指紋不可行** — iOS/Android 瀏覽器禁讀 WiFi 列表（隱私限制），未來做原生 APP 才可考慮
- ⚠️ **iBeacon 在 web 不可行** — Web Bluetooth API 不支援被動掃描
- ⚠️ **NFC 在 iOS Safari 不支援** — 暫不支援
- ⚠️ **PDR 誤差** — 連續走 200m+ 會明顯漂移，需 QR 校正
- 📅 **未來**：原生 APP 包裝後可加入 iBeacon / NFC / WiFi 三種

---

## 相關文件

- ADR：[0021-multi-tier-location-verification.md](../decisions/0021-multi-tier-location-verification.md)
- Domain：[gps-system.md](../domains/gps-system.md)
- Runbook：[../runbooks/print-location-qr.md](../runbooks/print-location-qr.md)（新增）
