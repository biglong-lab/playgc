# 📱 PWA 使用情境動線優化評估

> **評估日期**：2026-05-02
> **使用者回饋**：
> 1. 點賈村卻顯示後浦，沒地方回首頁救援
> 2. 掃描遊戲 QR Code 不會自動用 PWA 開
> 3. PWA 不夠順暢，要刻意用，多數時候在瀏覽器狀態下
>
> **目的**：診斷 PWA 動線斷層 + 給整體優化方案

---

## 🔍 動線斷層診斷

### 斷層 #1 — manifest 的 start_url 沒帶 fieldCode

**現況**（vite.config.ts:93）：
```ts
manifest: {
  start_url: "/home",  // 🚨 沒帶 fieldCode
  scope: "/",
  ...
}
```

**症狀**：
- 玩家從桌面 launch PWA 圖示 → 進 `/home`（無 fieldCode）
- `/home` 路由依賴 `useCurrentField`（localStorage `lastFieldCode`）
- 但 PWA install 時若 localStorage 還是舊場域 → **永遠進錯場域**
- 即使後來在瀏覽器切到賈村，下次從 PWA 桌面點開又跳回後浦

**這就是「點賈村卻顯示後浦」最可能的根因**（生產 commit 已有 field routing fix，但 fix 是修「URL 是 /f/JIACHUN 但 hook 拿 localStorage 殘留 HPSPACE」場景，**沒修 PWA start_url 沒帶 fieldCode 這個情境**）。

---

### 斷層 #2 — 沒有「全域回首頁 / 場域切換」入口

**現況**：
- 玩家端沒有持久 header / nav
- 進到錯場域 → 唯一入口是「按瀏覽器返回鍵」（PWA 沒返回鍵！）
- PWA 是 standalone 模式，沒網址列、沒返回按鈕

**症狀**：
- 玩家 PWA 進到 `/f/HPSPACE/home`（後浦）但他想去賈村
- 找不到「切換場域」的按鈕
- 找不到「回 CHITO 平台首頁」的按鈕（`/f` 場域選擇頁）
- 唯一辦法：關閉 PWA → 重開（但又跑回 start_url 同樣場域）→ **死循環**

---

### 斷層 #3 — QR Code 掃描永遠在瀏覽器

**現況**：
- 玩家用手機相機掃 `/f/JIACHUN/game/abc123` QR
- iOS / Android 預設用 Safari / Chrome 開（不是 PWA）
- 即使玩家已安裝 PWA，掃描永遠在瀏覽器

**症狀**：
- 玩家在瀏覽器裡面玩 → 跟 PWA 體驗分離
- 玩家可能不知道有 PWA 可裝
- 即使裝了 PWA，也只是「啟動入口」，掃描動作仍在瀏覽器

**為什麼是這樣**：
- QR Code 是純 URL，沒有 `intent://` 或 deep link
- iOS 沒有 deep link 機制（只能靠 Universal Link，需要 apple-app-site-association 設定）
- Android 可用 `intent://` 或 Web App Manifest 的 `prefer_related_applications`
- 但 PWA **沒辦法接管所有同 scope URL 的開啟**

---

### 斷層 #4 — 沒 PWA install prompt 引導

**現況**：
- 沒有「安裝 CHITO App」的提示
- 玩家第一次來不知道有 PWA 可裝
- iOS 必須教玩家「分享 → 加入主畫面」（沒提示根本不會做）
- Android 可用 `beforeinstallprompt` event 主動觸發 prompt（沒實作）

**症狀**：玩家永遠在瀏覽器用，PWA 形同虛設。

---

### 斷層 #5 — PWA 啟動後沒「智能路由」

PWA 啟動進 `/home`（無 fieldCode），但 Home 元件可能：
- localStorage 沒值 → 預設 JIACHUN
- localStorage 有舊值 → 跑舊場域
- 沒檢查「最近一次玩的遊戲所屬場域」
- 沒檢查「使用者的會員場域」

**沒有智能挑選最合理的「玩家想進的場域」邏輯。**

---

## 💡 完整優化方案（按 ROI 排序）

### 🔴 P0 #1 — 全域救援動線：FloatingHomeButton

**問題解法**：右下角永遠有「🏠 回平台首頁」浮動按鈕（同 WalkieFloatingButton 模式）

新建 `client/src/components/shared/FloatingHomeButton.tsx`：
- 永遠浮在右下角（z-index 50，比 walkie 低）
- icon = Home
- 點擊 → `setLocation("/f")`（場域選擇頁）
- 在「玩家正在遊戲中」時隱藏（避免誤觸）— 用 location.pathname `/game/` 判斷
- 不在 admin / platform 路徑顯示

**效果**：玩家任何時候卡在錯場域都能一鍵回平台選場域。

工程量：1 commit / 30 分鐘

---

### 🔴 P0 #2 — 修 manifest start_url 與場域記憶

**現況問題**：start_url = "/home" 沒帶 fieldCode

**改法**（vite.config.ts）：
```ts
manifest: {
  start_url: "/?source=pwa",  // 改成根路徑 + 標記
  scope: "/",
  ...
}
```

**新建 `/`（根路徑）的 SmartRedirect 邏輯**：
1. 若 URL 帶 `?source=pwa` → PWA 啟動
2. 讀取 localStorage `lastVisitedField`（「上次主動造訪的場域」，不是 cache 的 lastFieldCode）
3. 若有 → redirect `/f/{lastVisitedField}/home`
4. 若無 → redirect `/f`（場域選擇頁）
5. **絕不依賴 cached fieldCode 自動跳場域**

**配套**：
- 玩家在 `/f/{X}/home` 主動進場域時，setLocalStorage `lastVisitedField = X`
- 場域選擇頁（`/f`）也記錄
- 別處 cache 不更新此 key

**效果**：PWA 啟動會去玩家「主動選過」的場域，不會跑錯。

工程量：1 commit / 1 小時（含 SmartRedirect 改）

---

### 🔴 P0 #3 — 場域切換 UI 內嵌（lobby + Home）

**新元件**：在 Home / Landing header 顯著位置加「📍 賈村 ▾」下拉切換器

`client/src/components/shared/FieldSwitcher.tsx`（玩家版，不同於現有 admin FieldSelector）：
- 顯示當前場域名稱 + 下拉
- 下拉選單列出所有場域 + 「+ 瀏覽其他場域」
- 點擊立即 navigate `/f/{newCode}/home` + 更新 lastVisitedField

掛載位置：
- Home header 場域 logo 旁邊
- 場域 Landing hero 區附近

**效果**：玩家明確知道「我在哪個場域」+ 一鍵切換。

工程量：1 commit / 1-2 小時

---

### 🟡 P1 #4 — PWA install prompt（Android）

**新建 `client/src/components/shared/PwaInstallPrompt.tsx`**：

```ts
// 監聽 beforeinstallprompt event
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  setDeferredPrompt(e);
});

// 適當時機（玩完一場遊戲後 / Home 第二次造訪時）顯示提示
// 「📱 把 CHITO 加入主畫面，下次更快進入」
// 點安裝 → deferredPrompt.prompt()
```

**iOS fallback**（無 beforeinstallprompt）：
- 偵測 iOS Safari（`/iPhone|iPad/.test(userAgent) && !standalone`）
- 顯示「點分享 → 加入主畫面」教學圖
- localStorage 記錄「已提示過」避免重複

工程量：1 commit / 半天

---

### 🟡 P1 #5 — QR scan 在 PWA 內部處理

**現況**：玩家用手機相機掃 QR 永遠在瀏覽器

**改法**：在 PWA 內部加「掃 QR」入口（已有 QrScanPage 的 lib，內部複用）

`client/src/components/shared/QrScanFAB.tsx`：
- Home / Landing 顯示「📸 掃描遊戲 QR」浮動按鈕
- 點擊 → 內嵌 QR scanner（用 html5-qrcode）
- 掃到後 in-app navigate（不離開 PWA）

**效果**：玩家養成在 PWA 內掃 QR 習慣，不掉到瀏覽器。

工程量：1 commit / 1 小時（QR scanner lib 已有）

---

### 🟢 P2 #6 — PWA share_target（接收外部分享進 PWA）

**改 manifest**：
```ts
manifest: {
  ...
  share_target: {
    action: "/share-receive",
    method: "GET",
    params: { title: "title", text: "text", url: "url" },
  },
}
```

**新建** `/share-receive` route 解析 URL 參數，若是場域 URL 就 redirect 到對應場域。

**效果**：玩家從 LINE 收到隊友分享的 QR Code → 系統分享選單可選 CHITO PWA → 直接在 PWA 內開啟。

工程量：1 commit / 1 小時（manifest 改 + route 加）

⚠️ 限制：iOS Safari 不支援 share_target，只 Android 有效。

---

### 🟢 P2 #7 — Universal Link（iOS 深連結）

**目標**：iOS 玩家點賈村 QR → 自動用 PWA 開（不開 Safari）

**需求**：
- 主機放 `apple-app-site-association` 檔
- 此檔聲明哪些 URL pattern 給 PWA 處理
- 玩家裝過 PWA 後，iOS 會記住此關聯

**問題**：
- PWA 不是真 native app，**iOS Universal Link 不完全支援 PWA**
- 較新 iOS 16+ 有 web app linking 但仍實驗性

⚠️ **不建議現階段做**，等 iOS 全面支援再考慮。

工程量：1 天（且效果不確定）

---

### 🟢 P2 #8 — 整合前次 PWA 評估的 Phase 1（版本檢查節流）

之前的 [PWA_OPTIMIZATION_EVAL.md](PWA_OPTIMIZATION_EVAL.md) Phase 1：
- 版本檢查 60s → 5 分鐘
- 玩家在遊戲中跳過檢查
- NetworkFirst timeout 5s → 3s

兩個 PWA 評估的優化方向**互補**：
- 本文件（動線優化）解決「玩家不愛用 PWA」
- 前文件（性能優化）解決「PWA 用起來不順暢」

工程量：1 commit / 1 小時

---

## 📊 推薦執行順序

```
Phase A — 救援動線（最緊急，玩家現在卡死沒辦法）
  P0 #1 FloatingHomeButton          1h
  P0 #3 場域切換 UI（含 Home 顯示）  2h

Phase B — PWA 啟動 / 路由智能化
  P0 #2 修 start_url + lastVisitedField  1h
  + 整合 SmartRedirect 邏輯

Phase C — 提高 PWA 使用率
  P1 #4 PWA install prompt              4h
  P1 #5 QR scan 在 PWA 內部處理         1h

Phase D — 性能優化（前評估文件 Phase 1）
  P2 #8 版本檢查節流 + timeout          1h

Phase E — 進階（依需求）
  P2 #6 share_target（Android）         1h
  P2 #7 Universal Link（iOS，效果不明）  1d
```

---

## 🎯 立即見效的核心 3 項（建議先做）

依玩家當前回饋的痛點，最重要的是：

| 優先 | 項目 | 解決什麼問題 |
|------|------|------------|
| **#1** | FloatingHomeButton | 「沒地方回首頁」立刻解決 |
| **#2** | 修 manifest start_url + lastVisitedField | 「點賈村卻顯示後浦」根因 |
| **#3** | 場域切換 UI（Home header） | 玩家明確知道在哪 + 一鍵切換 |

**3 個 commits / 4 小時 / 風險低**，做完玩家立刻有救援動線。

之後再做 install prompt、QR FAB 等，提高 PWA 使用率。

---

## 🚨 不建議做的事

| 想做的 | 為何不建議 |
|------|----------|
| iOS Universal Link | iOS 對 PWA 支援不完全，效果不可預期 |
| 強制玩家裝 PWA | 違反使用者選擇，反感 |
| PWA 內禁用瀏覽器 fallback | 萬一 PWA 壞了無路可逃 |
| 把所有 routes 都 cache | 動態場域資料 cache 會看到舊狀態 |

---

## 📝 結語

**核心洞察**：PWA「不順暢」的真正根因不是 cache / SW，而是**動線斷層**：
- 玩家進去後沒救援動線（卡錯場域出不來）
- PWA 啟動點亂跑（start_url 沒帶 fieldCode）
- 沒提示玩家裝 PWA（不知道）
- QR 掃描在瀏覽器（PWA 形同虛設）

**先解 Phase A + B（4 小時）**，玩家立刻有完整救援 + 智能啟動，PWA 體驗會跳一個級別。
