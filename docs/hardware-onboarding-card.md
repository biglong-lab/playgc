# 設備上線快速卡 — `small_town01`（給硬體／韌體工程師）

> 本文可直接轉發，**不含機密**。
> 完整規格見 [hardware-integration-spec.md](hardware-integration-spec.md)；本卡是針對這台設備的具體值＋最短上手路徑。
> 契約版本：MQTT v1（2026-07-23 凍結）

---

## 00 · 先備：向平台方索取 Broker 連線資訊 🔒

平台使用**託管 MQTT Broker**（如 HiveMQ Cloud）。以下 5 項由平台方申請 broker 後私下提供（勿入 Git／前端）：

| 項目 | 值（平台方填） |
|---|---|
| Broker Host | `______.s1.eu.hivemq.cloud`（待提供） |
| Port | `8883`（MQTTS / TLS） |
| Username | `______`（此設備專屬，待提供） |
| Password | `______`（待提供） |
| CA 憑證 | 公信 CA 免附；自建 broker 才需（待提供） |

> ⚠️ 在拿到以上資訊前，韌體無法連線——這是目前的前置卡點。可先照 01–06 完成程式，帳密到手即可上線。

---

## 01 · 這台設備的固定參數

| 項目 | 值 |
|---|---|
| deviceId（硬體 ID） | `small_town01` |
| 場域代號 fieldCode | `HPSPACE` |
| MQTT Client ID | `small_town01`（用 deviceId，不可含機密） |

**Topic（格式 `chito/v1/{fieldCode}/{deviceId}/{channel}`）**

| 方向 | Topic | 用途 | QoS | Retain |
|---|---|---|---|---|
| 設備→平台 | `chito/v1/HPSPACE/small_town01/event` | 命中事件 | 1 | 否 |
| 設備→平台 | `chito/v1/HPSPACE/small_town01/state` | 上線／心跳／離線 | 1 | 是 |
| 平台→設備（**訂閱**） | `chito/v1/HPSPACE/small_town01/command` | 啟動／LED／重啟等指令 | 1 | 否 |
| 平台→設備（**訂閱**） | `chito/v1/HPSPACE/small_town01/config` | 參數下發 | 1 | 是 |

---

## 02 · 連線要求

- 用 **MQTTS（TLS）連 8883**，驗證 broker CA 與 hostname（**不可** `setInsecure()`）
- Client ID = `small_town01`
- 設定 **LWT（遺囑）**：topic = `chito/v1/HPSPACE/small_town01/state`、retain = true、payload 見 03 的「離線」
- 建議改用 **ESP-MQTT（ESP-IDF）**——舊 PubSubClient 已停維護且 publish 只支援 QoS 0

---

## 03 · 設備要發的三種訊息（JSON）

所有訊息共用 8 個信封欄位：`schemaVersion` / `messageId`(每則唯一 UUID) / `deviceId` / `sentAt`(ISO8601) / `bootId`(每次開機一組) / `sequence`(遞增) / `type` / `data`。

**① 上線**（連上後立刻發，QoS 1、**retain**）→ 平台狀態變「在線」
```json
{ "schemaVersion":1, "messageId":"UUID", "deviceId":"small_town01",
  "sentAt":"2026-07-23T12:00:00Z", "bootId":"boot-1", "sequence":1,
  "type":"state",
  "data":{ "online":true, "firmwareVersion":"1.0.0", "rssi":-60 } }
```

**② 心跳**（每 30–60 秒發一次 state）→ 超過 **90 秒**沒收到，平台自動轉「離線」
（格式同上，`sequence` 遞增即可）

**③ 命中**（打到靶時發到 `.../event`，QoS 1）
```json
{ "schemaVersion":1, "messageId":"UUID", "deviceId":"small_town01",
  "sentAt":"2026-07-23T12:00:03Z", "bootId":"boot-1", "sequence":128,
  "type":"event",
  "data":{ "event":"hit", "zone":"center", "peak":3344 } }
```
> 🔴 **只送 `zone`(center/inner/outer) + `peak`(ADC 0–4095)。不要送分數、不要送玩家。**
> 分數由平台算、算誰的由平台租約決定——這是防作弊關鍵，設備只誠實回報「打到哪、多強」。

**LWT 離線**（broker 於斷線時自動代發）
```json
{ "schemaVersion":1, "messageId":"UUID", "deviceId":"small_town01",
  "sentAt":"...", "bootId":"boot-1", "sequence":0,
  "type":"state", "data":{ "online":false } }
```

---

## 04 · 設備要訂閱的指令（收到後照做並回 ack）

平台會發到 `.../command`，例如啟動：`{"type":"command","data":{"command":"start_session"},...,"expiresAt":"..."}`
- 驗 `expiresAt`（**過期不執行**）、相同 `messageId` 不重複執行
- 執行後回 ack 到 `chito/v1/HPSPACE/small_town01/ack`：`{"type":"ack","data":{"commandId":"<收到的messageId>","status":"completed"},...}`

指令 allowlist：`start_session` / `end_session` / `reset_counter` / `calibrate` / `reboot` / `self_test` / `led`。

---

## 05 · 硬體實測值（沿用 Demo，不需更動）

| 參數 | 值 |
|---|---|
| 感測 | 27mm Piezo + 100KΩ 放電/限流電阻、GPIO34、12-bit ADC |
| HIT_THRESHOLD | 500（可由平台 config 下發覆寫） |
| SAMPLE_WINDOW | 20 ms 取峰 |
| COOLDOWN | 300 ms 防餘震重複 |

> ⚠️ 正式場域前補 Piezo **過壓/負壓保護電路**；靶面加大需重測門檻。

---

## 06 · 連通測試（拿到 broker 帳密後）

1. 連 broker `:8883`（TLS）→ 應連線成功
2. 發 retained `state`(online:true) → 平台後台該設備轉**在線**
3. 敲擊靶面 → 平台收到 `event`（可在後台事件列表看到該 messageId）
4. 平台下發 `self_test` → 韌體回 `ack: completed`
5. 拔電源 → 平台 90 秒內（LWT 更快）顯示**離線**

---

## 07 · 韌體檢查清單

- [ ] Topic 全部用 `chito/v1/HPSPACE/small_town01/{channel}`
- [ ] Payload 帶齊 8 信封欄位（尤其 `messageId`/`bootId`/`sequence`）
- [ ] 命中只送 `zone`+`peak`，不送分數/玩家
- [ ] event/state QoS 1；state retain；LWT 已設
- [ ] 斷線本地佇列 + 重連沿用原 messageId 重送
- [ ] command 驗 `expiresAt`、回 ack、不重複執行
- [ ] TLS 驗證開啟；Wi-Fi/MQTT 帳密存 NVS、不進 Git
- [ ] Piezo 保護電路已加

---

**目前狀態**：平台端已就緒（後台已可管理此設備）。唯一前置＝**取得 broker 連線資訊**（00）。取得後填進平台後台即上線，硬體照本卡連線即可端到端運作。
