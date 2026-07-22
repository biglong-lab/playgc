# ADR-0024: MQTT v1 裝置通訊契約

> 日期：2026-07-23 · 狀態：採用中 · 影響：裝置管理、射擊關卡、計分、韌體、broker 佈署

## 背景

平台要把實體 ESP32 打擊靶接進遊戲關卡，但盤點後發現三層全斷：

1. **MQTT 從未啟動** —— `initializeMqtt()` 全專案零呼叫、無 `MQTT_*` 環境變數、compose 無 broker。
2. **協定三處互不相容** —— 韌體發 `jiachun/devices/+/hit`／server 訂 `jiachun/targets/+/hit`；server 命令發 `jiachun/commands/{id}`／韌體訂 `jiachun/devices/{id}/control`；韌體送扁平 JSON／server 讀 `message.data`。
3. **Demo 使用公用測試 broker**（MQTTGO），任何人可訂閱與偽造。

同時既有設計把「分數」與「歸屬」交給設備決定，等於把計分權威放在最不可信的一端。

## 選項

| 方案 | 優點 | 缺點 |
|---|---|---|
| A. 修補現有 topic，讓 server 相容舊韌體 | 韌體不用改 | 歧義永久留存；多靶後成本更高；仍無認證與場域隔離 |
| B. **凍結 v1 契約，韌體一次改到位** | 消除所有歧義；可做 ACL/去重/ACK | 韌體要改（目前僅 Demo 一台，成本最低） |
| C. 改走 HTTP，砍掉 MQTT | 最簡單 | 失去雙向指令、LWT 離線偵測、QoS 保證 |

## 決定

採 **B**。並確立四項原則：

1. **Topic 格式** `chito/v1/{fieldCode}/{deviceId}/{channel}`，channel 為 `state`/`telemetry`/`event`/`ack`/`command`/`config`。
   - 使用 **fieldCode（如 `JIACHUN`）而非 fieldId(UUID)**：短、可讀、韌體好燒，且與既有 [LINE webhook 對接規格](../line-webhook-relay-spec.md) 慣例一致。UUID 在 topic 中無安全價值——隔離由 broker ACL 保證，不靠 topic 難猜。
2. **設備只回報觀測，不回報結論** —— 送 `zone` + `peak`，**不送分數、不送 sessionId**。分數由 server 依遊戲設定計算；歸屬由 server 端 device lease 決定。
3. **冪等優先於傳輸保證** —— event 用 QoS 1（至少一次），平台以 `messageId` 去重；不假設 QoS 1 等於只有一次。
4. **一台一憑證** —— per-device 帳密 + broker ACL + TLS 8883，可單台撤銷輪替；禁用公用 broker 與全場共用密碼。

## 影響

- 程式碼：`shared/mqtt/contracts.ts`（zod 契約）、`server/mqtt/topic.ts`（builder/parser，拒絕非 v1）
- 韌體：需改 topic、payload 信封、QoS/LWT、ACK、TLS；PubSubClient 因停止維護且 publish 僅 QoS 0，改用 ESP-MQTT
- 資料庫：`arduino_devices` 需加 `field_id`、`api_key`；新增 `device_session_bindings`；`shooting_records` 需 `event_id` unique 去重（**全部 ADD COLUMN，遵守只加不刪紅線**）
- 舊 `jiachun/*` topic 一律不再接受，避免協定漂移

## 已知限制

- **受 [ADR-0023](0023-ws-single-worker-topology.md) 單 worker 紅線約束**：MQTT gateway 必須單例訂閱，多 worker 會導致同一命中重複寫入。水平擴展前須先補跨 worker event bus。
- 契約破壞性變更必須進版（v2）並改 topic 前綴，不得原地改 v1 語意。

## 後續可能變動

- 若未來設備數量成長到需跨場域分流，可評估 broker 端 shared subscription。
- 若導入非 ESP32 平台（如 LoRa 感測），`telemetry` channel 的 payload 需再擴充。

## 相關文件

- [硬體設備對接規格 — MQTT v1](../hardware-integration-spec.md)（給硬體廠商）
- [MQTT 設備管理完整化計畫](../changes/2026-07-22-mqtt-device-integration-plan.md)
