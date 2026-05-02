# 📱 PWA 使用情境動線優化 v2（修正版）

> **建立日期**：2026-05-02
> **取代**：[PWA_USER_FLOW_OPTIMIZATION.md](PWA_USER_FLOW_OPTIMIZATION.md) v1
> **使用者方向修正**：
> - ❌ 不要場域切換 UI（反而造成奇怪動線）
> - ✅ 只要救援回首頁
> - ✅ 重點：PWA 內可掃 QR（不掉到瀏覽器）
> - ✅ 加 PWA 使用情境統計（後台分析）

---

## 📐 產品定位確認

```
PWA 使用者：老粉絲 / 多次回訪 / 收到通知 / 高黏性
網頁使用者：新人 / 一次性 / 朋友邀請（QR + LINE 分享）

核心情境：
1. 玩家在現場掃 QR → 大多數情境（用網頁瀏覽器掃）
2. 從首頁遊戲列表選遊戲 → 場域已明確
3. PWA 是「常客的家」，不是新人入口
```

**結論**：場域永遠由「進入點」決定，不需要「切換」。動線錯了 = 救援回首頁重新進入。

---

## 🎯 新方案核心 4 項

### 🔴 #1 — FloatingHomeButton（簡化版）

只做「回平台首頁」，不做場域切換。

**新建** `client/src/components/shared/FloatingHomeButton.tsx`：
- 右下角浮動按鈕（z-index 比 Walkie 低 10）
- icon = Home + 場域 logo（小縮圖，知道目前在哪）
- 點擊 → 確認 dialog「回平台首頁？離開當前場域」→ `setLocation("/f")`
- **顯示時機**：除了下列情境永遠顯示
  - 路徑包含 `/game/` `/team/.*play` `/match/` （遊戲中不打擾）
  - admin / platform 路徑
  - PWA share-receive flow

**效果**：玩家任何「卡錯場域」都能一鍵回平台選正確場域。

工程量：1 commit / 30 分鐘

---

### 🔴 #2 — PWA 內 QR Scan FAB（**最重要**）

讓玩家在 PWA 內就能掃 QR，不需要切回手機相機（避免掉到瀏覽器）。

**新建** `client/src/components/shared/InAppQrScanFAB.tsx`：
- 顯示位置：Home / Landing 顯著位置（不是 floating，避免跟 Walkie 衝突）
  - 建議：Home header 右上角「📸 掃描遊戲」按鈕
  - 或 Home 第一張卡片上方「📸 掃描 QR Code 進入遊戲」入口卡
- 點擊 → 開啟全螢幕 QR scanner（用既有 `useQrScanner` hook + `WalkieQRScanner` 邏輯）
- 掃到後解析 URL：
  - `/f/:fieldCode/game/:gameId` → in-app navigate（不離開 PWA）
  - `/f/:fieldCode/team/:gameId` → in-app navigate
  - 其他外部 URL → 確認對話框「離開 PWA 開啟此連結？」
- 關閉相機 → 回原頁

**為什麼這個最重要**：
- 玩家在現場掃 QR 是核心情境
- 用手機原生相機 → 跳瀏覽器 → 跳出 PWA
- PWA 內掃 → 永遠不離開 PWA → 玩家養成「進 PWA 玩」習慣

**配套**：
- 玩家第一次用 PWA 時 onboarding 提示「在這裡掃 QR 不會跳出 App」

工程量：1 commit / 1.5 小時（QR scanner library 已有）

---

### 🔴 #3 — 修 manifest start_url + 救援機制

**現況**：start_url = "/home" 沒帶 fieldCode，依賴 cache → 跑錯場域

**改法**（vite.config.ts）：
```ts
manifest: {
  start_url: "/?launch=pwa",
  scope: "/",
  ...
}
```

**新建** `/`（根路徑）的 SmartLauncher 邏輯：
1. 偵測 `?launch=pwa` 參數 → 確認是 PWA 啟動
2. 讀 `localStorage.lastVisitedField`（**主動造訪**才寫，cache 不寫）
3. 若有 → redirect `/f/{lastVisited}/home`
4. 若無 → redirect `/f`（場域選擇頁）
5. **絕不依賴 cached fieldCode（lastFieldCode）**

**配套**：
- 玩家在 `/f/{X}` 或 `/f/{X}/home` 時 setLocalStorage `lastVisitedField=X`
- `useCurrentField` hook 不寫 `lastVisitedField`（只有主動行為才寫）

**效果**：PWA 啟動會去玩家「真的去過」的場域，不會被 cache 騙。

工程量：1 commit / 1 小時

---

### 🔴 #4 — PWA 使用情境統計（後台分析）

**目標**：知道誰用 PWA、用什麼設備、留存率，幫助未來決策。

**現有 schema**：[shared/schema/client-events.ts](../shared/schema/client-events.ts) 已存在，可直接用。

**新建** `client/src/lib/pwa-analytics.ts`：

```ts
import { logClientEvent } from "./client-events"; // 既有 helper

/** PWA 啟動偵測 */
export function detectPwaMode(): "standalone" | "browser" | "twa" {
  if (typeof window === "undefined") return "browser";
  // iOS Safari
  if ((navigator as any).standalone === true) return "standalone";
  // Android / desktop
  if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
  // Trusted Web Activity (Android)
  if (document.referrer.startsWith("android-app://")) return "twa";
  return "browser";
}

/** App 啟動時 log（main.tsx 一進來就呼叫） */
export function logAppLaunch() {
  const mode = detectPwaMode();
  logClientEvent({
    eventType: "info",
    category: "pwa",
    code: `app_launch_${mode}`,
    severity: "info",
    context: {
      mode,
      pathname: window.location.pathname,
      isFromPwaParam: new URLSearchParams(window.location.search).get("launch") === "pwa",
      userAgent: navigator.userAgent.slice(0, 200),
      isMobile: /Mobi|Android/i.test(navigator.userAgent),
    },
  });
}

/** QR 掃描時 log（區分掃描來源） */
export function logQrScan(opts: {
  source: "in_pwa_scan" | "browser_camera" | "manual_input";
  scannedUrl?: string;
  inferredFieldCode?: string;
}) {
  logClientEvent({
    eventType: "milestone",
    category: "qr",
    code: `qr_scan_${opts.source}`,
    severity: "info",
    context: opts,
  });
}
```

**整合**：
- `main.tsx` 加 `logAppLaunch()`（一啟動即送）
- InAppQrScanFAB（#2）掃成功後 `logQrScan({ source: "in_pwa_scan" })`
- 既有 QrScanPage 加 `logQrScan({ source: "manual_input" })`

**後台分析頁**：

新建 `client/src/pages/admin/PwaUsageAnalytics.tsx`：
- 讀 `client_events` where category in ('pwa', 'qr')
- 圖表：
  - 啟動模式分布（PWA standalone / 瀏覽器 / TWA）
  - 各場域 PWA 比例
  - QR 掃描來源占比（PWA 內掃 vs 瀏覽器掃）
  - 7/30 天趨勢線
- API endpoint：`GET /api/admin/analytics/pwa-usage`（聚合查詢）

**效果**：
- 知道 PWA 使用率（決定是否值得投資）
- 知道哪場域 PWA 比例高（針對性推 install prompt）
- 知道 QR 掃描動線（驗證 #2 的成效）

工程量：2 commits / 半天（client logger + 後台分析頁）

---

## 🟡 P1 #5 — PWA install prompt（依 #4 數據觸發）

不馬上做，等 #4 數據出來再決定觸發時機：
- 玩家第 N 次造訪同場域 → 提示
- 完成第 N 場遊戲 → 提示
- 從現場 QR 掃描進來（高黏性訊號）→ 提示

工程量：留待數據出來再評估

---

## ⏸️ 移除的優化項目（v1 → v2）

依使用者方向修正，從 v1 移除：

| v1 項目 | 為何移除 |
|--------|---------|
| 場域切換 UI（Home header） | 切換動線本身奇怪 — 場域應由進入點決定 |
| FloatingFieldSwitcher | 同上 |
| Universal Link（iOS） | 支援不完全，效果不可預期 |
| share_target | iOS 不支援，Android 用戶比例可能低 |

---

## 📊 推薦執行順序（修正版）

```
Phase A — 救援動線（最緊急）
  #1 FloatingHomeButton              30 分鐘

Phase B — PWA 啟動智能化
  #3 修 start_url + lastVisitedField  1 小時

Phase C — 提高 PWA 使用率（重點）
  #2 PWA 內 QR Scan FAB              1.5 小時

Phase D — 數據驅動
  #4 PWA 使用情境統計（client + 後台） 半天

────────── 以上 1 天可完成 ──────────

Phase E — 等數據出來再決定
  #5 PWA install prompt               依 #4 數據評估
```

---

## 🎯 立即見效核心 3 項（推薦）

| 優先 | 項目 | 解決 | 工程量 |
|------|------|------|--------|
| **#1** | FloatingHomeButton | 卡錯場域救援 | 30 分鐘 |
| **#2** | PWA 內 QR Scan | 玩家在 PWA 掃 QR 不離開 App | 1.5 小時 |
| **#3** | start_url + lastVisitedField | PWA 啟動跑對場域 | 1 小時 |

**3 commits / 3 小時 / 風險低**，做完玩家立刻有：
- 救援動線
- PWA 內掃 QR 不脫離 App 的核心情境
- PWA 啟動不會跑錯場域

之後做 #4 統計，等數據再評估 install prompt。

---

## 🚨 後台統計設計重點

依使用者要求「交叉分析使用情境」，建議統計維度：

| 維度 | 用途 |
|------|------|
| 啟動模式（standalone / browser / TWA） | 知道 PWA 真實使用率 |
| 場域（fieldCode） | 哪場域 PWA 比例高 |
| 設備（mobile / desktop） | 桌面 PWA 是否值得做 |
| QR 掃描來源（in_pwa / browser_camera / manual） | 驗證 #2 改善後玩家行為 |
| 留存率（同 user 7/30 天再訪） | PWA 用戶 vs 瀏覽器用戶留存差異 |
| 從掃 QR 到完成第一場遊戲時間 | PWA 是否真的「更快進入遊戲」 |

實作時建議分階段：
- 第一版：只記錄事件 + 簡單分布圖（目前能立刻做）
- 第二版：交叉分析（場域 × 設備 × 留存）
- 第三版：A/B 測試介面（test 不同 install prompt 文案的轉換率）

---

## 📝 結語

**核心修正**：去掉「切換場域」概念，PWA = 老用戶的家、QR 是現場入口。

**先做 3 小時的 Phase A+B+C**，玩家立刻有完整體驗。然後 Phase D（半天）拿到數據，依數據決定後續方向。

**統計分析非常重要** — 不靠想像，靠數據說話。
