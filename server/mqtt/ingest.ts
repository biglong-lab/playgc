// 🔌 MQTT v1 收訊處理（ADR-0024）
//
// 三道防線，缺一不可：
//   1. 契約驗證：非 v1 topic、payload 不合 zod、deviceId 與 topic 不符 → 一律丟棄
//   2. 冪等去重：QoS 1 必定重送，以設備的 messageId 寫入 event_id（DB unique 擋重複計分）
//   3. 歸屬與計分由 server 決定：設備只送 zone/peak，
//      「算誰的」查 device_session_bindings 租約，「算幾分」用場域規則 —— 都不信任設備自報

import { and, eq, gt } from "drizzle-orm";
import { db } from "../db";
import {
  arduinoDevices,
  deviceSessionBindings,
  fields,
  shootingRecords,
} from "@shared/schema";
import { inboundMessageSchema, type HitZone } from "@shared/mqtt/contracts";
import { parseTopic } from "./topic";

/** 命中區域對應分數（server 權威；未來可由關卡 config 覆寫） */
const ZONE_SCORES: Record<HitZone, number> = {
  center: 100,
  inner: 50,
  outer: 25,
};

export type HitBroadcaster = (sessionId: string, record: unknown) => void;

let broadcastHit: HitBroadcaster | null = null;

/** 由上層注入 WebSocket 廣播，避免與 routes 循環相依 */
export function setHitBroadcaster(fn: HitBroadcaster): void {
  broadcastHit = fn;
}

function safeJsonParse(payload: Buffer): unknown {
  try {
    return JSON.parse(payload.toString("utf8"));
  } catch {
    return null;
  }
}

/** 查設備，並確認它確實屬於 topic 宣稱的場域（防跨場域偽造） */
async function findDevice(fieldCode: string, deviceId: string) {
  const rows = await db
    .select({ device: arduinoDevices, fieldCode: fields.code })
    .from(arduinoDevices)
    .innerJoin(fields, eq(fields.id, arduinoDevices.fieldId))
    .where(eq(arduinoDevices.deviceId, deviceId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.fieldCode?.toUpperCase() !== fieldCode) return null;
  if (row.device.revokedAt) return null;
  return row.device;
}

/** 取得該設備目前有效的租約（決定這一擊算誰的） */
async function findActiveLease(deviceId: string) {
  const rows = await db
    .select()
    .from(deviceSessionBindings)
    .where(
      and(
        eq(deviceSessionBindings.deviceId, deviceId),
        eq(deviceSessionBindings.status, "active"),
        gt(deviceSessionBindings.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function handleStateMessage(
  deviceId: string,
  data: { online: boolean; firmwareVersion?: string; batteryLevel?: number },
): Promise<void> {
  await db
    .update(arduinoDevices)
    .set({
      status: data.online ? "online" : "offline",
      lastHeartbeat: new Date(),
      ...(data.firmwareVersion ? { firmwareVersion: data.firmwareVersion } : {}),
      ...(typeof data.batteryLevel === "number"
        ? { batteryLevel: data.batteryLevel }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(arduinoDevices.deviceId, deviceId));
}

async function handleHitEvent(
  deviceId: string,
  messageId: string,
  zone: HitZone,
): Promise<void> {
  const lease = await findActiveLease(deviceId);
  if (!lease) return; // 靶未被任何關卡租用 → 不計分（避免無主命中污染資料）

  const score = ZONE_SCORES[zone];
  try {
    await db.insert(shootingRecords).values({
      eventId: messageId, // DB partial unique 擋 QoS 1 重送
      sessionId: lease.sessionId,
      deviceId,
      userId: lease.userId,
      targetZone: zone,
      hitScore: score,
      score,
      hitTimestamp: new Date(),
    });
  } catch (e) {
    // unique 衝突 = 同一則命中重送，屬正常情況，直接忽略不重複計分
    const message = e instanceof Error ? e.message : String(e);
    if (!message.includes("duplicate key")) {
      console.error("[mqtt-ingest] 寫入命中失敗", deviceId, message);
    }
    return;
  }

  if (lease.sessionId && broadcastHit) {
    broadcastHit(lease.sessionId, {
      deviceId,
      eventId: messageId,
      targetZone: zone,
      hitScore: score,
      userId: lease.userId,
      hitTimestamp: new Date().toISOString(),
    });
  }
}

/** MQTT 收訊統一入口；任何不合契約者靜默丟棄並記錄 */
export async function handleInboundMessage(
  topic: string,
  payload: Buffer,
): Promise<void> {
  const parsed = parseTopic(topic);
  if (!parsed) return;

  const json = safeJsonParse(payload);
  if (!json) return;

  const result = inboundMessageSchema.safeParse(json);
  if (!result.success) {
    console.error("[mqtt-ingest] payload 不符契約", topic);
    return;
  }

  const message = result.data;
  // topic 與 payload 的 deviceId 必須一致，否則視為偽造
  if (message.deviceId !== parsed.deviceId) return;

  const device = await findDevice(parsed.fieldCode, parsed.deviceId);
  if (!device) return;

  if (message.type === "state") {
    await handleStateMessage(parsed.deviceId, message.data);
    return;
  }

  if (message.type === "event" && message.data.event === "hit") {
    await handleHitEvent(parsed.deviceId, message.messageId, message.data.zone);
  }
  // telemetry / ack：MVP 階段暫不處理，契約已預留
}
