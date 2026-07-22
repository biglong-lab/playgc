// 🔌 MQTT v1 Topic 建構與解析（見 ADR-0024）
//
// 格式：chito/v1/{fieldCode}/{deviceId}/{channel}
//   例：chito/v1/JIACHUN/TARGET_001/event
//
// 用 fieldCode（JIACHUN）而非 fieldId(UUID)：短、可讀、韌體好燒，
// 且與既有 LINE webhook 對接慣例一致。隔離靠 broker ACL，不靠 topic 難猜。
//
// 任何非 v1 格式（含舊的 jiachun/*）一律拒絕，避免協定漂移。

export const MQTT_TOPIC_NAMESPACE = "chito";
export const MQTT_TOPIC_VERSION = "v1";
export const MQTT_TOPIC_PREFIX = `${MQTT_TOPIC_NAMESPACE}/${MQTT_TOPIC_VERSION}`;

/** 設備 → server */
export const UPLINK_CHANNELS = ["state", "telemetry", "event", "ack"] as const;
/** server → 設備 */
export const DOWNLINK_CHANNELS = ["command", "config"] as const;

export type UplinkChannel = (typeof UPLINK_CHANNELS)[number];
export type DownlinkChannel = (typeof DOWNLINK_CHANNELS)[number];
export type MqttChannel = UplinkChannel | DownlinkChannel;

/** topic 每段只允許英數與 - _，避免 wildcard 注入與跨場域越權 */
const SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,50}$/;

function assertSegment(value: string, label: string): void {
  if (!SEGMENT_PATTERN.test(value)) {
    throw new Error(`不合法的 ${label}：${value}`);
  }
}

export function isUplinkChannel(value: string): value is UplinkChannel {
  return (UPLINK_CHANNELS as readonly string[]).includes(value);
}

export function isMqttChannel(value: string): value is MqttChannel {
  return (
    isUplinkChannel(value) ||
    (DOWNLINK_CHANNELS as readonly string[]).includes(value)
  );
}

/** 由 server 產生 topic，管理員與設備都不可自由輸入 */
export function buildTopic(
  fieldCode: string,
  deviceId: string,
  channel: MqttChannel,
): string {
  assertSegment(fieldCode, "fieldCode");
  assertSegment(deviceId, "deviceId");
  return `${MQTT_TOPIC_PREFIX}/${fieldCode.toUpperCase()}/${deviceId}/${channel}`;
}

export interface ParsedTopic {
  fieldCode: string;
  deviceId: string;
  channel: MqttChannel;
}

/** 解析收到的 topic；非 v1 或格式錯誤回 null（呼叫端須丟棄該訊息） */
export function parseTopic(topic: string): ParsedTopic | null {
  const parts = topic.split("/");
  if (parts.length !== 5) return null;

  const [namespace, version, fieldCode, deviceId, channel] = parts;
  if (namespace !== MQTT_TOPIC_NAMESPACE || version !== MQTT_TOPIC_VERSION) {
    return null;
  }
  if (!SEGMENT_PATTERN.test(fieldCode) || !SEGMENT_PATTERN.test(deviceId)) {
    return null;
  }
  if (!isMqttChannel(channel)) return null;

  return { fieldCode: fieldCode.toUpperCase(), deviceId, channel };
}

/** server 啟動時的訂閱清單（跨場域 wildcard，僅 server principal 可用） */
export function uplinkSubscriptions(): string[] {
  return UPLINK_CHANNELS.map((channel) => `${MQTT_TOPIC_PREFIX}/+/+/${channel}`);
}

/** 單一設備的 ACL 樣板（provisioning 時寫入 broker） */
export function deviceAclPatterns(fieldCode: string, deviceId: string) {
  assertSegment(fieldCode, "fieldCode");
  assertSegment(deviceId, "deviceId");
  const base = `${MQTT_TOPIC_PREFIX}/${fieldCode.toUpperCase()}/${deviceId}`;
  return {
    publish: UPLINK_CHANNELS.map((c) => `${base}/${c}`),
    subscribe: DOWNLINK_CHANNELS.map((c) => `${base}/${c}`),
  };
}
