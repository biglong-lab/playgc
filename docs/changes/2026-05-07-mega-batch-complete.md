# 大批次體驗優化完成紀錄 — 2026-05-07

> 範圍：使用者反饋 11 項建議 + 多人穩定性 Phase A + 拍照系統優化 + RWD 階段 1
> 狀態：✅ 大部分完成、已部署生產
> 部署 commits：`b50c2e40 → ...`（一天內 16+ 部署）

---

## 完成度總表

### 11 項使用者建議

| # | 建議 | 完成度 | 部署 |
|---|------|--------|------|
| ① | 畫面比例 RWD | ✅ 階段 1 + 2 | ✅ |
| ② | 獎勵橫幅不擋畫面 | ✅ Toast viewport pointer-events:none | ✅ |
| ③ | 文字大小可選更大 | ✅ FloatingFontScale 三檔 | ✅ |
| ④ | 重新開始 / 繼續進度 | ✅ ResumeDialog（二次確認）| ✅ |
| ⑤ | 鏡頭加閃光燈 | ✅ useTorch + CameraToolbar | ✅ |
| ⑥ | 整場 BGM | ✅ useBgmPlayer Provider + duck/unduck | ✅ |
| ⑦ | 元件個別音檔 | ✅ pages.config.bgmUrl 覆蓋 game.bgmUrl | ✅ |
| ⑧ | 打字機音效 | ✅ useTypewriterSound 5 種預設 | ✅ |
| ⑨ | 對話訊息音檔 | ✅ DialogueMessage.audioUrl + admin schema | ✅ |
| ⑩ | 開關手電筒元件 | ✅ FlashlightPage（pageType=flashlight）| ✅ |
| ⑪ | 震動回饋 | ✅ useHaptic（success/error/tap/notify）| ✅ |

**11/11 = 100%**（其中 ⑨ admin UI 訊息編輯時 audioUrl 上傳介面待補）

### 多人穩定性 Phase A（fork 報告 5 個 P0）

| | 風險 | 完成 |
|--|------|------|
| A1 | LockCoop race（team_lock_states 缺 version）| ✅ |
| A2 | useTeamGameState silent fail | ✅ 409 + retry |
| A3 | GpsTeamMission 無持久化 | ✅ useTeamPagePersistence |
| A4 | WS leftAt kick | ✅ ctx.kickUserFromTeam |
| A5 | admin observability | ✅ /api/admin/multi-sessions/:gameId/state |

**5/5 = 100%**

### 拍照相機統一改造

| | 內容 | 完成 |
|--|------|------|
| 紀念照載入失敗 fallback | composite URL fail → 切原圖 + 5s auto retry | ✅ |
| 統一 CameraToolbar | 4 顆按鈕：⚡閃 📷拍 🔄翻 🖼️傳 | ✅ |
| 接 9 元件 | PhotoMission/Compare/Spot/BeforeAfter/Burst/Ar/Ocr/Team + QR | ✅ |
| 拍照震動 + 咔嚓音 | useHaptic.success() + useShutterSound | ✅ |
| QR 掃成功震動 | navigator.vibrate(50) | ✅ |

### 階段 1 軟分流（之前完成）

| | 狀態 |
|--|------|
| games.editorMode（'game' / 'activity'）| ✅ |
| AdminGames 兩個並排按鈕 | ✅ |
| ToolboxSidebar 過濾元件 | ✅ |
| AdminHostSessions 過濾 activity | ✅ |
| docs/architecture/three-paths.md | ✅ |

---

## 主要改動檔案

### 新增 hooks（10 個）
- useBgmPlayer.tsx — BGM Provider + 控制
- useTypewriterSound.ts — 5 種音效合成
- useShutterSound.ts — 拍照咔嚓
- useTorch.ts — 閃光燈
- useGallery.ts — 相簿選圖
- useHaptic.ts — 震動
- useFontScale.ts — 文字縮放

### 新增元件（7 個）
- CameraToolbar.tsx
- ResumeDialog.tsx
- FlashlightPage.tsx（pageType=flashlight）
- FontScaleSwitcher.tsx + FloatingFontScale.tsx
- FloatingBgmMute.tsx

### 新增後端 API（2 個）
- /api/admin/changelog — Dashboard 顯示更新紀錄
- /api/admin/multi-sessions/:gameId/state — 多人觀測

### Schema 改動（DB）
- games.editorMode（'game' / 'activity'）
- games.isIsolated（首頁可見 toggle、改 query 過濾）
- games.bgmUrl（整場 BGM）
- team_lock_states.version（樂觀鎖）

兩端（dev + 生產）都 ALTER TABLE 完成。

---

## 部署命令參考

```bash
# 本地開發 with test helpers（跑 e2e 用）
ENABLE_E2E_HELPERS=true npm run dev

# 生產部署（手動 SSH、Coolify webhook 不靠譜）
ssh root@172.233.89.147
cd /www/wwwroot/game.homi.cc
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 留下的 backlog

### 補完工作（小、後續）
- ⑨ DialogueEditor 訊息編輯加 audioUrl 上傳 UI（schema 已支援、admin 可走 API）
- BGM upload Cloudinary（admin 直接傳 URL 也可、但上傳 button 更友善）

### RWD 階段 3（如有需求）
- AdminGames 列表手機版深度測
- TextCardPage / ChoiceVerify 在窄螢幕的 broken 邊緣
- 5 種設備實機測試 checklist

### 多人穩定性 Phase B（之後）
- TerritoryCapture per-team snapshot 改 unified state（R3）
- 更多 e2e 補強（互動級 / race condition）

---

## 相關文件

- [使用者 11 項建議完整 backlog](2026-05-07-ux-backlog.md)
- [多人穩定性深度分析](2026-05-07-multi-stability-audit.md)
- [拍照元件盤點](2026-05-07-camera-audit.md)
- [軟分流階段 1](2026-05-07-admin-editor-split.md)
- [next-action-guide](2026-05-07-next-action-guide.md)
