# CHANGELOG

> 版本紀錄總表 — 每版 ≤ 50 行，細節連結到 [`changes/`](changes/)
> 格式：`feat:` 新功能 / `fix:` 修復 / `refactor:` 重構 / `docs:` 文件 / `chore:` 雜項

---

## 2026-05-02

### 🎮 多人遊戲元件平台 12 週路徑（Phase 1 Week 1 完成 ✅）
**主題**：38 新元件 + 4 大平台基建 + 12 個情境模板
**範圍**：Week 1 7 個 commit / 5 個工作日
**狀態**：🟢 Week 1 完成、E2E 驗證通過、生產部署 healthy
**部署**：`d6134d6b..3d7dcedc`

關鍵 commit：
- `0c52ad49` W1 D1+D2: ADR-0004 + schema + types
- `6803b373` W1 D3: WS 事件 + /host /play 路徑 + admin endpoints
- `1ebe435c` W1 D4: scaffold:host 腳手架 + host/ 目錄
- `3d7dcedc` W1 D5: ShowcaseHub MVP 元件展示館

**生產 SQL**：`game_sessions` 加 `host_mode` / `host_token` / `host_token_expires_at`
**新公開頁**：[/showcase](https://game.homi.cc/showcase) 元件展示館
**新路徑**：`/host/:sessionId`（大螢幕）+ `/play/:sessionId`（玩家）

**細節** → [changes/2026-05-02-multiplayer-component-platform.md](changes/2026-05-02-multiplayer-component-platform.md)
**ADR** → [decisions/0004-host-screen-axis.md](decisions/0004-host-screen-axis.md)

⏭ 下一步：Phase 1 Week 2 — PollLive 完整實作（HostScreen 軸線首發業務元件）

### 🎮 Phase 1 Week 2 完成 ✅（PollLive 全鏈路上線）
**部署**：`3d7dcedc..e8b1447c`

關鍵 commit：
- `0201b25e` W2 D1: PollLive 元件本體（雙版型 + 10 測試）
- `c8c81b3a` W2 D2: useHostScreenSync hook + GamePageRenderer 註冊
- `6f232c69` W2 D3: HostPageRenderer + HostScreen/HostPlay 整合 game pages
- `dd8ed648` W2 D4: ShowcaseHub PollLive demo 預覽
- `e8b1447c` W2 D5: Admin host-session UI 後台管理

**完整商業鏈路打通** 🎉：admin 建 session → 大螢幕投影 → 玩家投票 → 即時更新

⏭ 下一步：Phase 1 Week 3 — HostScreen 連發 4 個元件

### 🎮 Phase 1 Week 3 完成 ✅（4 個 host 元件 + 22 測試）
**部署**：`e8b1447c..c6405f5a`

關鍵 commit：
- `6582ed45` W3 D1: EmojiReact (S) — 全場 emoji 雨 + 即時統計
- `7d2d66aa` W3 D2: WaveResponse (S) — 人浪應援 + 30 秒長條圖
- `276d9ab0` W3 D3: CrowdGather (S) — 簽到聚眾達標
- `708e2a01` W3 D4: LiveLeaderboard (M) — 即時排行 + 金銀銅 + ↑↓ 變動
- `c6405f5a` W3 D5: ShowcaseHub demo 擴充 5 元件雙版型 + W3 收尾

**HostScreen 軸線進度**：5/8 元件就位（含 PollLive）

⏭ 下一步：Phase 1 Week 4 — 補 5 個 multi 元件（JigsawPuzzle 等）

### 🎯 Phase 1 Week 4 完成 ✅（5 個 multi 元件 + Phase 1 全套收尾）
**部署**：`c6405f5a..a4e61714`

關鍵 commit：
- `90c78434` W4 D1: JigsawPuzzle (M) — 拼圖協作（親子王牌） 6/6 測試
- `8f814310` W4 D2: TreasureHunt + GpsCascade — 兩元件同輪 11/11 測試
- `5fc01cd2` W4 D3: CollectiveScore + RoleAssign — 兩元件同輪
- `a4e61714` W4 D4: ShowcaseHub demo 擴充 5 multi 元件 + 部署

**ShowcaseHub** [showcase](https://game.homi.cc/showcase)：
- 15 個 demo 入口（10 host × 雙版型 + 5 multi）
- 客戶不需登入、不需建 session 即可看到全部元件玩法

### 🎉 Phase 1 全套完成（4 週路徑）

```
Phase 1（4 週、~30 個 commit、~80 個單元測試）
├ W1: ADR-0004 + HostScreen 骨架 + ShowcaseHub MVP + scaffold
├ W2: PollLive 完整商業鏈路 + Admin UI
├ W3: 4 個 host 元件（EmojiReact/WaveResponse/CrowdGather/LiveLeaderboard）
├ W4: 5 個 multi 元件（JigsawPuzzle/TreasureHunt/GpsCascade/CollectiveScore/RoleAssign）
└ 完整部署、healthy、E2E 5 端點全綠
```

**累計能力**：
- HostScreen 軸線 5/8 元件 + Multi 軸線 13/13 元件
- Admin 後台 host-session 管理
- ShowcaseHub 15 個公開 demo 入口
- 完整鏈路：admin 建 session → 大螢幕 → 玩家投票 → 即時更新

⏭ 下一步：Phase 2（W5-W8）— 紀念類 + 接力類 + 12 情境模板（首批客戶變現）

### 🛡 Squad 系統一次到位（取代三套組隊系統）
**主題**：合併 teams / battle_clans / 過渡 squads 為單一 Squad 系統
**範圍**：8 個 commit（PR0 + PR1-PR6）
**結果**：使用者只看到「Squad 隊伍」一套概念
**細節** → [changes/2026-05-02-squad-unification.md](changes/2026-05-02-squad-unification.md)

關鍵 commit：
- `19c293aa` PR0: QR 掃描依 game mode 導正流程
- `0da1f3c0` PR1: Squad 建立頁 + 我的隊伍頁
- `22c83d8e` PR2: 戰鬥檔案 / 擂台改用 Squad
- `23e679a9` PR3a: 401 token 自動 refresh
- `921c0d2d` PR3b: 水彈報名 squad-aware
- `ff611899` PR4: teams ↔ squads bridge
- `e9bdff39` PR5: 戰績寫 squad_match_records
- `d6134d6b` PR6: battle_clans 凍結寫入（最終）

ADR：[decisions/0003-squad-unification.md](decisions/0003-squad-unification.md)

---

## 2026-05-01 ~ 2026-05-02

### 📱 PWA 使用流程優化（4 Phase A-D）
**主題**：PWA 進入動線、安裝提示、使用統計
**範圍**：8 個 commit
**細節** → [changes/2026-05-01-pwa-flow.md](changes/2026-05-01-pwa-flow.md)

關鍵 commit：
- `a42db548` Phase A: FloatingHomeButton 全域救援動線
- `d49af32a` Phase B: manifest start_url + lastVisitedField 智能路由
- `58729052` Phase C: PWA 內 QR Scan FAB（不離開 App）
- `cd202129` Phase D: PWA 使用情境統計分析
- `0f2e35fc` 後台 PWA 使用情境分析頁
- `1ed14f4a` 介面避讓 + 安裝提示防擾人優化

### 🔧 QR Code 修復
- `061843f4` 移除 Replit localhost 殘留，QR 永遠用正確 BASE_URL
- `19c293aa` QR 掃描進入依 game mode 導正流程

### 🎮 多人遊戲修復
- `9f584041` 多人遊戲完成後正確顯示「再玩一次」（getSessionsByUser effective status）

---

## 2026-04-19 ~ 2026-04-30

### 🎮 16 個遊戲元件全面優化
**範圍**：8 個 PR
**細節** → [changes/2026-04-19-game-components-audit.md](changes/2026-04-19-game-components-audit.md)（待補）

### 🌐 多場域隔離完整稽核
**細節** → [changes/2026-04-30-multi-field-isolation.md](changes/2026-04-30-multi-field-isolation.md)（待補）

---

## 歷史紀錄

> 2026-04-19 之前的詳細紀錄整理中，原 PROGRESS.md 的內容會逐步搬入 [changes/](changes/)。
> 完整歷史 commit：`git log --all --oneline`

---

## 維護規則

1. **每次部署**：在頂端加新區段（按日期降序）
2. **單版本上限**：50 行 — 超過拆到 `changes/{date}-{topic}.md`
3. **超過 6 個月**：搬到 `archive/CHANGELOG-{year}.md`
4. **格式統一**：日期、主題、範圍、commit hash、細節連結
