# 裝置策略（Device Strategy）

> 最後更新：2026-05-12
> 對應 ADR：[0019-mobile-only-gameplay](../decisions/0019-mobile-only-gameplay.md)

## 全圖

```
┌──────────────────────────────────────────────────────────────┐
│                       URL: game.homi.cc                       │
└──────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴────────────┐
                │                          │
        大廳 / 商品展示             遊戲 / 互動
        (/f/:code/home etc)        (/game/:id etc)
                │                          │
       ┌────────┼────────┐         ┌──────┴──────┐
       │        │        │         │             │
     桌機     平板     手機       手機         其他
       ✅       ✅       ✅         ✅          ❌
                                              │
                                       UseOnMobileScreen
                                       (引導 + QR + escape hatch)
```

## 裝置分類

`useDeviceType()` 回傳：

| Type | 判定條件（順序）|
|------|----------------|
| `mobile` | UA 含 `iphone/ipod/android.*mobile` 或（寬度 ≤ 767 + touch）|
| `tablet` | UA 含 `ipad/tablet/android(非 mobile)` 或（寬度 768-1023 + touch）|
| `desktop` | 其他 |

**多條件交叉**：UA + matchMedia + maxTouchPoints + window.innerWidth — 防止單一條件被偽造。

## 手機 Web vs PWA 差異化

| 維度 | 手機 Web | 手機 PWA |
|------|---------|---------|
| `<html data-app-mode>` | `web` | `pwa` |
| safe-area-inset-top | 不需要 | 自動加 padding |
| 100dvh layout | 標準 | 動態（避瀏覽器抖）|
| 既有 PlayerBottomNav | ✅ 通用 | ✅ 通用 |
| `PwaInstallEntry` 安裝提示 | ✅ 顯示 | ❌ 自動隱藏 |
| 觸覺回饋（haptics）| Android 有 / iOS 沒 | Android 有 / iOS 沒 |
| 離線快取 | 標準 SW | 同 |
| App Shortcuts（長按 icon）| ❌ | ✅ |
| 桌面 icon / splash | ❌ | ✅ |

> 觸覺回饋以 `navigator.vibrate` 可用性為準（Android 都行、iOS Safari 不支援，與 PWA 與否無關）。

## 工具 class（CSS）

| Class | 顯示時機 |
|-------|---------|
| `.mobile-only` | 只在 `data-device-type="mobile"` 顯示 |
| `.desktop-only` | 不在手機顯示（含 tablet）|
| `.pwa-only` | 只在 `data-app-mode="pwa"` 顯示 |
| `.web-only` | 不在 PWA 顯示 |
| `.hidden md:block` | 桌機 + 平板顯示（Tailwind 既有，與上面兩套搭配）|

## 守衛機制

```tsx
import DeviceGate from "@/components/shared/DeviceGate";

<DeviceGate requireMobile>
  <GamePlay />
</DeviceGate>
```

- 桌機 / 平板開啟 → `<UseOnMobileScreen />` 引導頁（QR + 說明 + escape hatch）
- 玩家點 escape hatch（「我已了解、仍要在此繼續」）→ localStorage 記 `device-gate:force-enter=1`、reload 後直接進入
- 兩種事件透過 `reportClientEvent` 上報：
  - `device_gate_blocked` — 桌機 / 平板誤入
  - `device_gate_force_enter` — 玩家覆寫進入

## 既有 PWA 偵測機制

集中在 `useDeviceType().isPwa`，整合：

1. `display-mode: standalone` matchMedia
2. `display-mode: fullscreen` matchMedia
3. iOS `navigator.standalone === true`
4. URL 帶 `?launch=pwa*`（既有 PWA shortcut 標記）

## 大廳桌機展示

`Home.tsx` 在桌機 / 平板顯示 `<LobbyDesktopHero />`：

- 場域名稱 + tagline + welcomeMessage
- 4 個功能亮點圖示
- 「掃描以手機玩」QR Code

手機自動隱藏（class `hidden md:block`）。

## 觀測

| Event | 觸發 | 用途 |
|-------|------|------|
| `device_gate_blocked` | 桌機 / 平板開遊戲頁 | 量化誤入率 |
| `device_gate_force_enter` | 玩家點 escape hatch | 量化「真的想用桌機」比例 |

兩者寫入 `ws_event_log`（透過 `reportClientEvent`），可在 `/admin/session-replay` 觀察。

## 後續演進

- 若 escape hatch 採用率 > 10% → 重新評估「全裝置都讓玩」
- 若桌機誤入率 > 5% / 月 → 強化引導頁、加業務 pitch CTA
- 若平板誤判（iPad Pro 寬螢幕）→ 加 user-agent client hints 偵測
