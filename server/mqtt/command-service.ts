// 🔌 設備指令發送（ADR-0024）
//
// 把後台控制（啟動/停用/LED/校準/重啟…）轉成 v1 command，
// 經新 gateway 發到 chito/v1/{fieldCode}/{deviceId}/command。
// 取代舊 mqttService（死碼、從未啟動）。

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { fields } from "@shared/schema";
import { buildTopic } from "./topic";
import { publishToDevice, getMqttStatus } from "./mqtt-client";
import { MQTT_SCHEMA_VERSION, commandDataSchema } from "@shared/mqtt/contracts";

export type CommandResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

/** 發送 v1 command 給單一設備；含連線、場域與指令合法性檢查 */
export async function sendDeviceCommand(
  fieldId: string,
  deviceId: string,
  rawData: unknown,
  ttlSec = 30,
): Promise<CommandResult> {
  const parsed = commandDataSchema.safeParse(rawData);
  if (!parsed.success) {
    return { ok: false, status: 400, message: "不支援的指令" };
  }
  if (!getMqttStatus().connected) {
    return {
      ok: false,
      status: 503,
      message: "MQTT 未連線，請先在「系統設定 → MQTT 設備」填入並啟用 broker",
    };
  }

  const rows = await db
    .select({ code: fields.code })
    .from(fields)
    .where(eq(fields.id, fieldId))
    .limit(1);
  const fieldCode = rows[0]?.code;
  if (!fieldCode) {
    return { ok: false, status: 400, message: "設備所屬場域無效" };
  }

  const now = Date.now();
  const payload = {
    schemaVersion: MQTT_SCHEMA_VERSION,
    messageId: randomUUID(),
    deviceId,
    sentAt: new Date(now).toISOString(),
    bootId: "server",
    sequence: 0,
    type: "command" as const,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlSec * 1000).toISOString(),
    data: parsed.data,
  };

  const ok = await publishToDevice(
    buildTopic(fieldCode, deviceId, "command"),
    payload,
    1,
    false,
  );
  return ok
    ? { ok: true }
    : { ok: false, status: 503, message: "指令發送失敗，請稍後再試" };
}
