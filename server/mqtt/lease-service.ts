// 🔌 裝置租約服務（ADR-0024）
//
// 「這一擊算誰的」唯一真實來源。設備只回報 zone/peak，
// 歸屬由此處的租約決定，因此租約的 userId 一律取登入者本人、不信任前端。
//
// 同一台設備同時只允許一筆 active 租約 —— 由 DB partial unique index
// (idx_device_binding_active) 保證，不靠應用層自律。

import { and, eq, lte } from "drizzle-orm";
import { db } from "../db";
import { arduinoDevices, deviceSessionBindings } from "@shared/schema";

const DEFAULT_TTL_MINUTES = 30;

export type AcquireFailure =
  | "device_not_found"
  | "device_not_ready"
  | "device_no_field"
  | "conflict";

export type AcquireResult =
  | { ok: true; leaseId: string; expiresAt: Date }
  | { ok: false; reason: AcquireFailure; heldBySession?: string | null };

/**
 * 回收逾時但仍標記 active 的租約。
 * 沒有這步，玩家離場沒按釋放時，該靶會被永久鎖死（unique index 擋住新租約）。
 */
export async function expireStaleLeases(deviceId?: string): Promise<void> {
  const conditions = [
    eq(deviceSessionBindings.status, "active"),
    lte(deviceSessionBindings.expiresAt, new Date()),
  ];
  if (deviceId) conditions.push(eq(deviceSessionBindings.deviceId, deviceId));

  await db
    .update(deviceSessionBindings)
    .set({ status: "expired", releasedAt: new Date() })
    .where(and(...conditions));
}

export async function getActiveLease(deviceId: string) {
  const rows = await db
    .select()
    .from(deviceSessionBindings)
    .where(
      and(
        eq(deviceSessionBindings.deviceId, deviceId),
        eq(deviceSessionBindings.status, "active"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function acquireLease(params: {
  deviceId: string;
  userId: string;
  sessionId?: string | null;
  pageId?: string | null;
  teamId?: string | null;
  ttlMinutes?: number;
}): Promise<AcquireResult> {
  const rows = await db
    .select()
    .from(arduinoDevices)
    .where(eq(arduinoDevices.deviceId, params.deviceId))
    .limit(1);

  const device = rows[0];
  if (!device) return { ok: false, reason: "device_not_found" };
  if (device.revokedAt || device.status === "maintenance") {
    return { ok: false, reason: "device_not_ready" };
  }
  if (!device.fieldId) return { ok: false, reason: "device_no_field" };

  await expireStaleLeases(params.deviceId);

  const ttl = params.ttlMinutes ?? DEFAULT_TTL_MINUTES;
  const expiresAt = new Date(Date.now() + ttl * 60_000);

  try {
    const inserted = await db
      .insert(deviceSessionBindings)
      .values({
        deviceId: params.deviceId,
        fieldId: device.fieldId,
        sessionId: params.sessionId ?? null,
        pageId: params.pageId ?? null,
        userId: params.userId,
        teamId: params.teamId ?? null,
        status: "active",
        expiresAt,
      })
      .returning({ id: deviceSessionBindings.id });

    return { ok: true, leaseId: inserted[0].id, expiresAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!message.includes("duplicate key")) throw e;
    const held = await getActiveLease(params.deviceId);
    return { ok: false, reason: "conflict", heldBySession: held?.sessionId ?? null };
  }
}

/** 只能釋放自己持有的租約，避免玩家互相踢掉對方 */
export async function releaseLease(
  deviceId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .update(deviceSessionBindings)
    .set({ status: "released", releasedAt: new Date() })
    .where(
      and(
        eq(deviceSessionBindings.deviceId, deviceId),
        eq(deviceSessionBindings.userId, userId),
        eq(deviceSessionBindings.status, "active"),
      ),
    )
    .returning({ id: deviceSessionBindings.id });
  return result.length > 0;
}
