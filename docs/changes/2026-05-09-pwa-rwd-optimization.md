# PWA / RWD 體感優化（PTR 下拉重整 + safe-area + dvh + App Shortcuts）— 2026-05-09

> 範圍：客戶端 PWA / RWD 全面體感補強
> 狀態：🟢 已部署生產（commits `31565415..5ecabf2f`）/ TS 通過
> 部署 commit：`5ecabf2f`（feat 本體）

---

## 背景

業主提出三個問題、希望網頁版 RWD 與 PWA 更穩定、更接近原生 app 體感：
1. 不同手機介面（iPhone 瀏海、Android 工具列）使用感受不一致
2. 頁面穩定度（iOS Safari 工具列展開/收起時 layout 跳動）
3. PWA 體感差異（沒有「下拉重整」這類肌肉記憶式互動）

要求關鍵字：**穩定、好用、有加分、不過於笨重、不造成手機問題**

---

## 審計現況（before）

派 Explore agent 全面審計、確認以下已做好（不重工）：
- ✅ Workbox 三層快取策略（NetworkFirst / SWR / NetworkFirst with timeout）
- ✅ A2HS 安裝提示（30 天 cooldown + 第 3 訪才彈 + 不再提示）
- ✅ OfflineBanner（離線偵測 + 手動重試）
- ✅ ErrorBoundary（chunk error 自動恢復、複製錯誤、清快取 reload）
- ✅ viewport-fit=cover + interactive-widget=resizes-content
- ✅ index.css 已有 `.safe-*` utilities + `.min-h-screen-dynamic`
- ✅ WebSocket 全域 exp backoff + visibilitychange 重連
- ✅ TanStack Query：staleTime 5min + offlineFirst + retry 1
- ✅ iOS standalone / Android PWA / TWA 偵測

### 主要缺口（要補的）
1. 玩家頁無 pull-to-refresh、5 分鐘內資料可能略舊
2. Tailwind 沒有 safe-area / dvh extend → 各處重複寫 inline style
3. 部分 layout / loader 仍用 100vh 而非 100dvh
4. PWA manifest 沒有 App Shortcuts

---

## 設計決策

### 為什麼選自製 PTR 而不用 lib

| 選項 | 結果 |
|------|------|
| 自製（採用） | ~155 行 hook + ~70 行元件、完全可控、配品牌、零依賴 |
| `react-pull-to-refresh` 等 lib | +6KB 包體、樣式被綁、部分已停更 |

### 為什麼用 window scroll 監聽而非 scroll container

避免改各頁 layout（body 維持原本滾動、children 不被 transform）。
代價：indicator 用 fixed + `safe-area-inset-top` 浮動顯示、不跟 children 一起拉動。

### 為什麼軟重整而不硬重整

「下拉 = 整頁 reload」會炸玩家當前 state。改用 `queryClient.invalidateQueries`：
- 99% 場景（資料舊）→ 軟重整足夠
- 1% 場景（頁面真掛）→ 既有 ErrorBoundary 提供「清快取重新載入」按鈕兜底

### 為什麼**先停在 Home** 不擴大

業主明確要求「不過於笨重」。Home 是流量最大頁、先驗證體驗 OK 再擴大套用是務實做法。

---

## 影響範圍

### 新增檔案（2）
| 檔案 | 行數 | 說明 |
|------|------|------|
| `client/src/hooks/usePullToRefresh.ts` | 155 | window scroll 監聽 PTR hook |
| `client/src/components/shared/PullToRefresh.tsx` | 70 | wrap 元件 + fixed indicator |

### 修改檔案（8）
| 檔案 | 改動 | 類型 |
|------|------|------|
| `tailwind.config.ts` | 加 `safe-{top,bottom,left,right}` spacing + `dvh/svh/lvh` height extend | RWD |
| `client/src/components/UnifiedAdminLayout.tsx` | `min-h-screen` → `min-h-screen-dynamic` | RWD |
| `client/src/components/PlatformAdminLayout.tsx` | 同上 | RWD |
| `client/src/components/shared/PageLoader.tsx` | 同上 | RWD |
| `client/src/components/shared/SmartRedirect.tsx` | 同上 | RWD |
| `client/src/components/shared/ForbiddenPage.tsx` | 同上 | RWD |
| `client/src/components/ErrorBoundary.tsx` | 同上 | RWD |
| `client/src/pages/Home.tsx` | wrap PullToRefresh + handleRefresh callback | PWA 體感 |
| `vite.config.ts` | manifest 加 3 個 App Shortcuts | PWA |

---

## 實作步驟（依 commit 時序）

| commit | 內容 |
|--------|------|
| `31565415` | tailwind.config.ts safe-area + dvh extend |
| `f1167140` | UnifiedAdminLayout vh→dvh |
| `a55a8ae3` | PlatformAdminLayout vh→dvh |
| `e03de717` | PageLoader vh→dvh |
| `a4ddb65e` | SmartRedirect vh→dvh |
| `7c6e9b21` | ForbiddenPage vh→dvh |
| `d607e344` | ErrorBoundary vh→dvh |
| `7571d65e..e5cc435b` | Home.tsx 套用 PullToRefresh（4 個 auto save） |
| `c4d9c60f` | vite.config.ts manifest shortcuts |
| `5ecabf2f` | **feat 本體**：新增 PullToRefresh hook + 元件 |

---

## PTR hook 設計細節

```typescript
// 4 個關鍵防呆
if (window.scrollY > 0) return;             // 防滾動中誤觸
if (t.clientX < 24) return;                  // 保留 iOS 邊緣 swipe-back
if (dy <= 0) { 釋放 }                        // 上滑釋放
const damped = Math.min(120, dy * 0.5);     // 阻尼，最多 120px
```

| 參數 | 預設值 | 理由 |
|------|--------|------|
| `threshold` | 80px | 太短易誤觸、太長手指搆不到 |
| `visualThreshold` | 60px | 拉到 60 才顯示「放開重整」 |
| `maxDistance` | 120px | 拉動上限避免拉到天上去 |
| `minRefreshMs` | 600ms | 防「閃一下」沒有做事感 |
| `edgeProtection` | 24px | 保留 iOS 左右邊 swipe-back |
| 阻尼係數 | 0.5 | 觸控位移 × 0.5 = 視覺位移 |

---

## 觸覺回饋整合

重用既有 `useHaptic.ts`：
- 達 `visualThreshold` 時 `haptic.tap()`（10ms 短震）
- iOS Safari 不支援 vibrate API → 安靜 fallback
- Android Chrome → 完整支援

---

## App Shortcuts 設計

manifest 加 3 個 shortcut（長按 PWA icon 跳出選單）：

| 名稱 | URL | 用途 |
|------|-----|------|
| 場域首頁 | `/home?launch=pwa-shortcut-home` | 回上次玩過的場域（搭配 SmartRedirect）|
| 對戰擂台 | `/battle?launch=pwa-shortcut-battle` | 公開對戰時段 + 排行榜 |
| 找適合的情境 | `/find-scenario?launch=pwa-shortcut-find` | 業務工具：3 問找情境 |

`?launch=` 參數給 `pwa-analytics.logAppLaunch()` 區分點擊來源。

---

## 驗證

### TypeScript
- `npx tsc --noEmit` 通過

### 生產驗證
- `https://game.homi.cc/` 回 200 OK（部署後 ~15s app boot 完成）
- `/api/version` 回 commit "unknown"（已知狀態、不影響）

### 業主待測（實機）
1. Home 下拉 80px → 重整中 → 軟重整 toast「已更新」
2. 下拉到一半放開 → 自動回彈
3. 從頁面中段下拉 → 不觸發（必須 scrollY=0）
4. iOS 從螢幕左邊滑回 → swipe back 仍正常
5. Android 達 threshold 觸覺輕震
6. iOS Safari 工具列展開/收起時 layout 不跳動
7. 重新安裝 PWA → 長按 icon 看 3 個 shortcuts

---

## 不做的（避免笨重）

明確判斷不做的項目（成本/效益不對）：

| 項目 | 理由 |
|------|------|
| Web Push 通知 | iOS 16.4+ 才支援、權限授權率 < 10% |
| Background Sync API | iOS Safari 完全不支援 |
| 動態 splash screen | 每解析度要 10+ 張圖、維護成本高 |
| share_target | 賈村場景使用率低 |
| 三層 SW 版本檢查（手動實作） | 現有 `autoUpdate + skipWaiting + clientsClaim` 已夠用 |
| 自製滑動切頁籤 | 收益不明、跟 wouter routing 易打架 |
| 長按選單 | 易與 iOS 文字選取衝突 |
| 觸覺回饋全站噴 | iOS 不支援、過度使用煩人 → 只 PTR 達 threshold + 按鈕成功用 |
| ErrorBoundary 重做 | 現有實作已超完善（chunk error 自動恢復、複製錯誤、清快取 reload）|
| 動 WebSocket / Workbox | 高風險、現況優秀 |

---

## 已知限制 / 後續優化

### 待擴大套用
PTR 目前只套用 Home。確認體驗 OK 後候選頁面：
- `BattleMyProfile`（玩家戰績）
- `MySquads`（我的隊伍）
- `Squad 詳情頁` (`/squad/:id`)
- `AdminSessions`（admin 列表，PTR 收益較小）

每頁追加 ~5-10 行：1 個 import + 1 個 handleRefresh callback + 1 個 wrap。

### 未驗證項目
- 業主尚未實機測試 PTR 體感（push + 部署當下）
- App Shortcuts 在 iOS / Android 不同版本表現
- 觸覺回饋在不同 Android 機型強度

---

## 相關文件

- 規範：`~/.claude/rules/documentation.md`
- 安全：[security.md](../../.claude/rules/security.md)（檢查通過：無新增 console.log / 無硬編碼密碼）

---

## 改動風險評估

| 改動 | 風險 | 已採取的安全措施 |
|------|------|----------------|
| Tailwind extend | 零 | 純擴充、不影響既有 |
| Layout vh→dvh | 低 | `.min-h-screen-dynamic` 含 100vh fallback |
| PTR 新增 | 低 | window 監聽 / passive listeners / 邊緣保留 / 必須 scrollY=0 |
| App Shortcuts | 零 | 不支援的裝置忽略 |

整體：**低風險**部署。最壞情況：PTR 體驗不對 → 拉一拉沒事、不影響核心功能。
