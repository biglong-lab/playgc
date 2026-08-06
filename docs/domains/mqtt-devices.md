# MQTT 設備系統 — 單一現況總表

> 2026-08-06 彙整。此前資訊散落 6 處，本檔為唯一入口；細節連結原文件。
> 下次任何 MQTT 討論**先讀這裡**，避免重複盤點。

---

## 資訊地圖（原始出處）

| 文件 | 內容 | 狀態 |
|------|------|------|
| [ADR-0024 MQTT v1 契約](../decisions/0024-mqtt-v1-device-contract.md) | Topic/channel/進版規則的「為什麼」 | 採用中，勿改語意 |
| [7/22 整合計畫](../changes/2026-07-22-mqtt-device-integration-plan.md) | 完整目標架構（§8 UI 精靈規格在此） | 部分落地，見下表 |
| [hardware-integration-spec](../hardware-integration-spec.md) | 給韌體團隊的技術規格 | 有效 |
| [hardware-onboarding-card](../hardware-onboarding-card.md) | small_town01 快速接線卡 | 待補 HMAC 流程 |
| CHANGELOG 2026-07-29 | HMAC 全套上線紀錄 | 已部署 |
| CHANGELOG（設備控制遷移條目） | 舊 mqttService 死碼 → v1 gateway | 已部署 |

## 契約速記（完整版看 ADR）

```
topic:   chito/v1/{fieldCode}/{deviceId}/{channel}
channel: state / telemetry / event / ack / command / config
規則:    舊 jiachun/* 一律拒收；破壞性變更必須進 v2 換前綴
```

## ✅ 已實作並在生產（驗證日 2026-08-06）

| 項目 | 出處 |
|------|------|
| v1 契約（zod）+ topic builder/parser | `shared/mqtt/` `server/mqtt/topic.ts` |
| Gateway：指數退避重連、契約驗證、跨場域防偽、event_id 冪等去重 | `server/mqtt/ingest.ts` 等 |
| 裝置租約（同靶同時只允許一場，409 擋衝突） | `device_session_bindings` 表 ✅ 在生產 |
| HMAC 簽章（有密鑰強制驗簽、無密鑰放行漸進） | `arduino_devices.device_secret` |
| 密鑰 provisioning `POST /api/devices/:id/rotate-secret`（只顯示一次） | 7/29 上線 |
| 拒收診斷 ring buffer + `GET /api/admin/mqtt/rejects` | 7/29 上線 |
| Broker 設定 DB singleton（後台可改、env fallback） | `mqtt_broker_config`；生產 = HiveMQ Cloud，7/24 啟用 |
| 設備控制端點遷移 v1 gateway（舊 mqttService 死碼問題） | CHANGELOG |
| 射擊關卡綁實體靶機（只收綁定靶、進場租用、離頁釋放） | 7/29 上線 |

## ⬜ 計畫有、尚未落地（依 7/22 計畫章節）

| 缺口 | 計畫出處 | 影響 |
|------|----------|------|
| `device_commands` 命令帳本表 + ACK 狀態機 | §5.2 | 「已發送」≠「已執行」，操作者無從得知硬體真的動了沒 |
| `device_events` 事件表 | §5.3 | 詳情頁事件時間軸沒資料源 |
| **新增設備精靈**（自動衍生 topic/credential、首連檢查、測試綠燈才 ready） | §8.2 | 現行 DeviceDialog 仍要求手填 Topic、placeholder 是**舊格式** —— 即 CHITO c609d0c3 截圖 |
| 頁首 Broker 狀態卡（connected/最後連線/重連次數） | §8.1 | gateway 連線成功**不留 log**，連上與否只能猜 |
| 設備詳情頁（指令時間軸、desired vs reported） | §8.3 | — |
| OTA 韌體升級 | §8.3 | 首版即定位為只規劃 |

## 🔒 硬體端阻塞（軟體無法推進的部分）

- 韌體改 v1（topic/信封/QoS/LWT/ACK/TLS，PubSubClient → ESP-MQTT）
- `small_town01` 實機上線（現況：offline / unprovisioned / 無密鑰）
- 實測清單在 [hardware-onboarding-card](../hardware-onboarding-card.md)

## 距離「硬體實測」的軟體側待辦

1. 補 gateway connect 成功 log + 狀態曝光（否則實測當天無法判斷連線）
2. 模擬設備端到端驗證（mqtt client 假扮靶機 → event → `shooting_records`）
3. 為 small_town01 發 HMAC 密鑰、接線卡補密鑰流程
4. DeviceDialog 對齊 v1（不再手填 topic）

## 相關

- CHITO issue `c0428790`（後端 MQTT）、`c609d0c3`（設備/活動元件 UI）
- 排查教訓（CHANGELOG）：alpine busybox 不支援 `/dev/tcp`，容器內診斷用 `node` 測
