// 🔌 MQTT v1 契約測試（ADR-0024）
//
// 契約是設備↔平台的單一真實來源，破口就是灌分破口：
//   - inboundMessageSchema 擋掉任何不合法上行（zone/peak/uuid/必填）
//   - commandDataSchema allowlist 擋掉任意下行指令字串
//   - buildHitSignatureBase 串法一旦漂移，HMAC 兩端算不出同一 base → 全部驗簽失敗
// 這裡把「合法必過、非法必擋、簽章基底格式凍結」全部釘死。

import { describe, it, expect } from "vitest";
import {
  inboundMessageSchema,
  commandDataSchema,
  buildHitSignatureBase,
  MQTT_SCHEMA_VERSION,
} from "../mqtt/contracts";

const MSG_ID = "11111111-1111-4111-8111-111111111111";

/** 合法命中訊息基準；各測試以覆寫欄位方式製造非法變體 */
function validHit(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: MQTT_SCHEMA_VERSION,
    messageId: MSG_ID,
    deviceId: "TARGET_001",
    sentAt: "2026-07-28T10:00:00.000Z",
    bootId: "boot-1",
    sequence: 5,
    type: "event",
    data: { event: "hit", zone: "center", peak: 2000 },
    ...overrides,
  };
}

describe("inboundMessageSchema — 上行契約", () => {
  it("合法 hit 事件通過", () => {
    expect(inboundMessageSchema.safeParse(validHit()).success).toBe(true);
  });

  it("合法 state 狀態通過", () => {
    const state = {
      schemaVersion: MQTT_SCHEMA_VERSION,
      messageId: MSG_ID,
      deviceId: "TARGET_001",
      sentAt: "2026-07-28T10:00:00.000Z",
      bootId: "boot-1",
      sequence: 0,
      type: "state",
      data: { online: true, firmwareVersion: "1.2.3", batteryLevel: 88 },
    };
    expect(inboundMessageSchema.safeParse(state).success).toBe(true);
  });

  it("非法 zone 被拒收", () => {
    const bad = validHit({ data: { event: "hit", zone: "bullseye", peak: 100 } });
    expect(inboundMessageSchema.safeParse(bad).success).toBe(false);
  });

  it("peak 超出 0~4095 被拒收", () => {
    const bad = validHit({ data: { event: "hit", zone: "center", peak: 5000 } });
    expect(inboundMessageSchema.safeParse(bad).success).toBe(false);
  });

  it("peak 為負數被拒收", () => {
    const bad = validHit({ data: { event: "hit", zone: "center", peak: -1 } });
    expect(inboundMessageSchema.safeParse(bad).success).toBe(false);
  });

  it("messageId 非 uuid 被拒收", () => {
    expect(inboundMessageSchema.safeParse(validHit({ messageId: "not-a-uuid" })).success).toBe(false);
  });

  it("缺少 deviceId 被拒收", () => {
    const bad = validHit();
    delete (bad as Record<string, unknown>).deviceId;
    expect(inboundMessageSchema.safeParse(bad).success).toBe(false);
  });

  it("schemaVersion 不符被拒收", () => {
    expect(inboundMessageSchema.safeParse(validHit({ schemaVersion: 2 })).success).toBe(false);
  });

  it("sig 為選填 — 帶合法 hex sig 仍通過", () => {
    const signed = validHit({ sig: "a".repeat(64) });
    expect(inboundMessageSchema.safeParse(signed).success).toBe(true);
  });

  it("sig 為選填 — 不帶 sig 也通過（過渡期相容）", () => {
    const parsed = inboundMessageSchema.safeParse(validHit());
    expect(parsed.success).toBe(true);
  });
});

describe("commandDataSchema — 下行指令 allowlist", () => {
  it("允許 start_session", () => {
    expect(commandDataSchema.safeParse({ command: "start_session" }).success).toBe(true);
  });

  it("允許 led 帶合法 mode", () => {
    expect(commandDataSchema.safeParse({ command: "led", mode: "solid", color: "green" }).success).toBe(true);
  });

  it("拒收未知指令字串（防任意指令注入）", () => {
    expect(commandDataSchema.safeParse({ command: "rm_rf" }).success).toBe(false);
    expect(commandDataSchema.safeParse({ command: "shutdown" }).success).toBe(false);
  });

  it("拒收 led 非法 mode", () => {
    expect(commandDataSchema.safeParse({ command: "led", mode: "disco" }).success).toBe(false);
  });
});

describe("buildHitSignatureBase — 簽章基底格式凍結", () => {
  it("格式為 deviceId|messageId|sentAt|zone|peak", () => {
    const base = buildHitSignatureBase({
      deviceId: "TARGET_001",
      messageId: MSG_ID,
      sentAt: "2026-07-28T10:00:00.000Z",
      zone: "center",
      peak: 2000,
    });
    expect(base).toBe(`TARGET_001|${MSG_ID}|2026-07-28T10:00:00.000Z|center|2000`);
  });

  it("不同 peak 產生不同基底（篡改即改變簽章）", () => {
    const common = { deviceId: "T1", messageId: MSG_ID, sentAt: "2026-07-28T10:00:00.000Z", zone: "center" };
    expect(buildHitSignatureBase({ ...common, peak: 2000 })).not.toBe(
      buildHitSignatureBase({ ...common, peak: 2001 }),
    );
  });
});
