# ADR-0019: 遊戲限手機，大廳開放多裝置

> 日期：2026-05-12
> 狀態：採用中
> 影響：路由 / RWD / PWA / 體驗 / 業務 pitch

## 背景

業主反映：

- 遊戲頁要支援桌機、平板、手機三種裝置 → RWD 複雜度高、bug 面廣
- 客群 99% 是手機玩家、業務 demo 用桌機看大廳
- 遊戲過程需要相機 / GPS / 指南針 / 震動 — 桌機體驗差
- 路徑要單一化、減少設計面與測試矩陣

## 選項

| 方案 | 優點 | 缺點 |
|------|------|------|
| A. 全裝置都支援（現狀） | 開放 | RWD 複雜、bug 面廣、體驗不一 |
| B. 全裝置都擋、只能手機 | 最單純 | 業務沒辦法在桌機 demo |
| **C. 大廳全開放、遊戲限手機**（採用） | 商品展示 + 路徑單一 | 需 DeviceGate 機制、引導頁 |
| D. PWA only（必裝） | App 體驗 | 流失「先試試」用戶 |

## 決定

**採方案 C：大廳開放多裝置 / 遊戲限手機**。

並進一步：手機 Web 與 PWA 在外觀和手感上**刻意差異化**：

- 手機 Web — 標準網頁體驗、留住「先試試」用戶
- 手機 PWA — 升級「App 級」體驗：底部導覽常駐 + safe-area + 觸覺回饋 + 100dvh 動態高度

理由：
1. **降低測試矩陣** — 遊戲頁從 4 種裝置 × N 元件 → 1 種裝置 × N 元件、bug 面砍 ~75%
2. **業務 pitch 不受影響** — 桌機可看大廳 / 商品展示 / 場域簡介
3. **PWA 採用率提升路徑** — 玩家發現「PWA 比 Web 順」自然升級
4. **體驗一致** — 17 個 host 元件 + ~30 個 multi 元件只設計一套 viewport（375-430px）

## 影響

### 程式碼

- 新增 `hooks/useDeviceType.ts`（裝置 / PWA / 觸控偵測）
- 新增 `components/shared/DeviceGate.tsx`（守衛元件）
- 新增 `components/shared/UseOnMobileScreen.tsx`（引導頁 + QR）
- 新增 `components/shared/PwaChrome.tsx`（全域模式標記 / safe-area）
- 新增 `components/shared/LobbyDesktopHero.tsx`（桌機商品展示 hero）
- 新增 `lib/haptics.ts`（觸覺回饋統一 API）
- 新增 `hooks/useSwipe.ts`（滑動手勢）
- 修改 `App.tsx` — `<DeviceGate>` 包 GamePlay 4 條路由 + 全域 `<PwaChrome />`
- 修改 `index.css` — `[data-app-mode]` / `[data-device-type]` 屬性選擇器
- 修改 `pages/Home.tsx` — 加 `<LobbyDesktopHero>`（桌機 / 平板才顯示）
- 修改 `components/PlayerBottomNav.tsx` — 點 tab 加 haptics

### 紅線

- ❌ 桌機 / 平板開遊戲頁 → 顯示引導頁 + QR、不可玩
- ❌ 不要為桌機加遊戲頁 RWD 分支（已強制單一 viewport）
- ✅ 大廳保留 RWD（桌機 / 平板 / 手機都有專屬配置）
- ✅ Escape hatch：玩家可手動「強制進入」（記 localStorage、可觀察採用率）

### 已知限制

- 平板（iPad Pro）誤判 user agent → 多條件偵測（UA + matchMedia + touch + 寬度）
- 某些桌機觸控螢幕會被判 mobile → 接受、體驗仍可用
- 折疊機展開為平板 → 暫不特別處理

## 後續可能變動

- 若業主要求平板某個情境可玩 → 加 `requireMobile={false}` 條件
- 若 PWA 採用率 < 5% → 在手機 Web 玩 3 次後彈引導
- 若桌機誤入率高 → 加更明顯的「請用手機」hint

## 相關文件

- [changes/2026-05-12-mobile-only-gameplay.md](../changes/2026-05-12-mobile-only-gameplay.md) — 完整實作紀錄
- [architecture/device-strategy.md](../architecture/device-strategy.md) — 裝置策略全圖
