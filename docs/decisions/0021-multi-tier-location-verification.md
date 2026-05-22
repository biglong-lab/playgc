# ADR-0021: 多元定位驗證系統

> 日期：2026-05-22
> 狀態：採用中
> 影響：定位驗證流程、Schema（locations / location_visits）、admin 編輯流程、玩家簽到 UX

## 背景

現有遊戲機制高度依賴 GPS 定位（Haversine 距離 ≤ radius）來判斷玩家是否到達任務點。實務上多次遇到：

1. **學校場域**：校方統一禁用設備定位、玩家無法簽到
2. **室內 / 高樓 / 樹林**：GPS 飄移嚴重、即使開啟也無法通過半徑檢查
3. **訊號弱**：手機 4G 訊號薄弱、A-GPS 輔助受限
4. **玩家不會處理**：不知道為何任務無法簽到、客服成本增加

`qrFallback` 雖已存在但僅作備援、未被當作主驗證機制；單一驗證方式造成遊戲體驗極度依賴外在環境。

## 選項

| 方案 | 優點 | 缺點 |
|------|------|------|
| A. 強迫使用者開 GPS | 邏輯最簡單 | 學校 / 企業場域根本不允許、體驗最差 |
| B. 純 QR Code 取代 GPS | 100% 可控 | 失去地理性、玩家可在家掃 QR 作弊（需 session 綁定）|
| C. WiFi SSID 指紋定位 | 室內精準 | iOS / Android 瀏覽器禁讀 WiFi 列表，**Web 端不可行** |
| D. iBeacon 藍牙 | 1-5m 精度 | Web Bluetooth 不支援被動掃描、需原生 APP |
| E. **多層備援架構**（採用）| 任一方式可用即可、體驗最順 | 實作較複雜、admin 需多設定 |

## 決定

採用 **E. 多層備援架構**，五層由 GPS 到管理員手動：

```
GPS → QR Code → 數字代碼 → PDR 相對定位 → 管理員救援
```

理由：
1. **降低部署門檻**：admin 只需貼 QR 或寫代碼，不需特殊硬體
2. **體驗最順**：任一方式可用即可完成簽到、不卡學校場域
3. **保留 GPS 優勢**：戶外場域仍以 GPS 為主、自動切換最佳方式
4. **可審計**：每次 visit 紀錄使用哪種方式，便於事後分析
5. **完整覆蓋**：管理員救援作為終極兜底，玩家不會永遠卡關

## 影響

### 程式碼對應

| 模組 | 檔案 |
|------|------|
| Schema | `shared/schema/locations.ts`（新增 5 欄位）|
| Migration | `migrations/manual/2026-05-22-location-verification.sql` |
| 後端驗證核心 | `server/lib/location-verification.ts`（新增）|
| 後端 visit 分流 | `server/routes/location-tracking.ts`（修改）|
| 後端 admin API | `server/routes/locations.ts`（新增 5 個端點）|
| 後端救援 | `server/routes/admin-rescue.ts`（新增）|
| 玩家驗證 UI | `client/src/components/location/LocationVerifier.tsx` |
| QR 掃描 | `client/src/components/location/LocationQRScanner.tsx` |
| AR 拍照 | `client/src/components/location/ARVerifier.tsx` |
| PDR Hook | `client/src/hooks/usePDRNavigation.ts` |
| Admin 設定 | `client/src/components/admin/LocationVerificationConfig.tsx` |
| Admin 列印 | `client/src/pages/admin/LocationPrintSheet.tsx` |
| Admin 救援 | `client/src/pages/admin/StuckPlayersPanel.tsx` |

### Schema 變動（紅線：只新增、不刪除）

`locations` 表新增：
- `verification_mode` VARCHAR(20) DEFAULT 'gps'
- `verification_code` VARCHAR(10)
- `qr_token` VARCHAR(64)
- `allow_admin_rescue` BOOLEAN DEFAULT true
- `reference_image_hash` VARCHAR(16)
- `reference_image_url` TEXT

`location_visits` 表新增：
- `verify_method` VARCHAR(20) DEFAULT 'gps'
- `verify_metadata` JSONB

### 紅線

1. **既有 GPS 流程必須完全相容**：未提供 `verifyMethod` 時 fallback 為 'gps'，使用原邏輯
2. **QR token 必須含 HMAC 簽章**：防偽造，玩家無法自行生成有效 QR
3. **PDR 不可作為簽到驗證**：誤差累積會被作弊，僅作導引提示與配合 QR 校正
4. **Admin 救援必寫 audit log**：含 admin id、reason、timestamp
5. **referenceImageHash 只能由後端計算**：玩家不能傳 hash，必須傳照片由後端 dHash

### 已知限制

| 限制 | 原因 | 緩解 |
|------|------|------|
| WiFi SSID 不可用 | iOS/Android 瀏覽器禁讀 | 改用 QR / 代碼 / PDR |
| iBeacon 不可用 | Web Bluetooth API 限制 | 同上 |
| iOS NFC 不可用 | Safari 不支援 web NFC | 同上 |
| PDR 累積誤差 | IMU 偏移 + 步長個體差異 | 限 200 步、QR 點校正 |
| AR 比對受光線影響 | dHash 對極端光線敏感 | matchScore 門檻可調（預設 0.7）|

## 後續可能變動

- **未來原生 APP**：可加入 iBeacon / NFC / WiFi RTT 三種定位
- **AR 升級**：dHash → MediaPipe Object Detection / Feature Matching
- **PDR 強化**：加入機器學習步長估計（Google PDR 經驗 < 3% 誤差）
- **動態 verification_mode 切換**：偵測連續失敗自動降級

## 相關文件

- 變動紀錄：[../changes/2026-05-22-multi-tier-location-verification.md](../changes/2026-05-22-multi-tier-location-verification.md)
- GPS 系統設計：[../domains/gps-system.md](../domains/gps-system.md)
- 列印操作：[../runbooks/print-location-qr.md](../runbooks/print-location-qr.md)
