# 拍照元件盤點報告 — 2026-05-07

> 範圍：8 個拍照相關元件 + 共用 usePhotoCamera hook
> 觸發：使用者反饋紀念照載入失敗 + 拍照基本功能缺失

---

## 1️⃣ 紀念照載入失敗 bug — ✅ 已修

### 根因
PhotoCompareFlow 「比對通過」後合成 cloudinary URL（`c_fill,w_1...`）載入失敗、PhotoSuccessView 直接顯示「紀念照載入失敗」全死掉、user 無法繼續。

### 三個可能原因
1. **Cloudinary CDN 同步延遲**（剛 transform、~5 秒未 propagate）
2. **URL 過長**（>1500 字元 Cloudinary 拒絕、伺服器只 warn 不擋）
3. **Transformation 失敗**（特定 transformation 參數錯）

### 已修
- `PhotoSuccessView`：新增 `fallbackImageUrl` prop，圖片 onError 自動切到原圖
- `PhotoSuccessView`：5 秒後自動 retry 一次（解決 CDN 同步延遲）
- `PhotoCompareFlow`：傳 `originalUrl` 作 fallback

### 部署後行為
```
合成 URL 失敗 → 自動切原圖 → user 看到玩家拍的照片（不再死掉）
首次失敗 → 5 秒後自動重試（CDN 通常此時已同步）
重試仍失敗 → 顯示「紀念照載入失敗」+ 手動重試按鈕
```

---

## 2️⃣ 8 個拍照元件功能對照

| 元件 | pageType | 用途 | 上傳相簿？ | 切前後鏡頭？ | 閃光燈？ |
|------|----------|------|-----------|-------------|---------|
| PhotoMissionPage | `photo_mission` | 一般拍照 | ❌ | ❌ | ❌ |
| PhotoSpotFlow | `photo_spot` | 指定地點拍照 | ✅ file input | ❌ | ❌ |
| **PhotoCompareFlow** | `photo_compare` | 拍照比對（user 截圖出問題）| ❌ | ❌ | ❌ |
| PhotoBeforeAfterFlow | `photo_before_after` | 前後對比 | ✅ file input | ❌ | ❌ |
| PhotoBurstFlow | `photo_burst` | 連拍 | ❌ | ❌ | ❌ |
| PhotoArStickerFlow | `photo_ar` | AR 貼圖 | ❌ | ❌ | ❌ |
| PhotoOcrFlow | `photo_ocr` | 招牌 OCR | ❌ | ❌ | ❌ |
| PhotoTeamFlow（multi）| `photo_team` | 團體合影 | ✅ file input | ❌ | ❌ |

### 共用 hook
- `usePhotoCamera`（562 行）— 拍照狀態機（mode / retake）
- 沒有 facingMode / flashlight / torch 任何邏輯

---

## 3️⃣ 缺失的基本功能

### ❌ 全 8 個元件都缺
- **前後鏡頭切換**：`navigator.mediaDevices.getUserMedia({ video: { facingMode } })` 完全沒呼叫
- **閃光燈/手電筒**：`MediaTrackConstraints` 的 `torch` 屬性沒設、無法強制開光

### ⚠ 部分元件缺（3/8 沒有相簿選圖）
- 缺：PhotoMission / PhotoCompare / PhotoBurst / PhotoAr / PhotoOcr
- 有：PhotoSpot / PhotoBeforeAfter / PhotoTeam

### 為什麼缺
推測：MVP 階段先做 camera 拍攝、user 反饋後才補基本功能。

---

## 4️⃣ 相機統一改造方案（建議）

### 抽 CameraToolbar 元件
所有 8 個拍照元件共用一個 toolbar：

```
┌──────────────────────────────────────────┐
│  📷 拍照畫面（鏡頭 preview）              │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │      ●●●●●● 拍照按鈕              │   │
│  │      [📷] [⚡] [🔄] [🖼️]            │   │
│  │       拍   閃   翻   傳            │   │
│  └──────────────────────────────────┘   │
└──────────────────────────────────────────┘

按鈕：
- 📷 拍照（既有）
- ⚡ 閃光燈 toggle（新）
- 🔄 前後鏡頭切換（新）
- 🖼️ 從相簿選圖（新、統一所有元件都有）
```

### 改造範圍

| Task | 內容 | 估時 |
|------|------|------|
| **C1** | 擴 `usePhotoCamera`：facingMode state + 切換邏輯 + restart camera stream | 半天 |
| **C2** | 加 `useTorch` hook：MediaStreamTrack.applyConstraints({ torch: true }) | 半天 |
| **C3** | 抽 `CameraToolbar` 元件（4 顆按鈕）| 半天 |
| **C4** | 8 個元件統一接 CameraToolbar、移除各自實作 | 1 天 |
| **C5** | 相簿選圖統一：useGallery hook + accept image/* + 跳過 camera 流程 | 半天 |
| **C6** | e2e + 實機驗證（iOS Safari + Android Chrome）| 1 天 |

**總估時：4 天**

---

## 5️⃣ 已知技術限制

### iOS Safari
- 必須是 user gesture 觸發 getUserMedia（不能 useEffect 自動）
- DeviceMotion / DeviceOrientation 需 requestPermission（已知 motion_challenge bug）
- torch（手電筒）iOS Safari **不支援**！只 Android Chrome / 部分廠商支援

### Android Chrome
- torch 支援度：~70%（依 device + camera 規格）
- facingMode 'environment' / 'user' 切換 OK

### 跨平台兼容
- 必須做 capability detection：`getCapabilities().torch` 才 enable 按鈕
- iOS 沒 torch → 灰色按鈕 + 提示「此裝置不支援」

---

## 6️⃣ 立即可做 vs 大改造

### 🟢 立即可做（已完成）
- ✅ 紀念照 bug fix（fallback + auto retry）

### 🟡 階段 1（4 天、user 反饋的基本功能）
按上面 C1-C6 順序、4 天內完成 8 個元件的：
- 前後鏡頭切換
- 閃光燈（Android only）
- 相簿上傳統一

### 🔴 階段 2（後續、體驗優化）
詳見 [docs/changes/2026-05-07-ux-backlog.md](2026-05-07-ux-backlog.md) 11 項建議

---

## 相關文件

- [體驗優化 11 項 backlog](2026-05-07-ux-backlog.md)
- [PhotoSuccessView 修正紀錄](2026-05-07-camera-audit.md#1️⃣-紀念照載入失敗-bug----已修)
