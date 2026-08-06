// 🎯 MQTT 模擬設備端到端 — ingest 全鏈真 DB 驗證（2026-08-06）
//
// 背景（CHITO c0428790）：v1 gateway 已部署但硬體一直沒上線，
// 「軟體鏈到底通不通」只能猜。本檔用假扮靶機的 payload 直接餵
// handleInboundMessage，驗證「契約 → 場域比對 → 租約歸屬 → 計分 →
// shooting_records 落庫 → QoS1 重送去重」整條鏈 —— 不需要 broker、
// 不需要硬體。硬體實測當天若有問題，就能確定是韌體/網路層。
//
// 既有 mqtt-core.test.ts 只測 topic/簽章純函式；本檔補 DB 整合層。

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID, createHmac } from "node:crypto";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const FIELD = "__mqttsim_field__";
const FIELD_CODE = "MQTTSIM";
const DEVICE = "SIM_TARGET_01";
const DEVICE_ROW = "__mqttsim_device__";
const USER = "__mqttsim_user__";
const GAME = "__mqttsim_game__";
const SESSION = "__mqttsim_session__";

type PgPool = import("pg").Pool;
let pool: PgPool;
let closePool: () => Promise<void>;
let handleInboundMessage: (topic: string, payload: Buffer) => Promise<void>;

function hitPayload(overrides: Partial<Record<string, unknown>> = {}, secret?: string) {
  const base: Record<string, unknown> = {
    schemaVersion: 1, // ⚠️ 數字不是字串 — 契約 z.literal(1)
    messageId: randomUUID(),
    deviceId: DEVICE,
    sentAt: new Date().toISOString(),
    bootId: "boot-1",
    sequence: 1,
    type: "event",
    data: { event: "hit", zone: "center", peak: 3000 },
    ...overrides,
  };
  if (secret) {
    const d = base.data as { zone: string; peak: number };
    const sigBase = `${base.deviceId}|${base.messageId}|${base.sentAt}|${d.zone}|${d.peak}`;
    base.sig = createHmac("sha256", secret).update(sigBase).digest("hex");
  }
  return Buffer.from(JSON.stringify(base));
}

const TOPIC = `chito/v1/${FIELD_CODE}/${DEVICE}/event`;

async function recordCount(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM shooting_records WHERE device_id=$1`,
    [DEVICE],
  );
  return rows[0].n;
}

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM shooting_records WHERE device_id=$1`, [DEVICE]);
  await pool.query(`DELETE FROM device_session_bindings WHERE device_id=$1`, [DEVICE]);
  await pool.query(`DELETE FROM arduino_devices WHERE id=$1`, [DEVICE_ROW]);
  await pool.query(`DELETE FROM game_sessions WHERE id=$1`, [SESSION]);
  await pool.query(`DELETE FROM games WHERE id=$1`, [GAME]);
  await pool.query(`DELETE FROM users WHERE id=$1`, [USER]);
  await pool.query(`DELETE FROM fields WHERE id=$1`, [FIELD]);
}

describe.skipIf(!HAS_DB)("MQTT 模擬設備 → 計分落庫全鏈", () => {
  beforeAll(async () => {
    const dbMod = await import("../db");
    pool = dbMod.pool;
    closePool = dbMod.closePool;
    ({ handleInboundMessage } = await import("../mqtt/ingest"));

    await cleanup();
    await pool.query(`INSERT INTO fields (id,name,code) VALUES ($1,'MQTT模擬場域',$2)`, [FIELD, FIELD_CODE]);
    await pool.query(`INSERT INTO users (id,email) VALUES ($1,'mqttsim@test.local')`, [USER]);
    await pool.query(
      `INSERT INTO games (id,title,field_id,status) VALUES ($1,'模擬射擊',$2,'published')`,
      [GAME, FIELD],
    );
    await pool.query(
      `INSERT INTO game_sessions (id,game_id,team_name,status) VALUES ($1,$2,'模擬','playing')`,
      [SESSION, GAME],
    );
    await pool.query(
      `INSERT INTO arduino_devices (id,device_id,device_name,device_type,field_id,status)
       VALUES ($1,$2,'模擬靶機','shooting_target',$3,'online')`,
      [DEVICE_ROW, DEVICE, FIELD],
    );
    // 有效租約：這一靶目前屬於 SESSION / USER
    await pool.query(
      `INSERT INTO device_session_bindings (device_id,session_id,user_id,field_id,status,expires_at)
       VALUES ($1,$2,$3,$4,'active', now()+interval '10 minutes')`,
      [DEVICE, SESSION, USER, FIELD],
    );
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await cleanup();
    await closePool();
  });

  it("✅ 正常命中 → 寫入 shooting_records，歸屬租約的 session/user、分數由 server 算", async () => {
    await handleInboundMessage(TOPIC, hitPayload());
    const { rows } = await pool.query(
      `SELECT session_id, user_id, target_zone, hit_score FROM shooting_records WHERE device_id=$1`,
      [DEVICE],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].session_id).toBe(SESSION);
    expect(rows[0].user_id).toBe(USER);
    expect(rows[0].target_zone).toBe("center");
    expect(rows[0].hit_score).toBeGreaterThan(0); // 分數是 server 的 ZONE_SCORES，不信任設備
  });

  it("🔁 QoS1 重送（同 messageId 送兩次）→ 只計一次分", async () => {
    const payload = hitPayload();
    const before = await recordCount();
    await handleInboundMessage(TOPIC, payload);
    await handleInboundMessage(TOPIC, payload); // 模擬 broker 重送
    expect(await recordCount()).toBe(before + 1);
  });

  it("🛡️ 跨場域偽造（topic 場域與設備歸屬不符）→ 丟棄", async () => {
    const before = await recordCount();
    await handleInboundMessage(`chito/v1/JIACHUN/${DEVICE}/event`, hitPayload());
    expect(await recordCount()).toBe(before);
  });

  it("🛡️ payload 的 deviceId 與 topic 不符 → 丟棄", async () => {
    const before = await recordCount();
    await handleInboundMessage(TOPIC, hitPayload({ deviceId: "OTHER_DEVICE" }));
    expect(await recordCount()).toBe(before);
  });

  it("🛡️ 契約不符（zone 亂填）→ 丟棄", async () => {
    const before = await recordCount();
    await handleInboundMessage(
      TOPIC,
      hitPayload({ data: { event: "hit", zone: "bullseye", peak: 100 } }),
    );
    expect(await recordCount()).toBe(before);
  });

  it("🛡️ 舊版 topic（jiachun/*）→ 丟棄", async () => {
    const before = await recordCount();
    await handleInboundMessage(`jiachun/targets/${DEVICE}`, hitPayload());
    expect(await recordCount()).toBe(before);
  });

  it("無租約時命中不落庫（避免無主命中污染資料）", async () => {
    await pool.query(`UPDATE device_session_bindings SET status='released' WHERE device_id=$1`, [DEVICE]);
    const before = await recordCount();
    await handleInboundMessage(TOPIC, hitPayload());
    expect(await recordCount()).toBe(before);
    // 還原租約給後續測試
    await pool.query(`UPDATE device_session_bindings SET status='active' WHERE device_id=$1`, [DEVICE]);
  });

  describe("HMAC（設備有密鑰後強制驗簽）", () => {
    const SECRET = "sim-secret-123";

    beforeAll(async () => {
      await pool.query(`UPDATE arduino_devices SET device_secret=$1 WHERE id=$2`, [SECRET, DEVICE_ROW]);
    });
    afterAll(async () => {
      await pool.query(`UPDATE arduino_devices SET device_secret=NULL WHERE id=$1`, [DEVICE_ROW]);
    });

    it("✅ 正確簽章 → 計分", async () => {
      const before = await recordCount();
      await handleInboundMessage(TOPIC, hitPayload({}, SECRET));
      expect(await recordCount()).toBe(before + 1);
    });

    it("🛡️ 無簽章 → 丟棄（有密鑰即強制）", async () => {
      const before = await recordCount();
      await handleInboundMessage(TOPIC, hitPayload());
      expect(await recordCount()).toBe(before);
    });

    it("🛡️ 錯誤簽章 → 丟棄", async () => {
      const before = await recordCount();
      await handleInboundMessage(TOPIC, hitPayload({}, "wrong-secret"));
      expect(await recordCount()).toBe(before);
    });
  });
});
