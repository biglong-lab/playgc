// 裝置 (Devices) - Arduino 裝置、裝置日誌、射擊記錄
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  decimal,
  index,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { gameSessions } from "./sessions";

// ============================================================================
// Arduino Devices table - IoT device registry
// ============================================================================
export const arduinoDevices = pgTable("arduino_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id", { length: 50 }).unique(), // Hardware device unique ID (e.g., TARGET_001)
  deviceName: varchar("device_name", { length: 100 }).notNull(),
  deviceType: varchar("device_type", { length: 50 }).default("shooting_target"), // shooting_target, sensor, trigger, display, controller
  mqttTopic: varchar("mqtt_topic", { length: 200 }).unique(),
  location: varchar("location", { length: 100 }), // Human-readable location description
  locationLat: decimal("location_lat", { precision: 10, scale: 8 }),
  locationLng: decimal("location_lng", { precision: 11, scale: 8 }),
  status: varchar("status", { length: 20 }).default("offline"), // online, offline, error, maintenance
  lastHeartbeat: timestamp("last_heartbeat"),
  batteryLevel: integer("battery_level"), // Percentage 0-100
  firmwareVersion: varchar("firmware_version", { length: 20 }),
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6 address
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// Device Logs table - Device activity and error logs
// ============================================================================
export const deviceLogs = pgTable(
  "device_logs",
  {
    id: serial("id").primaryKey(),
    deviceId: varchar("device_id", { length: 50 }).notNull(), // References arduinoDevices.deviceId
    logType: varchar("log_type", { length: 20 }).notNull(), // info, warning, error, debug
    message: text("message"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_device_logs_device").on(table.deviceId, table.createdAt),
  ]
);

// ============================================================================
// Shooting Records table - Shooting target hits
// ============================================================================
export const shootingRecords = pgTable(
  "shooting_records",
  {
    id: serial("id").primaryKey(),
    sessionId: varchar("session_id").references(() => gameSessions.id),
    deviceId: varchar("device_id"), // References arduinoDevices.deviceId (hardware ID)
    gameSessionId: integer("game_session_id"), // Optional legacy field
    userId: varchar("user_id").references(() => users.id),
    targetZone: varchar("target_zone", { length: 20 }), // center, inner, outer
    hitScore: integer("hit_score"),
    hitPosition: varchar("hit_position", { length: 50 }), // bullseye, inner, outer
    score: integer("score"), // Alternative score field for compatibility
    hitTimestamp: timestamp("hit_timestamp").defaultNow(),
    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => [
    index("idx_shooting_records_session").on(table.sessionId),
    index("idx_shooting_records_device").on(table.deviceId),
    index("idx_shooting_records_timestamp").on(table.hitTimestamp),
  ]
);

// Arduino Device schemas
export const insertArduinoDeviceSchema = createInsertSchema(arduinoDevices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertArduinoDevice = z.infer<typeof insertArduinoDeviceSchema>;
export type ArduinoDevice = typeof arduinoDevices.$inferSelect;

// Device Log schemas
export const insertDeviceLogSchema = createInsertSchema(deviceLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertDeviceLog = z.infer<typeof insertDeviceLogSchema>;
export type DeviceLog = typeof deviceLogs.$inferSelect;

// Shooting Record schemas
export const insertShootingRecordSchema = createInsertSchema(shootingRecords).omit({
  id: true,
  timestamp: true,
});
export type InsertShootingRecord = z.infer<typeof insertShootingRecordSchema>;
export type ShootingRecord = typeof shootingRecords.$inferSelect;

