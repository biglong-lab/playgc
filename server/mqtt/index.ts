// 🔌 MQTT v1 gateway 啟動入口（ADR-0024）
//
// ⚠️ 受 ADR-0023 單 worker 紅線約束：只允許單一進程啟動 gateway。
//    多 worker 各自訂閱會讓同一則命中被重複寫入。
//
// MQTT_ENABLED 未設為 true 時完全不啟動，不影響平台其他功能。

import {
  connectMqtt,
  disconnectMqtt,
  isMqttEnabled,
} from "./mqtt-client";
import { handleInboundMessage } from "./ingest";
import { startPresenceSweeper, stopPresenceSweeper } from "./presence-service";

export { getMqttStatus, isMqttEnabled } from "./mqtt-client";
export { setHitBroadcaster } from "./ingest";
export { publishToDevice } from "./mqtt-client";

/** 啟動 gateway；回傳是否實際啟用 */
export function initializeMqttV1(): boolean {
  if (!isMqttEnabled()) return false;
  const started = connectMqtt(handleInboundMessage);
  if (started) startPresenceSweeper();
  return started;
}

export async function shutdownMqttV1(): Promise<void> {
  stopPresenceSweeper();
  await disconnectMqtt();
}
