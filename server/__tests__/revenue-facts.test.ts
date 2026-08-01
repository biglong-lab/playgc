// 💰 營收正規化層整合測試（真實 DB）
//
// 為什麼堅持用真 DB：幣別換算、Taipei 營業日、軟刪除排除、幽靈退款排除，
// 全部邏輯都寫在 SQL 裡。把 db mock 掉等於什麼都沒驗到。
// CI 無 DATABASE_URL 時自動跳過（不製造假紅燈）。
//
// 本機執行：
//   node --env-file=.env node_modules/.bin/vitest run server/__tests__/revenue-facts.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const FIELD = "__revtest_field__";
const USER = "__revtest_user__";
const STAFF = "__revtest_staff__";
const GAME = "__revtest_game__";
const VENUE = "__revtest_venue__";
const SLOT = "__revtest_slot__";
const TX_MORNING = "__revtest_tx_morning__";
const TX_MIDNIGHT = "__revtest_tx_midnight__";
const TX_DELETED = "__revtest_tx_deleted__";
const TX_NEXTDAY = "__revtest_tx_nextday__";

/** 測試營業日：UTC 02:00 = Taipei 10:00 */
const DAY = "2026-03-10";
const NEXT_DAY = "2026-03-11";

type PgPool = import("pg").Pool;
let pool: PgPool;
let closePool: () => Promise<void>;
let getRevenueSummary: (typeof import("../lib/revenue-facts"))["getRevenueSummary"];

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM refunds WHERE field_id = $1`, [FIELD]);
  await pool.query(`DELETE FROM pos_transactions WHERE field_id = $1`, [FIELD]);
  await pool.query(
    `DELETE FROM battle_registrations WHERE slot_id IN
       (SELECT s.id FROM battle_slots s JOIN battle_venues v ON s.venue_id = v.id WHERE v.field_id = $1)`,
    [FIELD],
  );
  await pool.query(
    `DELETE FROM battle_slots WHERE venue_id IN (SELECT id FROM battle_venues WHERE field_id = $1)`,
    [FIELD],
  );
  await pool.query(`DELETE FROM battle_venues WHERE field_id = $1`, [FIELD]);
  await pool.query(`DELETE FROM purchases WHERE game_id = $1`, [GAME]);
  await pool.query(`DELETE FROM games WHERE id = $1`, [GAME]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [USER]);
  await pool.query(`DELETE FROM fields WHERE id = $1`, [FIELD]);
}

async function seed(): Promise<void> {
  await pool.query(
    `INSERT INTO fields (id, name, code) VALUES ($1, '營收測試場域', $2)`,
    [FIELD, "REVTEST"],
  );
  await pool.query(`INSERT INTO users (id, email) VALUES ($1, 'revtest@test.local')`, [USER]);
  await pool.query(
    `INSERT INTO games (id, title, field_id, status) VALUES ($1, '營收測試遊戲', $2, 'published')`,
    [GAME, FIELD],
  );

  // ── 🛒 POS ────────────────────────────────────────────────
  const posSql = `INSERT INTO pos_transactions
    (id, field_id, staff_id, amount_cents, paid_amount_cents, payment_method, created_at, deleted_at)
    VALUES ($1, $2, $3, $4, $4, $5, $6::timestamp, $7::timestamp)`;

  // Taipei 03-10 10:00 — 一般白天交易，NT$100
  await pool.query(posSql, [TX_MORNING, FIELD, STAFF, 10000, "cash", "2026-03-10 02:00", null]);
  // Taipei 03-10 01:00（UTC 前一日 17:00）— 跨日邊界，仍屬 03-10 營業日，NT$250
  await pool.query(posSql, [TX_MIDNIGHT, FIELD, STAFF, 25000, "cash", "2026-03-09 17:00", null]);
  // 已軟刪除，NT$999.99 — 不得計入
  await pool.query(posSql, [
    TX_DELETED, FIELD, STAFF, 99999, "cash", "2026-03-10 03:00", "2026-03-10 04:00",
  ]);
  // 隔日交易 NT$50 — 區間過濾用
  await pool.query(posSql, [TX_NEXTDAY, FIELD, STAFF, 5000, "cash", "2026-03-11 02:00", null]);

  // ── 💸 退款（created_at 是 timestamptz）──────────────────────
  const refSql = `INSERT INTO refunds
    (field_id, source_type, source_id, amount_cents, reason, refund_method, processed_by_staff_id, status, created_at)
    VALUES ($1, 'pos_transaction', $2, $3, '測試退款', 'cash', $4, $5, $6::timestamptz)`;

  // 正常退款 NT$30 → 應扣
  await pool.query(refSql, [FIELD, TX_MORNING, 3000, STAFF, "completed", "2026-03-10 03:00+00"]);
  // 幽靈退款：來源交易已軟刪除 → 不得扣（否則帳被重複扣減）
  await pool.query(refSql, [FIELD, TX_DELETED, 50000, STAFF, "completed", "2026-03-10 03:30+00"]);
  // 未完成退款 → 不得扣
  await pool.query(refSql, [FIELD, TX_MORNING, 1000, STAFF, "pending", "2026-03-10 05:00+00"]);

  // ── 🎮 遊戲購買（amount 單位是「元」）────────────────────────
  const buySql = `INSERT INTO purchases (user_id, game_id, purchase_type, amount, status, created_at)
    VALUES ($1, $2, 'game', $3, $4, $5::timestamp)`;
  await pool.query(buySql, [USER, GAME, 100, "completed", "2026-03-10 02:00"]); // NT$100
  await pool.query(buySql, [USER, GAME, 999, "pending", "2026-03-10 02:00"]);   // 未完成 → 不計

  // ── ⚔️ 對戰報名（pricePerPerson 單位是「元」）─────────────────
  await pool.query(
    `INSERT INTO battle_venues (id, field_id, name, settings) VALUES ($1, $2, '測試場地', '{}'::jsonb)`,
    [VENUE, FIELD],
  );
  await pool.query(
    `INSERT INTO battle_slots (id, venue_id, slot_date, start_time, end_time, price_per_person)
     VALUES ($1, $2, '2026-03-10', '10:00', '12:00', 250)`,
    [SLOT, VENUE],
  );
  const regSql = `INSERT INTO battle_registrations (slot_id, user_id, deposit_paid, registered_at)
    VALUES ($1, $2, $3, $4::timestamp)`;
  await pool.query(regSql, [SLOT, USER, true, "2026-03-10 02:00"]);  // NT$250 → 計入
  // 未付訂金 → 不計（同一 user 受 unique 限制，改用不同 slot 略過，這裡僅驗證已付部分）
}

describe.skipIf(!HAS_DB)("營收正規化層 — 真實 DB 聚合", () => {
  beforeAll(async () => {
    const dbMod = await import("../db");
    const factsMod = await import("../lib/revenue-facts");
    pool = dbMod.pool;
    closePool = dbMod.closePool;
    getRevenueSummary = factsMod.getRevenueSummary;
    await cleanup();
    await seed();
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await cleanup();
    await closePool();
  });

  it("幣別統一：遊戲 NT$100 換算成 10000 分（不是 100）", async () => {
    const s = await getRevenueSummary(FIELD, { from: DAY, to: DAY });
    expect(s.bySource.game.grossCents).toBe(10000);
  });

  it("幣別統一：對戰 NT$250 換算成 25000 分", async () => {
    const s = await getRevenueSummary(FIELD, { from: DAY, to: DAY });
    expect(s.bySource.battle.grossCents).toBe(25000);
  });

  it("POS 本來就是分，不得重複乘 100", async () => {
    const s = await getRevenueSummary(FIELD, { from: DAY, to: DAY });
    // 10000（白天）+ 25000（跨日邊界）= 35000，軟刪除的 99999 不算
    expect(s.bySource.pos.grossCents).toBe(35000);
  });

  it("時區：Taipei 01:00（UTC 前一日 17:00）算當日營業額", async () => {
    const s = await getRevenueSummary(FIELD, { from: DAY, to: DAY });
    // 若時區轉換寫錯，這筆 25000 會掉到 03-09，總額只剩 10000
    expect(s.bySource.pos.grossCents).toBeGreaterThanOrEqual(25000);
    expect(s.bySource.pos.txCount).toBe(2);
  });

  it("軟刪除的 POS 交易不計入營收", async () => {
    const s = await getRevenueSummary(FIELD, { from: DAY, to: DAY });
    // 若沒排除軟刪除，總額會是 35000 + 99999 = 134999
    expect(s.bySource.pos.grossCents).not.toBe(134999);
    expect(s.bySource.pos.grossCents).toBe(35000);
  });

  it("退款：只扣 completed，且排除幽靈退款", async () => {
    const s = await getRevenueSummary(FIELD, { from: DAY, to: DAY });
    // 只有 3000 該扣：50000 是幽靈（來源已軟刪除）、1000 是 pending
    expect(s.refundCents).toBe(3000);
  });

  it("未完成的遊戲購買不計入", async () => {
    const s = await getRevenueSummary(FIELD, { from: DAY, to: DAY });
    expect(s.bySource.game.txCount).toBe(1);
  });

  it("總計：gross 70000、refund 3000、net 67000", async () => {
    const s = await getRevenueSummary(FIELD, { from: DAY, to: DAY });
    expect(s.grossCents).toBe(70000);   // POS 35000 + 遊戲 10000 + 對戰 25000
    expect(s.refundCents).toBe(3000);
    expect(s.netCents).toBe(67000);
    expect(s.txCount).toBe(4);
  });

  it("區間過濾：隔日只看得到隔日那筆", async () => {
    const s = await getRevenueSummary(FIELD, { from: NEXT_DAY, to: NEXT_DAY });
    expect(s.bySource.pos.grossCents).toBe(5000);
    expect(s.bySource.game.grossCents).toBe(0);
  });

  it("不指定區間 = 全期累計（含隔日那筆）", async () => {
    const s = await getRevenueSummary(FIELD);
    expect(s.bySource.pos.grossCents).toBe(40000); // 35000 + 5000
    expect(s.from).toBeNull();
  });
});
