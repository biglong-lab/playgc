// 🔌 MQTT Broker 連線設定 schema（2026-07-23、ADR-0024）
//
// 用途：讓後台管理員自訂 MQTT broker（代理商/位址/帳密），不必改 env 重新部署。
// 表設計：singleton（永遠只有一筆，id='singleton'），仿 line_login_config。
// 連線優先序：此表 enabled=true 時用此設定；否則 fallback 到 MQTT_* 環境變數。
//
// ⚠️ 這是平台級基礎設施設定，影響全平台的裝置 MQTT 連線。
import { pgTable, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const mqttBrokerConfig = pgTable("mqtt_broker_config", {
  id: varchar("id", { length: 32 }).primaryKey(), // 固定 "singleton"
  brokerUrl: text("broker_url"), // 例：mqtts://xxx.hivemq.cloud:8883 或 mqtt://mqttgo.io:1883
  username: text("username"),
  password: text("password"), // 僅後端使用，GET API 不回傳明文
  caCert: text("ca_cert"), // TLS 自訂 CA（PEM）；公信 CA 可留空
  enabled: boolean("enabled").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedByAdminId: varchar("updated_by_admin_id"),
});

export type MqttBrokerConfig = typeof mqttBrokerConfig.$inferSelect;
