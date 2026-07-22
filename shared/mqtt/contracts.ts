// 🔌 MQTT v1 裝置通訊契約（2026-07-23 凍結，見 ADR-0024）
//
// 硬體設備（ESP32 打擊靶等）與平台之間的訊息格式，前後端共用：
// server 收訊驗證、admin UI 型別、測試 simulator 都從這裡取單一真實來源。
//
// 核心設計原則：
//   1. 設備只回報「觀測到什麼」（zone / peak），不回報分數，也不回報是誰在打
//   2. 分數由 server 依遊戲設定計算；歸屬由 server 端 device lease 決定（不信任設備）
//   3. messageId 用於冪等去重 —— QoS 1 保證「至少一次」，一定會有重送
//   4. bootId + sequence 用於偵測訊息遺漏與設備重開機

import { z } from "zod";

/** 契約版本；破壞性變更必須進版並改 topic 前綴 */
export const MQTT_SCHEMA_VERSION = 1;

/** 所有訊息共通的信封欄位 */
const envelopeBase = z.object({
  schemaVersion: z.literal(MQTT_SCHEMA_VERSION),
  messageId: z.string().uuid(),
  deviceId: z.string().min(1).max(50),
  sentAt: z.string().datetime(),
  bootId: z.string().min(1).max(64),
  sequence: z.number().int().nonnegative(),
});

// ── 上行：state（設備狀態；LWT 遺囑也發到此 channel）──
export const deviceStateSchema = envelopeBase.extend({
  type: z.literal("state"),
  data: z.object({
    online: z.boolean(),
    firmwareVersion: z.string().max(20).optional(),
    batteryLevel: z.number().int().min(0).max(100).optional(),
    rssi: z.number().int().optional(),
    uptimeSec: z.number().int().nonnegative().optional(),
    error: z.string().max(200).optional(),
  }),
});

/** 命中區域；分數對應由 server 端遊戲設定決定，不寫死在韌體 */
export const hitZoneSchema = z.enum(["center", "inner", "outer"]);

// ── 上行：event（不可遺失的業務事件）──
export const deviceEventSchema = envelopeBase.extend({
  type: z.literal("event"),
  data: z.discriminatedUnion("event", [
    z.object({
      event: z.literal("hit"),
      zone: hitZoneSchema,
      // 12-bit ADC 峰值（0~4095），供稽核與門檻校調用
      peak: z.number().int().min(0).max(4095),
    }),
    z.object({
      event: z.literal("trigger"),
      channel: z.string().max(20),
    }),
  ]),
});

// ── 上行：telemetry（高頻、允許遺失）──
export const deviceTelemetrySchema = envelopeBase.extend({
  type: z.literal("telemetry"),
  data: z.record(z.string(), z.number()),
});

// ── 上行：ack（指令回執）──
export const deviceAckSchema = envelopeBase.extend({
  type: z.literal("ack"),
  data: z.object({
    commandId: z.string().uuid(),
    status: z.enum(["accepted", "completed", "failed"]),
    completedAt: z.string().datetime().optional(),
    errorCode: z.string().max(40).optional(),
    message: z.string().max(200).optional(),
  }),
});

// ── 下行：command（allowlist，禁止任意字串）──
export const commandDataSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("start_session") }),
  z.object({ command: z.literal("end_session") }),
  z.object({ command: z.literal("reset_counter") }),
  z.object({ command: z.literal("calibrate") }),
  z.object({ command: z.literal("reboot") }),
  z.object({ command: z.literal("self_test") }),
  z.object({
    command: z.literal("led"),
    mode: z.enum(["solid", "blink", "pulse", "rainbow", "off"]),
    color: z
      .enum(["red", "green", "blue", "yellow", "purple", "cyan", "white"])
      .optional(),
    brightness: z.number().int().min(0).max(255).optional(),
    speedMs: z.number().int().min(50).max(5000).optional(),
  }),
]);

export const deviceCommandSchema = envelopeBase.extend({
  type: z.literal("command"),
  issuedAt: z.string().datetime(),
  /** 逾期不執行，避免斷線重連後補收到的舊指令被誤觸發 */
  expiresAt: z.string().datetime(),
  data: commandDataSchema,
});

// ── 下行：config（desired；設備以 state/config 回報 reported）──
export const deviceConfigSchema = envelopeBase.extend({
  type: z.literal("config"),
  data: z.object({
    hitThreshold: z.number().int().min(0).max(4095).optional(),
    sampleWindowMs: z.number().int().min(1).max(1000).optional(),
    cooldownMs: z.number().int().min(0).max(10000).optional(),
    heartbeatSec: z.number().int().min(5).max(300).optional(),
  }),
});

/** server 端收訊統一入口：任何不符者一律丟棄並記錄 */
export const inboundMessageSchema = z.discriminatedUnion("type", [
  deviceStateSchema,
  deviceEventSchema,
  deviceTelemetrySchema,
  deviceAckSchema,
]);

export type DeviceState = z.infer<typeof deviceStateSchema>;
export type DeviceEvent = z.infer<typeof deviceEventSchema>;
export type DeviceTelemetry = z.infer<typeof deviceTelemetrySchema>;
export type DeviceAck = z.infer<typeof deviceAckSchema>;
export type DeviceCommand = z.infer<typeof deviceCommandSchema>;
export type DeviceConfig = z.infer<typeof deviceConfigSchema>;
export type InboundMessage = z.infer<typeof inboundMessageSchema>;
export type HitZone = z.infer<typeof hitZoneSchema>;
export type CommandData = z.infer<typeof commandDataSchema>;
