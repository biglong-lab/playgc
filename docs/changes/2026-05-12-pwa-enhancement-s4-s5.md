# PWA 體驗強化 S4-S5 — 2026-05-12（接 S0-S3）

> 範圍：iOS PWA storage 救援 + 弱網降級
> 狀態：🟢 本地 commit / tsc 0 / smoke 51/51 / 待部署
> 接續：[2026-05-12-pwa-enhancement-s0-s3.md](2026-05-12-pwa-enhancement-s0-s3.md)

## 變更

### S4 — C6: iOS PWA Storage Fallback

**問題**：iOS 17+ PWA standalone 模式下、localStorage 偶爾會被系統清空（玩家被登出、設定遺失）。IndexedDB 通常保留。

**新增**：`client/src/lib/safe-storage.ts`
- `safeStorage.getItem(key)` — 先讀 localStorage、null 才查 IndexedDB、有就回填
- `safeStorage.setItem(key, value)` — 同步寫 localStorage + 非同步寫 IndexedDB（雙寫）
- `safeStorage.removeItem(key)` — 雙刪
- `rehydrateImportantKeys(keys[])` — 啟動時批次還原

**整合**：`client/src/main.tsx`
- 啟動時 `void rehydrateImportantKeys([...])` 還原 5 個重要 key：
  - `chito:lastVisitedField`（場域記憶）
  - `chitoUserName`（玩家暱稱）
  - `chitoFontScale`（字級設定）
  - `lastFieldCode`（最後場域代號）
  - `theme`（主題）

**觀測**：`safe_storage_restored` / `safe_storage_rehydrated` event 上報、可在 ws_event_log 統計 iOS 清空頻率。

### S5 — C4: 弱網自動降級

**新增**：`client/src/hooks/useNetworkQuality.ts`
- 用 `navigator.connection` Network Information API（Chrome / Edge 支援）
- `useNetworkQuality()` 回 `{ quality: 'fast'|'moderate'|'slow'|'unknown', saveData, downlink, effectiveType }`
- 自動偵測：
  - `slow-2g` / `2g` → `slow`
  - `3g` → `moderate`
  - `4g` → `fast`
  - 使用者開 Data Saver → 強制 `slow`
- `withNetworkQuality(url, info)` helper：給 Cloudinary URL 加品質參數
  - `slow` → 插入 `q_auto:low`
  - `saveData` → 插入 `q_auto:eco`
  - `fast` / `unknown` → 不變

**整合**：`client/src/components/shared/OptimizedImage.tsx`
- import `useNetworkQuality` + `withNetworkQuality`
- `optimizedSrc` useMemo 自動套用品質降級

**影響**：所有用 OptimizedImage 的場景（場域 cover / 卡片 / 圖示 / 縮圖）弱網自動省流量。

## 影響檔（共 4 檔）

| 檔 | 變動 |
|----|------|
| `client/src/lib/safe-storage.ts` | 新增（159 行）|
| `client/src/hooks/useNetworkQuality.ts` | 新增（91 行）|
| `client/src/main.tsx` | 啟動時 rehydrate |
| `client/src/components/shared/OptimizedImage.tsx` | 套 withNetworkQuality |

## 驗證

- ✅ `npx tsc --noEmit` 0 errors
- ✅ `node scripts/smoke-test-scenarios.mjs` 51/51 全綠

## 未做（留下波）

| 項 | 原因 |
|----|------|
| **B1 Web Push** | 需後端 VAPID + endpoint + DB 表、業主後端配合工作量大 |
| **B3 Background Sync** | 需 SW 大改、風險高 |
| **C1 RWD 桌機分支大清理** | 低 ROI、純清理、可隨開發逐步清 |
| **C5 記憶體洩漏 Top 5** | 需實機 profiling、不是純 grep 能解 |
| **A4 底部 Tab 滑切** | 跟 carousel / grid 滑動衝突風險、需設計師確認手勢方案 |
| **A6 iOS Splash 圖** | 需設計師出 10+ 種解析度 splash png |

## 待業主實測

| 期待 | 怎麼看 |
|------|--------|
| iOS PWA 玩到一半被登出機率下降 | 24h 觀察 `safe_storage_restored` event |
| 弱網 4G / 公共 WiFi 圖片快很多 | Chrome DevTools throttle "Slow 4G" 開大廳 → 圖片自動 q_auto:low |
| Data Saver 模式進一步省流量 | Android 設定開 Data Saver → 圖更輕 |

## 階段性總結（S0-S5 全部）

| Sprint | 完成項 | 留下波 |
|--------|--------|--------|
| S0 | 清 dead code (haptics 重複) ✅ | — |
| S1 | 觸感套用 + 遊戲頁防護 ✅ | — |
| S2 | PTR 擴大 2 頁 ✅ | A4 滑切 / A6 splash |
| S3 | Web Share + WS UX ✅ | B5 智能 install / B6 離線降級頁 |
| S4 | iOS storage 救援 ✅ | B1 Web Push / B3 Bg Sync |
| S5 | 弱網降級 ✅ | C1 RWD 大清理 / C5 記憶體 |

**累計新增**：3 hooks（useDeviceType / useNetworkQuality + S1 既有套用）、5 lib（haptics deleted、safe-storage + web-share）、3 元件（DeviceGate + UseOnMobileScreen + LobbyDesktopHero + PwaChrome）、修改 ~10 檔。
