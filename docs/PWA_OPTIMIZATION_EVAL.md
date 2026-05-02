# 📱 PWA 優化評估與建議

> **評估日期**：2026-05-02
> **問題回報**：PWA 用起來不如純網頁版順暢
> **目的**：盤點現況 + 找出造成「不順暢」的原因 + 給具體建議

---

## 📊 現況盤點

### 已就位（其實做得很完整）

| 項目 | 設定 |
|------|------|
| 框架 | `vite-plugin-pwa` + Workbox |
| SW 註冊 | `registerType: "autoUpdate"` + `injectRegister: "auto"` |
| 接管策略 | `skipWaiting: true` + `clientsClaim: true`（新 SW 立即接管） |
| 過期清理 | `cleanupOutdatedCaches: true` |
| Precache | 全部 js/css/html/字型 + admin/platform 排除 |
| Runtime cache | `/api/games/:id` NetworkFirst 5s / `/api/games/:id/chapters` SWR / `/api/sessions/active` NetworkFirst 3s |
| 圖片策略 | **不走 SW**（用瀏覽器 HTTP cache，避免 opaque cache 破圖） |
| 版本檢查 | **三層**：controllerchange auto-reload + 每 60s checkVersion + AppUpdateChecker 5 分鐘 fetch HTML |
| Manifest | name / icons (192/512/maskable) / standalone / portrait / lang=zh-TW |

### 可能影響順暢度的設計選擇

```
1. 三層版本檢查機制過度密集 — 可能在玩家進行中觸發 reload
2. /api/games/:id NetworkFirst 5s timeout — 網慢時要等 5 秒才用 cache
3. 圖片完全不走 SW — 沒網或 iOS memory 緊時瀏覽器 cache 會被 evict
4. 沒設 splash screen — iOS 安裝後啟動白屏
5. 沒 modulepreload hints — 熱門 routes（Home / GamePlay）lazy chunk 首次載入慢
```

---

## 🔍 「不順暢」可能根因（按可能性排序）

### 🔴 #1 — 版本檢查過度密集 + 強制 reload

**程式碼證據**（[client/src/main.tsx](../client/src/main.tsx)）：
```ts
// 啟動後 1 秒立即 check
setTimeout(checkVersion, 1000);
// 每 60 秒
setInterval(checkVersion, 60000);
// visibilitychange（切回 app）
document.addEventListener("visibilitychange", ...);
// + AppUpdateChecker 每 5 分鐘 fetch /
// + controllerchange auto-reload
```

**症狀**：
- 玩家組好隊正要開始遊戲 → 後台 60 秒檢查發現新版 → 強制 reload → 隊員散掉
- 玩家答題答到一半 → reload → 進度可能丟失
- iOS PWA 切回 app 又觸發 visibility check → 動畫卡頓

**這個是「不順暢」最可能的根因。**

### 🟡 #2 — NetworkFirst 5 秒 timeout 太久

```ts
{
  urlPattern: /^\/api\/games\/[^/]+$/,
  handler: "NetworkFirst",
  options: { networkTimeoutSeconds: 5, ... }
}
```

**症狀**：玩家網路慢（4G 弱訊號 / WiFi 不穩） → 進入遊戲頁卡 5 秒才看到內容（fallback 到 cache）。純網頁版沒 SW 就走瀏覽器原生網路，`fetch` 失敗會立刻 throw 反而看到 error UI（可重試）。

### 🟡 #3 — Lazy chunk 首次載入

vite 預設按 route 分 chunk（lazy import）。玩家從 Home → GamePlay 第一次點擊時才載入 GamePlay chunk。SW precache 全部 js 但**首次安裝 PWA 時還沒 precache**，要等 SW activate 才能用。

**症狀**：第一次點某個多人元件，黑屏 1-2 秒（chunk 下載 + parse）。

### 🟢 #4 — 沒 splash screen + 啟動白屏（iOS）

iOS PWA 啟動時若沒設 `apple-touch-startup-image`，會看到白屏約 1-2 秒。Android 因為有 `theme_color` 啟動體驗較好。

### 🟢 #5 — Image cache 完全不走 SW

`/uploads/` 圖片靠瀏覽器 HTTP cache。在 iOS Safari memory 緊時 cache 會被 evict，玩家進遊戲看到圖片重新下載 → 閃白。但純網頁版也一樣，**這個不是 PWA vs 網頁差異點**。

---

## 💡 具體優化建議（按 ROI 排序）

### 🔴 P0：版本檢查節流 + 玩家在遊戲中不打擾（**最優先**）

工程量：1 commit / 1 小時

修改 [client/src/main.tsx](../client/src/main.tsx)：

```ts
// 改前：60 秒 + 每次 visibility + auto reload
// 改後：
//   - 5 分鐘檢查一次（不是 60 秒）
//   - reload 改為 toast「新版可用」+ 玩家點「立即更新」才 reload
//   - 偵測 path 是 /game/:id 時「不打擾」（玩遊戲中不顯示）

const isPlayingGame = () =>
  /^\/game\/|^\/team\/.*\/play|^\/match\//.test(window.location.pathname);

const checkVersion = async () => {
  if (isPlayingGame()) return; // 🆕 玩家在遊戲中跳過
  // ...既有邏輯，但 reload 改 toast prompt
};
setInterval(checkVersion, 5 * 60_000); // 60s → 5 分鐘
```

**效果**：玩家在多人遊戲中不會被打斷，平時切回 app 也不會頻繁 reload。

### 🔴 P0：NetworkFirst timeout 5s → 2-3s

```ts
// vite.config.ts
{
  urlPattern: /^\/api\/games\/[^/]+$/,
  handler: "NetworkFirst",
  options: { networkTimeoutSeconds: 3, ... } // 5 → 3
}
{
  urlPattern: /^\/api\/sessions\/active/,
  handler: "NetworkFirst",
  options: { networkTimeoutSeconds: 2, ... } // 3 → 2
}
```

**效果**：弱網絡下從卡 5 秒進入遊戲變 3 秒（依賴 cache）。

### 🟡 P1：熱門 routes 加 modulepreload hints

修改 [client/index.html](../client/index.html)：

```html
<link rel="modulepreload" href="/src/pages/Home.tsx">
<link rel="modulepreload" href="/src/pages/GamePlay.tsx">
<link rel="modulepreload" href="/src/pages/TeamLobby.tsx">
```

實際 build 後 vite 會把這些路徑換成 `/assets/Home-XXX.js`。

工程量：1 commit / 30 分鐘

**效果**：使用者瀏覽 Home 時 GamePlay chunk 已預載，點進去秒開。

### 🟡 P1：iOS PWA splash screen

新增 [client/public/splash/](../client/public/splash/) 多尺寸圖（iPhone X / Pro / Plus 等）+ `index.html` 加：

```html
<link rel="apple-touch-startup-image" href="/splash/iphone-x.png" media="(device-width: 375px) and (device-height: 812px)">
<!-- 多 size variants -->
```

工程量：1 commit / 1-2 小時（含產生 splash 圖）

**效果**：iOS 安裝啟動不再白屏。

### 🟢 P2：Service Worker 模式從 autoUpdate 改 prompt

```ts
// vite.config.ts
VitePWA({
  registerType: "prompt",  // autoUpdate → prompt
  // ...
})
```

```ts
// main.tsx
import { registerSW } from "virtual:pwa-register";
const updateSW = registerSW({
  onNeedRefresh() {
    // 顯示 toast：「新版可用，點此更新」（讓使用者選時機）
  },
  onOfflineReady() {
    // 「app 可離線使用」
  },
});
```

**效果**：SW 不會自動更新（無 controllerchange auto-reload race），由 AppUpdateChecker 一個機制統一管。

### 🟢 P2：增加圖片 SW cache（NetworkFirst 200 only）

之前移除是因為 opaque cache 問題。改用 NetworkFirst + statuses: [200]（不存 opaque）：

```ts
{
  urlPattern: /^https:\/\/res\.cloudinary\.com\//,
  handler: "NetworkFirst",
  options: {
    cacheName: "img-cloudinary",
    networkTimeoutSeconds: 3,
    expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 3600 },
    cacheableResponse: { statuses: [200] }, // 排除 opaque (status: 0)
  },
},
```

注意：`<img crossOrigin="anonymous">` 才不會存 opaque。Cloudinary 需 CORS 允許。

工程量：1 commit / 1 小時

**效果**：iOS memory 緊時圖片仍走 SW cache，遊戲中圖片不閃白。

---

## 📈 驗證方式

實作每項優化後跑：

1. **Lighthouse PWA audit**：`https://game.homi.cc` → DevTools → Lighthouse → PWA → Run
   - 目標：PWA score 90+ / Best Practices 90+

2. **實機壓測**：
   - iOS Safari + 弱網（DevTools throttle Slow 4G）
   - 玩家走完一場多人遊戲 → 確認沒被打斷 reload

3. **Memory profiling**：
   - Chrome DevTools Application → Storage → Cache Storage 看 cache 大小
   - Application → Service Workers 看 SW state

---

## 🎯 推薦執行順序

```
Phase 1（最直接）— 1 commit / 1 小時
  P0 #1 版本檢查節流 + 玩家在遊戲中不打擾
  P0 #2 NetworkFirst timeout 縮短

Phase 2（中等收益）— 2-3 commits / 半天
  P1 modulepreload hints
  P1 iOS splash screen

Phase 3（深度優化）— 2 commits / 1 天
  P2 SW 改 prompt 模式
  P2 圖片 NetworkFirst cache（含 CORS 處理）

Phase 4（驗證）
  Lighthouse audit + 弱網實測
```

---

## 🚨 Phase 1 立即見效（最值得做）

**90% 的「PWA 不順暢」應該都是 Phase 1 兩項造成**：
- 玩家被 60 秒版本檢查 reload 打斷（根因 #1）
- 弱網下卡 5 秒（根因 #2）

Phase 1 兩項合起來改動量小（純配置調整 + 加 path 判斷），風險低，立刻見效。

建議**先做 Phase 1**，實機驗證一週後再評估是否需要 Phase 2-3。

---

## ⏸️ 不建議做的優化（避免過度設計）

| 想做的 | 為何不建議 |
|------|----------|
| 全 API 都 cache（含 /my-team 等動態 endpoint） | 動態資料 cache 會讓玩家看到舊隊伍狀態，比慢更糟 |
| Background sync（離線送資料） | 多人遊戲不適合（隊友收不到） |
| Push notification | 需要 VAPID + 後台訂閱管理，工程量大且玩家體驗複雜 |
| 全部圖片 CacheFirst | opaque response 一旦壞了無法自我修復（之前已踩雷） |

---

## 📝 結語

**PWA 設定本身是好的**（已有 SW + Workbox + 三層版本檢查）— 但**機制過度密集**反而打擾玩家。

優化方向：**從「主動推更新」改為「被動且不打擾」**，讓玩家在遊戲中不被中斷。

建議先做 Phase 1（兩項配置調整），實機驗證後再決定是否做 Phase 2-3。
