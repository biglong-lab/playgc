# 下次接續指南 — 2026-05-09 起

> **目的**：讓使用者下次只要說「繼續第 X 項」、我就能精準接上、不需重新討論
> **產生時間**：2026-05-08 凌晨（Phase 0-4 + v2 全套上線後）
> **生產 commit**：`b7524c4c`（已 push origin/main）
>
> **使用方式**：
> - 「繼續」→ 我讀 PROGRESS + 此檔、回報狀態 + 列可選工作
> - 「繼續第 X 項」→ 我直接執行該項
> - 「跑完活動發現 Y」→ 直接告訴我問題、跳過此檔

---

## 📊 目前狀態總覽

**已上線生產（待業主驗證）**：
- ✅ 多人遊戲穩定性 Phase 0-4 全套
- ✅ AdminMultiSessions v2 16 項打磨
- ✅ ADR-0018 + CI 規範 + 21 個 e2e tests
- ✅ 2 個 cron（observability cleanup + multi-sessions alert）
- ✅ 90 天 ws_event_log retention

**等業主跑真實活動**：
- ⏸️ Telegram 告警是否誤觸（待 5 分鐘 cron 跑 + 真實事件觸發）
- ⏸️ 真實 online 比例（5 分鐘 polling vs ws_event_log 實際差異）
- ⏸️ 對講機 reconnect 實機驗證

---

## 🎯 可接續工作清單（A 類：不需業主先做事）

### A1. ws_event_log Dashboard 統計圖（推薦、1.5-2 天）
**為什麼推薦**：
- 已有 90 天 log 在累積、資料躺著不視覺化是浪費
- 對應您之前要求的「跨 session 聚合視圖」
- 與 `/admin/multi-sessions`（即時觀測）互補

**內容**：
- 過去 24h / 7 天 / 30 天 reconnect rate 折線圖
- grace_expired count per day 柱狀圖
- active sessions / time of day heatmap
- 異常 sessions Top 10（按 grace 次數排）
- 路徑建議：`/admin/realtime-health`

**接續指令**：「繼續 A1」或「做 ws_event_log Dashboard」

---

### A2. Phase 5 — solo/match WS 整合（評估）（1.5-2 天）
**為什麼可選**：
- ADR-0018 白名單目前 2 處例外：`ShootingMissionPage.tsx`（solo）+ `use-match-websocket.ts`（match）
- 不在原 user 回報問題範圍、但長期應整合

**做法**：
- 都改用 `useWebSocket()` Provider
- ShootingMissionPage 含作弊防護邏輯、要小心保留
- use-match-websocket 用在 `useMatchLobby` 1 處、改造範圍小

**接續指令**：「繼續 A2」或「評估 Phase 5 整合」

---

### A3. 真實多人 e2e 跑全套（30 分鐘）
**目的**：填補 e2e 16 tests 中 13 個 skipped（dev server 沒重啟）

**指令**：
```bash
# 停目前 dev server（手動 Ctrl+C）
ENABLE_E2E_HELPERS=true npm run dev
# 另一個 terminal:
npx playwright test e2e/multi-realtime-stability-phase04.spec.ts --project="Desktop Chrome"
```

**預期**：16 通過 / 0 skipped / 0 fail

**接續指令**：「繼續 A3 跑 e2e 全套」（**需您手動重啟 dev server**）

---

### A4. CI workflow 整合 e2e + ADR check（30 分鐘）
**內容**：
- `.github/workflows/ci.yml` 加 e2e job
- 加 `bash scripts/check-ws-singleton.sh` 自動跑

**好處**：未來 PR 自動跑 e2e、不會再有人破壞 ADR-0018

**接續指令**：「繼續 A4 CI 整合」

---

### A5. 補充功能完整性 checklist（task #3 之前 deferred）（1-2h）
**內容**：
- 寫 `docs/changes/2026-05-08-feature-checklist.md`
- 列出 60 個 multi 元件的可見行為清單
- 作為未來 ws 重構的對照基準

**為什麼可做**：之前 Phase 1 前我跳過了正式 checklist、可補回來作 archive

**接續指令**：「繼續 A5 寫 checklist」

---

## 📋 等業主提供資料後可做（B 類）

### B1. 真實活動數據分析（業主跑活動後）
**前置**：業主跑 1-2 場 5+ 人多人活動

**做法**：
- 進 `/admin/multi-sessions` 截圖
- 進 `/admin/sessions/:id/replay` 看完整事件
- 統計：reconnect rate / grace 觸發率 / online ratio
- **改前 vs 改後對照**：用 git log 找出改前同類活動數據（如有）

**接續指令**：「跑了 X 場活動、有 Y 個玩家斷線、看一下數據」

---

### B2. 異常事件根因分析（如有 Telegram 告警）
**前置**：Telegram 收到 critical session 告警

**做法**：
- 看告警訊息中的 sessionId
- 進 Replay UI 看時間軸
- 找出 grace_expired / auto_leave 集中在哪個玩家、哪個時間點
- 判斷是「網路問題」「玩家自己關 app」還是「server bug」

**接續指令**：「Telegram 告警了 sessionId XXX、看一下」

---

### B3. Telegram 告警閾值微調（觀察 1-2 週後）
**前置**：跑 1-2 週真實活動、有累積告警

**現況閾值**：
```ts
CRITICAL_SCORE_THRESHOLD = 20  // anomalyScore >= 20 才告警
COOLDOWN_MS = 30 * 60 * 1000    // 同 session 30 分鐘 cooldown
```

**可能調整**：
- 太多誤觸 → 提高 threshold 到 30 / 50
- 漏掉真問題 → 降低到 15
- cooldown 太長 / 太短 → 調 15min ~ 60min

**接續指令**：「告警太頻繁、調閾值」/「漏掉問題、降閾值」

---

## 🌍 長期 backlog（C 類、不急）

### C1. server-side ws stress test（k6 / Artillery）
- 評估 server 容量極限（200 條 ws? 500? 1000?）
- 規劃 scaling
- 工：1-2 天

### C2. PostgreSQL declarative partitioning
- 觸發條件：ws_event_log 表大小 > 50GB
- 預估發生時機：100 人/天 × 90 天 = 90GB
- 工：1 天

### C3. 對講機完整紀錄機制（admin opt-in）
- 加環境變數開關 `ENABLE_CHAT_FULL_LOG=true`
- 業主同意條款後可開啟
- 用於爭議仲裁需要看完整對話內容
- 工：0.5 天（環境變數已預留、加 admin UI 開關）

### C4. WebSocket 改用 socket.io（重大架構變更）
- 觸發條件：自寫 ws 出現 scaling 瓶頸
- 收益：自動 fallback to long-polling、bro adcast namespace
- 風險：改 60 個元件、ADR-0018 重新評估
- **不推薦輕易做**

---

## 🔧 維護任務（D 類、定期）

### D1. 每週 docs/changes 整理
- 6 個月以上的搬 docs/archive/
- 確認 CLAUDE.md 索引完整

### D2. 每月 ws_event_log 容量檢查
```sql
SELECT pg_size_pretty(pg_total_relation_size('ws_event_log'));
SELECT pg_size_pretty(pg_total_relation_size('db_write_log'));
```
- > 50GB → 評估 partitioning（C2）

### D3. 每季 ADR 健檢
- ADR-0018 規則是否仍合理
- 例外（solo / match）是否該整合（A2）

---

## 🚨 緊急情境處理（E 類、希望永遠不需要）

### E1. 生產出事 — 完整回滾預案
```bash
ssh root@172.233.89.147
cd /www/wwwroot/game.homi.cc
# 回到 Phase 0-4 之前（保留 booking / 預約系統）
git revert b7524c4c 550d60bc f457c085 26ffd996 66be6625 d268f351 0cb06f09 57b89812 a8a9d27c 13d1c594
git push origin main
docker compose -f docker-compose.prod.yml up -d --build app
# DB 不需 revert（schema 只新增、舊功能不受影響）
```

### E2. 部分回滾（保留監測、退架構重構）
```bash
git revert b7524c4c 550d60bc f457c085 26ffd996 66be6625 d268f351 0cb06f09
# 保留 Phase 0.1/0.2/0.3（監測能力）、退 Phase 1-4（架構改造）
git push && docker rebuild
```

### E3. ws_event_log 表異常成長
```sql
-- 立即清舊資料
SELECT cleanup_observability_logs(7);  -- 改成 7 天 retention 救急
-- 然後評估 partitioning（C2）
```

---

## 💡 接續指令快速對照表

| 您說 | 我會做 |
|------|--------|
| 「繼續」 | 讀 PROGRESS + 此檔、報告狀態、列可選 A 類工作 |
| 「繼續 A1」 | 直接做 ws_event_log Dashboard |
| 「繼續 A2」 | 評估 Phase 5 solo/match 整合 |
| 「繼續 A3」 | 跑 e2e 全套（提醒您重啟 dev server） |
| 「跑了活動有 X 問題」 | 直接看 Replay + ws_event_log 找原因 |
| 「Telegram 告警 sessionId XXX」 | 進 B2 根因分析流程 |
| 「告警太頻繁」 | 進 B3 調閾值 |
| 「生產出事、回滾」 | 進 E1/E2 回滾預案（**會先確認**） |

---

## 📚 重要文件導航

- **全日總結** → [2026-05-08-summary.md](2026-05-08-summary.md)
- **架構規範** → [decisions/0018-realtime-architecture.md](../decisions/0018-realtime-architecture.md)
- **完整規劃** → [2026-05-08-multi-stability-refactor-plan.md](2026-05-08-multi-stability-refactor-plan.md)
- **v2 打磨** → [2026-05-08-admin-multi-sessions-v2.md](2026-05-08-admin-multi-sessions-v2.md)

---

## 🔄 何時更新此檔

- ✅ 完成 A 類項目時 → 移到「已完成」section（或刪除、避免膨脹）
- ✅ 業主反映新問題時 → 加進新 section
- ✅ 發現新長期 backlog → 加進 C 類
- ❌ 不要每次 commit 都更新此檔（churn）

下次重大變動 / 1 週後可寫新版本：`docs/changes/2026-05-XX-next-action-guide.md`、舊版 supersede。

---

**END Next Action Guide v1 — 2026-05-09**
