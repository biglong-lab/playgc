// 🔌 MQTT v1 gateway 啟動入口（ADR-0024）
//
// ⚠️ 受 ADR-0023 單 worker 紅線約束：只允許單一進程啟動 gateway。
//    多 worker 各自訂閱會讓同一則命中被重複寫入。
//
// 連線設定來源：DB singleton（後台可改，優先）→ 環境變數 fallback。
// 兩者都沒有時完全不啟動，不影響平台其他功能。

import { connectMqtt, disconnectMqtt } from "./mqtt-client";
import { resolveMqttConfig } from "./config";
import { handleInboundMessage } from "./ingest";
import { startPresenceSweeper, stopPresenceSweeper } from "./presence-service";

export { getMqttStatus } from "./mqtt-client";
export { setHitBroadcaster } from "./ingest";
export { publishToDevice } from "./mqtt-client";
export { resolveMqttConfig } from "./config";

/** 啟動 gateway；依 DB 設定（優先）或環境變數連線。回傳是否實際啟用 */
export async function initializeMqttV1(): Promise<boolean> {
  const config = await resolveMqttConfig();
  if (!config) return false;
  const started = connectMqtt(config, handleInboundMessage);
  if (started) startPresenceSweeper();
  return started;
}

export async function shutdownMqttV1(): Promise<void> {
  stopPresenceSweeper();
  await disconnectMqtt();
}

/** 套用最新 broker 設定重連（後台改設定後呼叫）。回傳是否啟用 */
export async function reconnectMqttV1(): Promise<boolean> {
  await shutdownMqttV1();
  return initializeMqttV1();
}
