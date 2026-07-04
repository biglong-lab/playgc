# 系統優化盤點與優先序 — 2026-07-04

> 範圍：全系統（測試管線 / 文件積壓 / 程式健康 / 功能推進）
> 方法：四路盤點——①ProPlan CHITO 管線 ②文件/backlog（next-action-guide、codex BACKLOG、PROGRESS.md、16 份 changes、5 份 ADR）③程式健康度 ④本週修復後續。全部有出處。
> 狀態：盤點完成、第 1 批（A1-A3）開工

---

## 🔴 A 類：安全與穩定（立即、不依賴外部）

| # | 項目 | 證據 |
|---|------|------|
| A1 | 依賴漏洞：npm audit（production）33 個 = **9 high** + 21 moderate + 3 low；95 套件過期 | 健康度盤點 |
| A2 | 測試債：codex BACKLOG 10 項 ~40 失敗測試（battle-clans 斷言改 410、adminContent、webhook-recur、locations「疑真 bug」等）+ `GamePlay.test.tsx` 整檔失效（缺 WebSocketProvider mock、10 測試）| `codex-claude/BACKLOG.md` |
| A3 | 多人 server 併發路徑零單元測試：votes onConflict / race conditional UPDATE / team-state version / **scores 原子化（7/4 剛改）** | ADR-0023 分析 |

## 🟠 B 類：效能（手機玩家直接有感）

| # | 項目 | 證據 |
|---|------|------|
| B1 | `vendor-icons` bundle **760KB**（lucide 疑沒 tree-shake、可能有 dynamic icon map）| dist 盤點 |
| B2 | 主 bundle 648KB（code splitting 機會；livekit 480KB、charts 384KB 已各自分包）| dist 盤點 |

## 🟡 C 類：程式健康（「碰到才拆」、不集中重構）

- **>800 行紅線違規 20 檔**。最重：`scenarios.ts` 3363、`platform.ts` 2800、`FieldSettingsPage` 2343、`PageConfigEditor` 2193、`AdminDashboard` 1606、`websocket.ts` 1176、`pos.ts` 1114、`GamePlay.tsx` 924、`ScheduleEditor` 851
- 策略：只優先拆**高頻改動檔**（pos.ts / websocket.ts / GamePlay.tsx / ScheduleEditor 抽 CalendarPreview）；低頻大檔（scenarios.ts 產生器類）緩
- TODO/FIXME 僅 10 處（衛生佳）；285 個測試檔

## 🔵 D 類：功能推進（待業主定向）

| # | 項目 | 出處 | 備註 |
|---|------|------|------|
| D1 | Squad Phase 14/15（完成度 65%、Phase 14 標阻塞：主表遷移/lifecycle/段位/招募獎勵/自評）| PROGRESS.md（4/25）| ⚠️ 時效未知、開工前先抽查現況 |
| D2 | 預約 recurrence（每週固定包場）| ADR-0022 | 小中、貼近營運 |
| D3 | POS C2：刪除交易連動作廢退款 | 6/30 ghost-refund | 小 |
| D4 | AR world tracking | CHITO 測試員期待 | 大、需評估 |
| D5 | 5 月殘留：AI 推薦引擎 / 預覽真實跳轉 / SCENARIO_TEMPLATES 重組 | next-action-guide | 需業主確認還要不要 |
| D6 | 多場域化（Telegram fieldId mapping / POS 報表 SQL 化）| 6/13 changes | 有新場域再做 |

## ⏳ 外部依賴（等待、不佔開發量）
- CHITO 8 張 `testing` 待測試員複測（多人 3 台真機腳本已備）
- 道具+10 待 admin 設定該頁獎勵分數 0
- 單 worker CPU 觀測（逼近上限 → Phase D Redis、ADR-0023 紅線）

## 執行順序
1. **第 1 批（進行中）**：A1 high 漏洞 → A2 測試債清償 → A3 併發測試
2. 第 2 批：B1 vendor-icons + B2 bundle
3. 第 3 批：C1 高頻檔分拆
4. 第 4 批：D 類擇向（建議 D2 或 D1）
滾動：CHITO 複測 fail 項插隊優先。

## 已剔除（近期已完成、勿誤列待辦）
7/4 多人拓撲+韌性、7/3 session/觸控/AR/GPS 第2輪、7/2 預約 closures + CHITO 6 修復 + AR 2 功能、6/30 預約 fieldId/PWA 韌性/POS 幽靈退款。
