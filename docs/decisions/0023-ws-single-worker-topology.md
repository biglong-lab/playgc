# ADR-0023: WebSocket 單 worker 拓撲前提（CLUSTER_WORKERS=0）

> 日期：2026-07-04　狀態：採用中　影響：部署拓撲 / WS 即時層 / 所有多人元件

## 背景
多人長期不穩。查證：生產 `CLUSTER_WORKERS=4`，但 WS 房間/狀態/計時器全是 per-worker 記憶體 Map（`websocket.ts:50-124`）、無 Redis。跨 worker 廣播黑洞 + 計時器取消 no-op = 7/3 實測全部症狀的頭號根因。`index.ts:66-68` 原註解即假設單 worker。

## 選項
| 方案 | 優點 | 缺點 |
|------|------|------|
| A. `CLUSTER_WORKERS=0`（採用）| 一行設定恢復架構正確性；場域型平台在線量（幾十~百級）單進程綽綽有餘 | 放棄多核 HTTP 吞吐（實際瓶頸在 DB、影響小）|
| B. 維持 4 worker + Redis pub/sub | 可橫向擴充 | 大工程：房間、廣播、計時器、state cache 全要集中化；本期不需要 |
| C. LB sticky session | 改動小於 B | 同隊不同人仍可能不同 worker；REST 廣播問題不解 |

## 決定
採 **A**。理由：
1. 正確性 >> 吞吐；多人腦裂是產品核心體驗損壞
2. 現有架構文件（index.ts 註解、ADR-0018）本來就以單 worker 為前提
3. 量級評估：單 Node 進程 + PostgreSQL 足以支撐目前全部場域同時在線

## 紅線（防重蹈覆轍）
- ❌ **禁止在未完成 Redis pub/sub adapter 前把 `CLUSTER_WORKERS` 調 >0**
- 任何要開多 worker 的需求 → 先做 Phase D（Redis 集中房間+計時器+state cache）並 supersede 本 ADR

## 影響
- 生產 `.env`：`CLUSTER_WORKERS=4 → 0`
- 觀測：部署後監測 CPU/回應時間；若單核逼近上限 → 啟動 Phase D 評估

## 相關文件
- 完整分析 → [changes/2026-07-04-multiplayer-stability-analysis.md](../changes/2026-07-04-multiplayer-stability-analysis.md)
- 即時層架構 → [0018-realtime-architecture.md](0018-realtime-architecture.md)、[0014-realtime-protocol-cleanup.md](0014-realtime-protocol-cleanup.md)
