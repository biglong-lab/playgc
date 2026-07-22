# 硬體設備對接規格 — MQTT v1（game.homi.cc / 賈村）

> 給硬體/韌體工程師的對接文件。依此規格改韌體，即可與平台正式串接。
> 本文件不含任何機密金鑰，可直接轉給對方工程師。
> 契約版本：**v1（2026-07-23 凍結）** · 決策依據：[ADR-0024](decisions/0024-mqtt-v1-device-contract.md)

---

## 01 · 通訊總覽

| 項目 | 值 |
|---|---|
| 協定 | MQTT over TLS（**MQTTS**） |
| Broker | 由平台方提供（託管 broker，**不再使用公用測試 broker**） |
| Port | `8883`（TLS）。**禁止使用 1883 明文** |
| 認證 | **每台設備一組獨立帳密**（provisioning 時發給，可單台撤銷/輪替） |
| Client ID | 固定 = 硬體 ID（如 `TARGET_001`），不可含機密 |
| 契約版本 | payload 內 `schemaVersion: 1` |

> ⚠️ Demo 期間使用的公用 broker（MQTTGO）**不可用於正式營運** —— 任何人都能訂閱你的 topic，也能偽造命中灌分。

## 02 · Topic 規範（新舊對照）

統一格式：**`chito/v1/{fieldCode}/{deviceId}/{channel}`**
賈村的 `fieldCode` = `JIACHUN`（大寫，請勿更動）。

| 用途 | ❌ 目前韌體（要改） | ✅ v1 正式規格 |
|---|---|---|
| 命中事件 | `jiachun/devices/{ID}/hit` | `chito/v1/JIACHUN/{ID}/event` |
| 心跳/狀態 | `jiachun/devices/{ID}/heartbeat`、`/status` | `chito/v1/JIACHUN/{ID}/state` |
| 接收指令 | `jiachun/devices/{ID}/control`、`/led` | `chito/v1/JIACHUN/{ID}/command` |
| 接收設定 | `jiachun/devices/{ID}/config` | `chito/v1/JIACHUN/{ID}/config` |
| 指令回執 | （無） | `chito/v1/JIACHUN/{ID}/ack` |

**設備權限（broker ACL 會強制）**：只能 publish 自己的 `state`/`telemetry`/`event`/`ack`，只能 subscribe 自己的 `command`/`config`。存取其他設備或其他場域會被 broker 拒絕。

## 03 · Payload 共通信封

**所有訊息都必須是 JSON，並包含這些欄位**（目前韌體送扁平 JSON，需改）：

| 欄位 | 型別 | 說明 |
|---|---|---|
| `schemaVersion` | number | 固定 `1` |
| `messageId` | string(UUID) | **每則訊息唯一** —— 平台用它做去重 |
| `deviceId` | string | 硬體 ID，如 `TARGET_001` |
| `sentAt` | string | ISO 8601 UTC，如 `2026-07-23T04:12:33Z` |
| `bootId` | string | **每次開機產生一組新的**（辨識重開機） |
| `sequence` | number | 單調遞增序號（偵測遺漏） |
| `type` | string | `state` / `telemetry` / `event` / `ack` |
| `data` | object | 依 type 而定，見下 |

### 命中事件（最重要）

```json
{
  "schemaVersion": 1,
  "messageId": "3f2b1c8e-....-....-....-............",
  "deviceId": "TARGET_001",
  "sentAt": "2026-07-23T04:12:33Z",
  "bootId": "boot-1721707953",
  "sequence": 128,
  "type": "event",
  "data": { "event": "hit", "zone": "center", "peak": 3344 }
}
```

> 🔴 **韌體不要送分數，也不要送 sessionId / 玩家資訊。**
> 分數由平台依遊戲設定計算；「這一擊算誰的」由平台端的場次綁定（lease）決定。
> 設備只需誠實回報「打到哪一區、峰值多少」。

### 狀態 / 遺囑（LWT）

```json
{ "...信封...", "type": "state",
  "data": { "online": true, "firmwareVersion": "1.0.3", "rssi": -62, "uptimeSec": 3821 } }
```

### 指令回執（收到 command 後必回）

```json
{ "...信封...", "type": "ack",
  "data": { "commandId": "<收到的 messageId>", "status": "completed" } }
```
`status`：`accepted`（已收下）→ `completed`／`failed`（執行結果）。

## 04 · QoS / Retain / LWT 規定

| Channel | 方向 | QoS | Retain |
|---|---|---|---|
| `state` | 設備→平台 | **1** | **是** |
| `event` | 設備→平台 | **1** | 否 |
| `ack` | 設備→平台 | **1** | 否 |
| `telemetry` | 設備→平台 | 0 | 否 |
| `command` | 平台→設備 | 1 | 否 |
| `config` | 平台→設備 | 1 | 是 |

- **LWT（遺囑）必設**：topic = 自己的 `state`、retain = true、payload 為 `{"online": false, ...}`。拔電時平台才能立即知道離線。
- **連線成功後**發一則 retained `state`（`online: true`）。
- **QoS 1 會重送** —— 平台以 `messageId` 去重，韌體只要負責「斷線期間存好、重連後重送」。

## 05 · 韌體必做事項

1. **改用 ESP-MQTT（ESP-IDF）** —— 目前的 PubSubClient 已停止維護，且 **publish 只支援 QoS 0**，無法滿足命中不遺失的要求。
2. **TLS 驗證 broker CA 與 hostname**（不可 `setInsecure()`）。
3. **本地佇列**：斷線期間把 event 存起來，重連後依原 `messageId` 重送。
4. **指令處理**：驗證 `schemaVersion`、`deviceId`、`expiresAt`（**過期不執行**）；相同 `commandId` 不重複執行；先回 `accepted`、做完回 `completed`/`failed`。
5. **指數退避 + jitter** 重連，不要無限快速重試。
6. **憑證不可硬編碼進 Git**：Wi-Fi 與 MQTT 帳密存 NVS，首版可用 USB serial provisioning。
7. **不要用亂數產生任何數值**（分數、座標）。

## 06 · 硬體規格（沿用 Demo 實測值，不需更動）

| 項目 | 值 |
|---|---|
| 主控 | ESP32 DevKit V1 / ESP32-WROOM-32D |
| 感測 | 27mm Piezo 壓電片 + 100KΩ 放電電阻 + 100KΩ 串聯限流電阻 |
| ADC | GPIO34、12-bit（0~4095） |
| `HIT_THRESHOLD` | 500（可由平台下發 `config` 覆寫） |
| `SAMPLE_WINDOW` | 20 ms（窗內取最高 Peak） |
| `COOLDOWN_TIME` | 300 ms（防同一次撞擊餘震重複計數） |

> ⚠️ **正式場域前必補 Piezo 輸入過壓／負壓保護電路**。
> 若靶面加大或換材質，需重新量測各位置最低 Peak 再校調 `HIT_THRESHOLD`。

## 07 · 連通測試步驟

1. 用平台發的帳密連 broker `:8883`（TLS）→ 應連線成功
2. 發一則 retained `state`（`online:true`）→ 平台 `/admin/devices` 該設備轉為**在線**
3. 敲擊靶面 → 平台收到 `event`，`/admin/devices` 事件列表出現該 `messageId`
4. 平台下發 `self_test` command → 韌體回 `ack: completed`
5. 拔掉電源 → 平台於 90 秒內顯示**離線**（LWT 生效則更快）

## 08 · 對接檢查清單

- [ ] Topic 全部改為 `chito/v1/JIACHUN/{deviceId}/{channel}`
- [ ] Payload 帶齊 8 個信封欄位（特別是 `messageId` / `bootId` / `sequence`）
- [ ] 命中改送 `zone` + `peak`，**不送分數、不送 session**
- [ ] event/ack/state 用 QoS 1；state 設 retain；LWT 已設定
- [ ] 斷線佇列 + 重送（沿用原 messageId）
- [ ] command 驗 `expiresAt`、回 ack
- [ ] TLS 憑證驗證開啟、帳密存 NVS 不進 Git
- [ ] Piezo 保護電路已加

## 09 · 需向平台方索取（🔒 機密，私下提供，勿入 Git／前端／文件）

- **Broker 位址與 port**
- **該設備專屬 MQTT 帳號與密碼**（一台一組）
- **Broker CA 憑證**（供 TLS 驗證）
- **硬體 ID（deviceId）** —— 由平台在 `/admin/devices` 建立時指定

## 10 · 相關文件

- [ADR-0024 MQTT v1 裝置契約](decisions/0024-mqtt-v1-device-contract.md)
- [MQTT 設備管理完整化計畫](changes/2026-07-22-mqtt-device-integration-plan.md)
- 程式碼契約：`shared/mqtt/contracts.ts`、`server/mqtt/topic.ts`
