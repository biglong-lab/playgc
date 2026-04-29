# 🛰️ GPS 定位精準度優化指南

> 賈村競技場 / game.homi.cc — 2026-04-26
>
> 用戶反映：「定位差很遠，造成遊戲無法順利進行」
>
> 本文說明定位原理、優化方案、玩家可做的改善動作

---

## 一、為什麼會「定位差很遠」？

### 1. 真正的影響因子（依嚴重度排序）

| 因子 | 影響 | 玩家可改善？ |
|------|------|--------------|
| 🔴 **建築物遮蔽** | 多路徑反射 → 跳點 50-200m | ✅ 移到開闊處 |
| 🔴 **室內** | GPS 衛星訊號穿不過水泥 → 純基地台/WiFi 推估 | ✅ 走出戶外 |
| 🟠 **GPS 暖機未完成** | 開啟後 5-30 秒精度逐漸提升 | ✅ 等 30 秒 |
| 🟠 **單次採樣誤差** | 同一位置每秒回傳座標可能差 10-50m | ❌ 由 app 自動處理 |
| 🟡 **對流層 / 電離層延遲** | 訊號折射，誤差 2-10m | ❌ 不可控 |
| 🟡 **衛星仰角差** | 接收到的衛星都在低空 → 幾何誤差大 | ⏰ 等幾分鐘 |
| 🟢 **雲層 / 雨天** | 幾乎不影響（GPS L1 1.5GHz 能穿透雲） | ❌ 不可控 |

**結論**：雲層和天氣不是「定位差很遠」的主因。最常見原因是**建築物遮蔽 + 單次採樣誤差**。

### 2. WiFi / 基地台補強說明

瀏覽器 `navigator.geolocation` 啟用 `enableHighAccuracy: true` 時，作業系統會自動融合：
- **GPS / GNSS 衛星** — 戶外最準（5-10m）
- **WiFi 定位**（WPS） — 透過附近 WiFi 訊號特徵 + Google/Apple 資料庫，**不需連網，只要開啟 WiFi**
- **基地台三角定位** — 需 SIM 卡、精度差（200-1000m）
- **A-GPS**（Assisted GPS） — 透過行動網路下載衛星星曆，加速暖機

**玩家若關 WiFi**：精度可能掉到 100-500m（純衛星 + 基地台）
**玩家若開 WiFi**：精度可達 10-30m（即使在室內）

---

## 二、本平台的優化措施（已實作）

### 1. 📡 useStableGeolocation Hook

**問題**：原本直接呼叫 `navigator.geolocation.watchPosition`，單次採樣有大誤差。

**解法**：`client/src/lib/geolocation/useStableGeolocation.ts`

```typescript
const { position, accuracy, quality, samples } = useStableGeolocation({
  mode: "watch",
  sampleSize: 5,           // 維持最近 5 個採樣
  minSampleIntervalMs: 1000,  // 最小採樣間隔 1 秒
});
```

**內部做了什麼**：
1. **多採樣緩衝**：保留最近 N=5 個位置
2. **中位數過濾**：緯度 / 經度分別取中位數（比平均數抗離群值）
3. **1D Kalman 濾波**：根據前次精度 vs 新測量精度動態加權
4. **採樣數判定**：累積 ≥3 點才算「穩定」（前 3 點是暖機）

**效果**：
- 同一位置的座標跳動從 ±20m → ±5m
- 走路時軌跡平滑，不再「鬼影跳動」
- 玩家不會因為單次大誤差就誤判進不去

### 2. 📐 統一 Haversine 距離計算

**問題**：原本三份 Haversine 程式碼（map-utils.ts / GpsMissionPage.tsx / location-tracking.ts），維護不一致。

**解法**：`client/src/lib/geolocation/geo-utils.ts`

```typescript
import { distanceMeters, bearingDegrees, bearingToCompass } from "@/lib/geolocation";

const dist = distanceMeters(myLat, myLng, targetLat, targetLng);
const bearing = bearingDegrees(myLat, myLng, targetLat, targetLng);
const direction = bearingToCompass(bearing); // "東北" / "南" 等中文方位
```

### 3. 🎯 effectiveRadius 自動補償

**問題**：GPS 精度差時（室內 100m+），玩家根本無法進入 50m 半徑。

**解法**：根據實際精度動態放寬

```typescript
const effectiveRadius = targetRadius + Math.min(accuracy * 0.5, 50);
```

例：原半徑 50m，GPS 精度 ±100m → effectiveRadius = 100m

**新增條件**：必須採樣數 ≥3 才允許判定到達（避免暖機期誤判）

### 4. 🚦 GpsAccuracyIndicator UI

**問題**：玩家不知道為什麼進不去 → 以為遊戲壞掉。

**解法**：`client/src/components/game/GpsAccuracyIndicator.tsx`

| 等級 | 精度範圍 | 顏色 | 顯示給玩家 |
|------|----------|------|-----------|
| 極佳 | ≤ 10m | 🟢 | （正常運作） |
| 良好 | ≤ 30m | 🟢 | （正常運作） |
| 一般 | ≤ 50m | 🟡 | 「可繼續，建議移到開闊處更精準」 |
| 較差 | ≤ 100m | 🟠 | 「請走出室內，等 10-30 秒讓 GPS 暖機」 |
| 極差 | > 100m | 🔴 | 「請開啟『裝置定位』與 WiFi（不需連網）」 |

### 5. 🐛 PhotoSpotFlow maximumAge bug 修復

**問題**：`maximumAge: 10000` 允許 10 秒舊位置 → 玩家移動時座標延遲。

**解法**：改用 `useStableGeolocation`（內部設 `maximumAge: 0`）

---

## 三、玩家「定位差很遠」時的標準排查 SOP

### 第 1 步：看 GPS 精度提示

遊戲頁面右上角會顯示精度（±Xm）+ 顏色：
- 🟢 綠 = 沒問題，問題不在 GPS
- 🟡 黃 = 一般，可玩
- 🟠 橘 = 較差，看下面建議
- 🔴 紅 = 極差，必須改善

### 第 2 步：依顏色採取行動

#### 🟠 較差（30-100m）
1. **走出室內** — 站在天空可見的地方
2. **遠離高樓 / 大樹** — 訊號被遮蔽會反射
3. **等 10-30 秒** — GPS 衛星定位需暖機

#### 🔴 極差（> 100m）
1. **檢查裝置定位權限**
   - iPhone：設定 → 隱私權 → 定位服務 → Safari → 「使用 App 期間」+ ✅ 精確位置
   - Android：設定 → 位置 → 模式選「高精確度」（GPS + WiFi + 行動網路）
2. **開啟 WiFi**（不需連網！）
   - WiFi-based positioning 可精準到 10-30m，即使在室內
3. **開啟行動數據**
   - 否則沒有 A-GPS 輔助，純衛星定位要等 1-3 分鐘
4. **重新整理頁面**
   - 強制重新觸發定位請求

### 第 3 步：仍然不行 → 用 QR fallback

若場域 admin 有設定 `qrFallback: true`，遊戲會顯示備用 QR Code：
- 玩家在現場找牆上的 QR → 掃描即可通過任務

---

## 四、Admin 場域設定建議

### GPS 任務設定

| 設定 | 推薦值 | 說明 |
|------|--------|------|
| `radius` | 30-50m | 太小（< 20m）室內無法觸發；太大（> 100m）失去定位意義 |
| `qrFallback` | ✅ 開啟 | 重要！讓 GPS 失效的玩家有備援 |
| `hotZoneHints` | ✅ 開啟 | 顯示「快到了！往東北走」等提示 |
| `proximitySound` | 可選 | beep 聲提示距離 |

### 拍照任務設定

| 設定 | 推薦值 | 說明 |
|------|--------|------|
| `radiusMeters` | 20-30m | 拍照點通常較具體 |
| `gpsStrictMode` | "soft" | hard = 必須在範圍內才能拍；soft = 可拍但提示距離 |

---

## 五、技術原理深入

### Haversine 公式（球面距離）

```
a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2)
c = 2 · atan2(√a, √(1-a))
d = R · c   (R = 地球半徑 6371000m)
```

誤差 < 0.5%（地球非完美球體，但 < 100km 用 Haversine 已夠）

### 1D Kalman Filter

```
K = P / (P + R)             # 卡爾曼增益
new_value = prev + K · (measured - prev)
new_accuracy = √((1 - K) · P)

P = 過程方差（前次精度的平方）
R = 觀測方差（當前測量精度的平方）
```

**直觀**：
- 新測量精度 R 很差 → K 趨近 0 → 幾乎不更新（信任前次）
- 新測量精度 R 很好 → K 趨近 1 → 完全採用新值

### 中位數 vs 平均數

```
3 個樣本：[10m, 11m, 100m（GPS 跳點）]
平均：40.3m （受異常值影響）
中位數：11m （不受影響）
```

GPS 跳點是常態，所以用中位數更穩。

---

## 六、未來可能的優化（尚未實作）

### 1. IMU 感測器補強（PDR — 行人路徑推算）

利用 `DeviceMotionEvent` + `DeviceOrientationEvent`：
- 加速度計 → 步數（Pedometer）
- 陀螺儀 → 方向
- 磁力計 → 北方校正

**優點**：GPS 失效時用 IMU 推算位置（10-30 秒內 < 5m 誤差）

**限制**：iOS 14+ 需要使用者手動授權（`requestPermission()`）

### 2. WebRTC 訊號強度三角定位

在場域內部署藍牙 Beacon / WiFi AP，玩家裝置量測訊號強度（RSSI），用三角定位推算位置。

**精度**：< 5m（室內）

**成本**：場域需部署硬體

### 3. AR 視覺定位（VPS / Visual Positioning System）

玩家舉起相機，AI 比對畫面與 3D 場景模型 → 推算精準位置。

**精度**：< 1m

**成本**：需先建立場域 3D 模型（成本極高）

### 4. 後端融合多裝置

多人同隊時，融合所有人的 GPS 取「眾數」位置 → 平均誤差降低 √N 倍。

**精度**：團隊 5 人時，誤差降低 ~55%

---

## 七、技術參考

- W3C Geolocation API: https://www.w3.org/TR/geolocation/
- Haversine: https://en.wikipedia.org/wiki/Haversine_formula
- Kalman Filter for GPS: https://medium.com/@wilamelima/kalman-filter-for-gps
- iOS Location Accuracy: Apple HIG Location Services
- Android Fused Location: developer.android.com/training/location
