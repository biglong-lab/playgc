// 🔌 MQTT 連線設定解析（ADR-0024）
//
// 優先序：DB singleton（後台可改）→ 環境變數 fallback。
// 讓後台管理員能自訂 broker，而不必改 env 重新部署。

import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { mqttBrokerConfig } from "@shared/schema";

export interface ResolvedMqttConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  caCert?: string; // PEM 內容（非路徑）
  source: "database" | "env";
}

/**
 * 補上 broker URL 的 scheme。使用者常只填 host:port（如 mqttgo.io:1883），
 * mqtt.js 沒有 scheme 會連錯 → connack timeout。依 port 自動補：
 * 8883/8884 → mqtts（TLS）；其餘 → mqtt。
 */
export function normalizeBrokerUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (/^(mqtts?|wss?|tcp):\/\//i.test(u)) return u;
  const m = u.match(/:(\d+)\s*$/);
  const port = m ? parseInt(m[1], 10) : 1883;
  const scheme = port === 8883 || port === 8884 ? "mqtts" : "mqtt";
  return `${scheme}://${u}`;
}

/** 解析目前生效的 MQTT 連線設定；未啟用時回 null（gateway 不啟動） */
export async function resolveMqttConfig(): Promise<ResolvedMqttConfig | null> {
  // 1) DB singleton 優先
  try {
    const rows = await db
      .select()
      .from(mqttBrokerConfig)
      .where(eq(mqttBrokerConfig.id, "singleton"))
      .limit(1);
    const cfg = rows[0];
    if (cfg?.enabled && cfg.brokerUrl) {
      return {
        brokerUrl: normalizeBrokerUrl(cfg.brokerUrl),
        username: cfg.username ?? undefined,
        password: cfg.password ?? undefined,
        caCert: cfg.caCert ?? undefined,
        source: "database",
      };
    }
  } catch (e) {
    console.error("[mqtt-config] 讀取 DB 設定失敗，改用環境變數", e);
  }

  // 2) 環境變數 fallback
  if (process.env.MQTT_ENABLED === "true" && process.env.MQTT_BROKER_URL) {
    let caCert: string | undefined;
    if (process.env.MQTT_CA_PATH) {
      try {
        caCert = readFileSync(process.env.MQTT_CA_PATH, "utf8");
      } catch (e) {
        console.error("[mqtt-config] 讀取 CA 憑證失敗", e);
      }
    }
    return {
      brokerUrl: normalizeBrokerUrl(process.env.MQTT_BROKER_URL),
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
      caCert,
      source: "env",
    };
  }

  return null;
}
