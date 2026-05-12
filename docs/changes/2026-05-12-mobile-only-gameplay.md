# 遊戲限手機 + PWA / Web 差異化 — 2026-05-12

> 範圍：路由 / RWD / PWA / 大廳桌機展示
> 狀態：🟢 本地 commit / tsc 0 / 待業主確認後部署
> 對應 ADR：[0019-mobile-only-gameplay](../decisions/0019-mobile-only-gameplay.md)
> 對應架構：[device-strategy.md](../architecture/device-strategy.md)

## 背景

業主原話：「大廳進入後、開始遊戲就限制在手機、桌機跟平板都不給使用、這樣對介面跟管理會更好處理介面與功能呈現、大廳都還是可以看得到做商品的展示、實際運行遊戲就限制在手機來使用、讓路徑單一化。手機網頁版＋PWA 都一併優化、兩者做差異化介面。」

## 影響範圍

- 路由：`/f/:code/game/*` + `/game/*` — 4 條路由加 DeviceGate
- 大廳：`/f/:code/home` — 桌機 / 平板加 LobbyDesktopHero
- 全域 CSS：`[data-app-mode]` / `[data-device-type]` 屬性選擇器
- 觸覺回饋：PlayerBottomNav tab click 加 haptics.light()

## 解決方案

### Phase 1：DeviceGate + 引導頁

新增 3 個檔案：

- `hooks/useDeviceType.ts` — 統一裝置 / PWA / 觸控偵測（多條件交叉）
- `components/shared/DeviceGate.tsx` — 守衛元件、非手機顯示引導頁
- `components/shared/UseOnMobileScreen.tsx` — 引導頁（QR + 為什麼限手機 + escape hatch）

修改 `App.tsx`：
- import `DeviceGate`
- 建 `GamePlayGated = () => <DeviceGate><GamePlay /></DeviceGate>` wrapper
- 4 條 GamePlay 路由（場域 + legacy 各 2）改用 `GamePlayGated`

### Phase 2：PWA vs Web 差異化

新增：

- `components/shared/PwaChrome.tsx` — 全域模式標記元件（`<html data-app-mode>` + body class）
- `index.css` 加屬性選擇器分支樣式：
  - `html[data-app-mode="pwa"] body { padding-top: env(safe-area-inset-top) }`
  - `html[data-app-mode="pwa"] .full-h { height: 100dvh }`
  - `.mobile-only` / `.desktop-only` / `.pwa-only` / `.web-only` 工具 class

修改 `App.tsx`：
- import + render `<PwaChrome />`（全域、render 在 Router 之前）

> **沒有重複造 BottomTabBar** — 既有 `PlayerBottomNav` 已是手機通用導覽。

### Phase 3：PWA 專屬升級體驗

新增：

- `lib/haptics.ts` — 觸覺回饋統一 API（throttle 100ms、localStorage 可關）
  - `haptics.light()` 8ms / `.medium()` 20ms / `.strong()` 40ms
  - `.success()` / `.error()` / `.warning()` pattern
- `hooks/useSwipe.ts` — 四向滑動手勢偵測（threshold + 垂直比例防誤判）

修改 `PlayerBottomNav.tsx`：
- 點 tab 觸發 `haptics.light()`（Android PWA 會震、iOS / 桌機自動 noop）

### Phase 4：大廳商品展示桌機優化

新增：

- `components/shared/LobbyDesktopHero.tsx` — 桌機 / 平板專屬 hero
  - 場域名稱 + tagline + welcomeMessage
  - 4 個功能亮點圖示（互動關卡 / 拍照 / 場域探索 / 排行榜）
  - 「掃描以手機玩」QR Code（200x200）
  - 手機自動隱藏（class `hidden md:block`）

修改 `pages/Home.tsx`：
- 在 main `<div>` 開頭加 `<LobbyDesktopHero>` props 從現有 currentField 拉

### Phase 5：觀測 + 文件

修改 `DeviceGate.tsx`：
- 加 `reportClientEvent` 上報：
  - `device_gate_blocked` — 桌機 / 平板誤入
  - `device_gate_force_enter` — 玩家點 escape hatch

新增文件：
- `docs/decisions/0019-mobile-only-gameplay.md` — ADR
- `docs/architecture/device-strategy.md` — 全圖
- `docs/changes/2026-05-12-mobile-only-gameplay.md`（本檔）

## 實作步驟

| Step | 內容 |
|------|------|
| 1 | 建 useDeviceType / DeviceGate / UseOnMobileScreen |
| 2 | App.tsx 包 4 條 GamePlay 路由 |
| 3 | 建 PwaChrome / 修 index.css 屬性選擇器 |
| 4 | App.tsx render PwaChrome |
| 5 | 建 haptics / useSwipe |
| 6 | PlayerBottomNav 加 haptics.light() |
| 7 | 建 LobbyDesktopHero |
| 8 | Home.tsx 加 LobbyDesktopHero |
| 9 | DeviceGate 接 reportClientEvent |
| 10 | 寫 ADR / architecture / change 文件 |

## 驗證

### 開發測試

```bash
npx tsc --noEmit       # 0 errors
node scripts/smoke-test-scenarios.mjs  # 51/51
```

### 實機驗證（部署後）

| 裝置 | URL | 預期 |
|------|-----|------|
| 桌機 Chrome | `/f/JIACHUN/home` | ✅ 看 LobbyDesktopHero + 場域 grid |
| 桌機 Chrome | `/f/JIACHUN/game/xxx` | ✅ 顯示 UseOnMobileScreen + QR |
| iPad Safari | `/f/JIACHUN/home` | ✅ 同桌機（grid 適配）|
| iPad Safari | `/f/JIACHUN/game/xxx` | ✅ 引導頁 |
| iPhone Safari | `/f/JIACHUN/game/xxx` | ✅ 正常進入遊戲 |
| iPhone PWA | `/f/JIACHUN/game/xxx` | ✅ 正常 + `<html data-app-mode="pwa">` |

### Telemetry 抽查

部署後 24h 看 `ws_event_log`：
- `device_gate_blocked` count（桌機 / 平板誤入率）
- `device_gate_force_enter` count（escape hatch 採用率）

## 已知限制 / 後續優化

- **iPad Pro 大平板**：可能被認成 desktop（寬度 > 1024）→ 接受、業務反正想用平板看大廳
- **桌機觸控螢幕**：會被判 mobile（有 touch + 寬度大）→ 加 UA 黑名單 fallback（後續）
- **escape hatch 過於明顯**：暫保留、觀察採用率再決定
- **PWA Android haptics**：iOS 不支援、靠 native；後續若需 iOS 震動 → 接 Web Vibration polyfill

## 相關文件

- ADR：[decisions/0019-mobile-only-gameplay.md](../decisions/0019-mobile-only-gameplay.md)
- 架構：[architecture/device-strategy.md](../architecture/device-strategy.md)
- 5 Phase 完整 commit 序列：見 git log（一次 commit）
