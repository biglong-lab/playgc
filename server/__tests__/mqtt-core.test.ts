// 🔌 MQTT v1 核心測試（ADR-0024）
//
// 兩個安全命脈：
//   1. topic 建構／解析 — 段格式擋 wildcard 注入與跨場域越權，非 v1 一律拒收
//   2. HMAC 命中簽章端到端 — 設備用 device_secret 簽，server 驗；
//      錯密鑰 / 篡改 peak / 空簽都必須擋下（即使公用明文 broker 也無法偽造命中）

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  buildTopic,
  parseTopic,
  uplinkSubscriptions,
  UPLINK_CHANNELS,
} from "../mqtt/topic";
import { buildHitSignatureBase } from "@shared/mqtt/contracts";
import { verifyHmacSignature } from "../lib/webhook-signature";
import { normalizeBrokerUrl } from "../mqtt/broker-url";

describe("MQTT topic — 建構與解析", () => {
  it("buildTopic 產生 v1 格式且 fieldCode 大寫", () => {
    expect(buildTopic("jiachun", "TARGET_001", "event")).toBe(
      "chito/v1/JIACHUN/TARGET_001/event",
    );
  });

  it("parseTopic 正確解析合法 v1 topic", () => {
    expect(parseTopic("chito/v1/JIACHUN/TARGET_001/event")).toEqual({
      fieldCode: "JIACHUN",
      deviceId: "TARGET_001",
      channel: "event",
    });
  });

  it("拒收舊 jiachun/* 格式（段數不符 → null）", () => {
    expect(parseTopic("jiachun/TARGET_001/hit")).toBeNull();
  });

  it("拒收非 v1 版本前綴", () => {
    expect(parseTopic("chito/v2/JIACHUN/TARGET_001/event")).toBeNull();
  });

  it("擋 wildcard 注入（+ / #）", () => {
    expect(parseTopic("chito/v1/JIACHUN/+/event")).toBeNull();
    expect(parseTopic("chito/v1/JIACHUN/TARGET_001/#")).toBeNull();
  });

  it("拒收段數錯誤的 topic", () => {
    expect(parseTopic("chito/v1/JIACHUN/TARGET_001")).toBeNull();
    expect(parseTopic("chito/v1/JIACHUN/TARGET_001/event/extra")).toBeNull();
  });

  it("拒收非上下行 channel", () => {
    expect(parseTopic("chito/v1/JIACHUN/TARGET_001/hack")).toBeNull();
  });

  it("buildTopic 對含斜線／wildcard 的 deviceId 直接 throw", () => {
    expect(() => buildTopic("JIACHUN", "TARGET/001", "event")).toThrow();
    expect(() => buildTopic("JIACHUN", "TARGET+", "event")).toThrow();
  });

  it("uplinkSubscriptions 剛好 4 條（state/telemetry/event/ack）", () => {
    const subs = uplinkSubscriptions();
    expect(subs).toHaveLength(4);
    expect(subs).toHaveLength(UPLINK_CHANNELS.length);
    expect(subs).toContain("chito/v1/+/+/event");
  });
});

describe("HMAC 命中簽章 — 端到端", () => {
  const secret = "device-secret-0123456789abcdef";
  const hitInput = {
    deviceId: "TARGET_001",
    messageId: "11111111-1111-4111-8111-111111111111",
    sentAt: "2026-07-28T10:00:00.000Z",
    zone: "center",
    peak: 2000,
  };

  function sign(base: string, key: string): string {
    return crypto.createHmac("sha256", key).update(base).digest("hex");
  }

  it("正確密鑰簽章通過驗證", () => {
    const base = buildHitSignatureBase(hitInput);
    const sig = sign(base, secret);
    expect(verifyHmacSignature(base, sig, secret, "hex")).toBe(true);
  });

  it("錯誤密鑰被擋（公用 broker 也無法偽造）", () => {
    const base = buildHitSignatureBase(hitInput);
    const sig = sign(base, secret);
    expect(verifyHmacSignature(base, sig, "wrong-secret", "hex")).toBe(false);
  });

  it("篡改 peak 後簽章失效", () => {
    const base = buildHitSignatureBase(hitInput);
    const sig = sign(base, secret);
    const tamperedBase = buildHitSignatureBase({ ...hitInput, peak: 4095 });
    expect(verifyHmacSignature(tamperedBase, sig, secret, "hex")).toBe(false);
  });

  it("空簽 / 未帶 sig 一律擋", () => {
    const base = buildHitSignatureBase(hitInput);
    expect(verifyHmacSignature(base, "", secret, "hex")).toBe(false);
    expect(verifyHmacSignature(base, undefined, secret, "hex")).toBe(false);
  });
});

// 🐛 2026-08-09 守門：broker URL scheme 推斷
//
// 生產靜默重連迴圈的真根因 —— 後台填 HiveMQ Cloud 的 `host:8884/mqtt`，
// 舊版 ① port 比對要求結尾（有 /mqtt 就比不到 → 退回 1883）
//      ② 8884 補成 mqtts（實際是 WebSocket/TLS）
// 結果補出明文 mqtt:// 打 wss 埠 → 永遠沒有 CONNACK → close 無 error → 靜默。
// 實測佐證：mqtt://…:8884/mqtt 靜默失敗；wss://…:8884/mqtt 與
// mqtts://…:8883 皆連線成功。
describe("broker URL 正規化 — scheme 推斷", () => {
  const PROD = "71171d324b14453d86b6672af796c974.s1.eu.hivemq.cloud:8884/mqtt";

  it("🐛 生產實例：HiveMQ 8884 + /mqtt 路徑 → wss（絕不可是明文 mqtt://）", () => {
    const got = normalizeBrokerUrl(PROD);
    expect(got).toBe(`wss://${PROD}`);
    expect(got.startsWith("mqtt://")).toBe(false); // 迴歸點：明文打 TLS 埠
  });

  it("8884 不帶路徑 → wss", () => {
    expect(normalizeBrokerUrl("foo.hivemq.cloud:8884")).toBe(
      "wss://foo.hivemq.cloud:8884",
    );
  });

  it("8883 → mqtts（原生 MQTT over TLS）", () => {
    expect(normalizeBrokerUrl("foo.hivemq.cloud:8883")).toBe(
      "mqtts://foo.hivemq.cloud:8883",
    );
  });

  it("8883 帶路徑仍是 mqtts（路徑不該把原生 TLS 誤判成 ws）", () => {
    expect(normalizeBrokerUrl("foo.hivemq.cloud:8883/x")).toBe(
      "mqtts://foo.hivemq.cloud:8883/x",
    );
  });

  it("1883 → mqtt（明文）", () => {
    expect(normalizeBrokerUrl("mqttgo.io:1883")).toBe("mqtt://mqttgo.io:1883");
  });

  it("8000 / 8080 → ws", () => {
    expect(normalizeBrokerUrl("h:8000/mqtt")).toBe("ws://h:8000/mqtt");
    expect(normalizeBrokerUrl("h:8080")).toBe("ws://h:8080");
  });

  it("已帶 scheme 者原樣不動（含 wss / mqtts / tcp）", () => {
    for (const u of [
      "wss://h:8884/mqtt",
      "mqtts://h:8883",
      "mqtt://h:1883",
      "tcp://h:1883",
    ]) {
      expect(normalizeBrokerUrl(u)).toBe(u);
    }
  });

  it("無 port → 預設明文 1883 行為", () => {
    expect(normalizeBrokerUrl("broker.local")).toBe("mqtt://broker.local");
  });
});
