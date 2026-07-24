// 🔌 MQTT v1 連線層（ADR-0024）
//
// 職責：連線／TLS／指數退避重連／訂閱生命週期／優雅關閉。
// 業務邏輯不放這裡（收訊分流與驗證見 ingest.ts）。
//
// ⚠️ 紅線：受 ADR-0023 單 worker 拓樸約束 —— 只允許單一進程建立此連線，
//    多 worker 各自訂閱會讓同一則命中被重複寫入。

import mqtt, { type IClientOptions, type MqttClient } from "mqtt";
import { uplinkSubscriptions } from "./topic";
import type { ResolvedMqttConfig } from "./config";

export type MqttMessageHandler = (
  topic: string,
  payload: Buffer,
) => Promise<void> | void;

/** 固定 client id + 持久 session：斷線期間 broker 會保留 QoS 1 訊息 */
const SERVER_CLIENT_ID = "chito-server-v1";
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 60_000;

let client: MqttClient | null = null;
let handler: MqttMessageHandler | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
let lastConnectedAt: string | null = null;
let lastError: string | null = null;
let shuttingDown = false;
let currentConfig: ResolvedMqttConfig | null = null;

export interface MqttStatus {
  enabled: boolean;
  connected: boolean;
  brokerUrl: string | null;
  source: "database" | "env" | null;
  lastConnectedAt: string | null;
  lastError: string | null;
  reconnectAttempts: number;
}

export function getMqttStatus(): MqttStatus {
  return {
    enabled: currentConfig !== null,
    connected: client?.connected ?? false,
    brokerUrl: currentConfig?.brokerUrl ?? null,
    source: currentConfig?.source ?? null,
    lastConnectedAt,
    lastError,
    reconnectAttempts,
  };
}

function buildOptions(): IClientOptions {
  const options: IClientOptions = {
    clientId: SERVER_CLIENT_ID,
    clean: false,
    reconnectPeriod: 0, // 自行控制退避，不用內建固定間隔
    connectTimeout: 30_000,
    keepalive: 60,
  };
  if (currentConfig?.username) options.username = currentConfig.username;
  if (currentConfig?.password) options.password = currentConfig.password;
  if (currentConfig?.caCert) options.ca = [Buffer.from(currentConfig.caCert)];
  return options;
}

/** 指數退避 + jitter；永不放棄重連（現場斷網後必須能自己回來） */
function scheduleReconnect(): void {
  if (shuttingDown || reconnectTimer) return;
  const backoff = Math.min(
    RECONNECT_MIN_MS * 2 ** Math.min(reconnectAttempts, 6),
    RECONNECT_MAX_MS,
  );
  const delay = backoff + Math.floor(Math.random() * 1_000);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempts += 1;
    void openConnection();
  }, delay);
}

function subscribeUplinks(active: MqttClient): void {
  for (const topic of uplinkSubscriptions()) {
    active.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        lastError = `訂閱失敗 ${topic}: ${err.message}`;
        console.error("[mqtt] subscribe 失敗", topic, err.message);
      }
    });
  }
}

function attachHandlers(active: MqttClient): void {
  active.on("connect", () => {
    reconnectAttempts = 0;
    lastError = null;
    lastConnectedAt = new Date().toISOString();
    subscribeUplinks(active);
  });

  active.on("message", (topic, payload) => {
    void Promise.resolve(handler?.(topic, payload)).catch((e) => {
      console.error("[mqtt] 收訊處理失敗", topic, e);
    });
  });

  active.on("error", (err) => {
    lastError = err.message;
    console.error("[mqtt] 連線錯誤", err.message);
  });

  active.on("close", () => {
    if (!shuttingDown) scheduleReconnect();
  });
}

function openConnection(): void {
  const url = currentConfig?.brokerUrl;
  if (!url) {
    lastError = "缺少 broker 設定";
    return;
  }
  try {
    client?.removeAllListeners();
    client = mqtt.connect(url, buildOptions());
    attachHandlers(client);
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    console.error("[mqtt] 建立連線失敗", lastError);
    scheduleReconnect();
  }
}

/** 啟動 gateway；回傳是否已啟用（連線本身是非同步、失敗會自動重試） */
export function connectMqtt(
  config: ResolvedMqttConfig,
  messageHandler: MqttMessageHandler,
): boolean {
  currentConfig = config;
  handler = messageHandler;
  shuttingDown = false;
  openConnection();
  return true;
}

/** 下發指令／設定給設備；回傳是否成功送出 */
export function publishToDevice(
  topic: string,
  payload: unknown,
  qos: 0 | 1 = 1,
  retain = false,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!client?.connected) {
      resolve(false);
      return;
    }
    client.publish(topic, JSON.stringify(payload), { qos, retain }, (err) => {
      if (err) {
        console.error("[mqtt] publish 失敗", topic, err.message);
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

export async function disconnectMqtt(): Promise<void> {
  shuttingDown = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const active = client;
  client = null;
  handler = null;
  currentConfig = null;
  if (!active) return;
  await new Promise<void>((resolve) => active.end(false, {}, () => resolve()));
}
