// 📊 營收聚合層整合測試（真實 DB）
//
// 同 revenue-facts.test.ts 的理由：切片邏輯全在 SQL，mock 掉就沒測到。
// CI 無 DATABASE_URL 時自動跳過。
//
// 本機執行：
//   node --env-file=.env node_modules/.bin/vitest run server/__tests__/revenue-aggregations.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const FIELD = "__aggtest_field__";
const USER = "__aggtest_user__";
const STAFF = "__aggtest_staff__";
const GAME = "__aggtest_game__";
const ACTIVITY = "__aggtest_activity__";
const TX_D1 = "__aggtest_tx_d1__";
const TX_D3 = "__aggtest_tx_d3__";

const D1 = "2026-04-01";
const D3 = "2026-04-03";

type PgPool = import("pg").Pool;
let pool: PgPool;
let closePool: () => Promise<void>;
type Aggs = typeof import("../lib/revenue-aggregations");
let getRevenueTimeseries: Aggs["getRevenueTimeseries"];
let getRevenueBreakdown: Aggs["getRevenueBreakdown"];
let getRevenueTransactions: Aggs["getRevenueTransactions"];

async function cleanup(): Promise<void> {
  await pool.query(
    `DELETE FROM pos_transaction_items WHERE transaction_id IN
       (SELECT id FROM pos_transactions WHERE field_id = $1)`,
    [FIELD],
  );
  await pool.query(`DELETE FROM pos_transactions WHERE field_id = $1`, [FIELD]);
  await pool.query(`DELETE FROM activities WHERE id = $1`, [ACTIVITY]);
  await pool.query(`DELETE FROM purchases WHERE game_id = $1`, [GAME]);
  await pool.query(`DELETE FROM games WHERE id = $1`, [GAME]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [USER]);
  await pool.query(`DELETE FROM fields WHERE id = $1`, [FIELD]);
}

async function seed(): Promise<void> {
  await pool.query(`INSERT INTO fields (id, name, code) VALUES ($1, '聚合測試場域', $2)`, [FIELD, "AGGTEST"]);
  await pool.query(`INSERT INTO users (id, email) VALUES ($1, 'aggtest@test.local')`, [USER]);
  await pool.query(
    `INSERT INTO games (id, title, field_id, status) VALUES ($1, '聚合測試遊戲', $2, 'published')`,
    [GAME, FIELD],
  );
  await pool.query(
    `INSERT INTO activities (id, field_id, slug, name, price_cents) VALUES ($1, $2, 'aggtest', '射擊體驗', 30000)`,
    [ACTIVITY, FIELD],
  );

  const posSql = `INSERT INTO pos_transactions
    (id, field_id, staff_id, activity_id, amount_cents, paid_amount_cents, payment_method, created_at)
    VALUES ($1, $2, $3, $4, $5, $5, $6, $7::timestamp)`;
  // 4/01 Taipei 10:00 → NT$100（綁活動、現金）
  await pool.query(posSql, [TX_D1, FIELD, STAFF, ACTIVITY, 10000, "cash", "2026-04-01 02:00"]);
  // 4/03 Taipei 10:00 → NT$250（散客、LINE Pay）
  await pool.query(posSql, [TX_D3, FIELD, STAFF, null, 25000, "linepay", "2026-04-03 02:00"]);

  const itemSql = `INSERT INTO pos_transaction_items
    (transaction_id, name_snapshot, category, qty, unit_price_cents, line_total_cents, modifiers)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`;
  await pool.query(itemSql, [TX_D1, "美式咖啡", "food", 2, 3000, 6000,
    JSON.stringify([{ groupName: "冰塊", optionName: "少冰", priceDeltaCents: 0 }])]);
  await pool.query(itemSql, [TX_D1, "風獅爺明信片", "goods", 1, 4000, 4000, "[]"]);
  await pool.query(itemSql, [TX_D3, "美式咖啡", "food", 5, 5000, 25000,
    JSON.stringify([{ groupName: "冰塊", optionName: "少冰", priceDeltaCents: 0 }])]);

  // 遊戲購買 NT$80（4/01）
  await pool.query(
    `INSERT INTO purchases (user_id, game_id, purchase_type, amount, status, created_at)
     VALUES ($1, $2, 'game', 80, 'completed', '2026-04-01 02:00'::timestamp)`,
    [USER, GAME],
  );
}

describe.skipIf(!HAS_DB)("營收聚合層 — 真實 DB", () => {
  beforeAll(async () => {
    const dbMod = await import("../db");
    const aggMod = await import("../lib/revenue-aggregations");
    pool = dbMod.pool;
    closePool = dbMod.closePool;
    getRevenueTimeseries = aggMod.getRevenueTimeseries;
    getRevenueBreakdown = aggMod.getRevenueBreakdown;
    getRevenueTransactions = aggMod.getRevenueTransactions;
    await cleanup();
    await seed();
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await cleanup();
    await closePool();
  });

  describe("趨勢 timeseries", () => {
    it("空白日補零 — 3 天區間只有 2 天有交易，仍回 3 個桶", async () => {
      const s = await getRevenueTimeseries(FIELD, { from: D1, to: D3 }, "day");
      expect(s).toHaveLength(3);
      expect(s.map((b) => b.bucket)).toEqual(["2026-04-01", "2026-04-02", "2026-04-03"]);
      expect(s[1].netCents).toBe(0); // 4/02 無交易
    });

    it("各源分開統計，POS 與遊戲不混在一起", async () => {
      const s = await getRevenueTimeseries(FIELD, { from: D1, to: D3 }, "day");
      const d1 = s[0];
      expect(d1.posCents).toBe(10000);
      expect(d1.gameCents).toBe(8000); // NT$80 → 8000 分
      expect(d1.netCents).toBe(18000);
    });

    it("月粒度把整段收進同一個桶", async () => {
      const s = await getRevenueTimeseries(FIELD, { from: D1, to: D3 }, "month");
      expect(s).toHaveLength(1);
      expect(s[0].posCents).toBe(35000);
    });
  });

  describe("維度排行 breakdown", () => {
    it("POS 品項：依金額排序、qty 正確累加", async () => {
      const r = await getRevenueBreakdown(FIELD, { from: D1, to: D3 }, "pos_product");
      expect(r.rows[0].label).toBe("美式咖啡");
      expect(r.rows[0].cents).toBe(31000); // 6000 + 25000
      expect(r.rows[0].qty).toBe(7);       // 2 + 5
      expect(r.rows[1].label).toBe("風獅爺明信片");
    });

    it("POS 分類：代碼轉成中文標籤", async () => {
      const r = await getRevenueBreakdown(FIELD, { from: D1, to: D3 }, "pos_category");
      expect(r.rows.map((x) => x.label)).toContain("餐飲");
      expect(r.rows.map((x) => x.label)).toContain("文創");
    });

    it("付款方式：現金與 LINE Pay 分開", async () => {
      const r = await getRevenueBreakdown(FIELD, { from: D1, to: D3 }, "method");
      const byLabel = Object.fromEntries(r.rows.map((x) => [x.label, x.cents]));
      expect(byLabel["LINE Pay"]).toBe(25000);
      expect(byLabel["現金"]).toBe(10000);
    });

    it("活動：未綁活動的交易歸為散客", async () => {
      const r = await getRevenueBreakdown(FIELD, { from: D1, to: D3 }, "activity");
      const labels = r.rows.map((x) => x.label);
      expect(labels).toContain("射擊體驗");
      expect(labels).toContain("未指定活動（散客）");
    });

    it("客製選項熱度：少冰累計 7 件", async () => {
      const r = await getRevenueBreakdown(FIELD, { from: D1, to: D3 }, "pos_modifier");
      expect(r.rows[0].label).toBe("少冰");
      expect(r.rows[0].qty).toBe(7);
    });

    it("share 百分比加總約等於 100", async () => {
      const r = await getRevenueBreakdown(FIELD, { from: D1, to: D3 }, "pos_product");
      const sum = r.rows.reduce((s, x) => s + x.share, 0);
      expect(sum).toBeGreaterThan(99);
      expect(sum).toBeLessThan(101);
    });

    it("超過 limit 的長尾歸入「其他」", async () => {
      const r = await getRevenueBreakdown(FIELD, { from: D1, to: D3 }, "pos_product", 1);
      expect(r.rows).toHaveLength(2);
      expect(r.rows[1].key).toBe("__other__");
      expect(r.rows[1].cents).toBe(4000);
    });

    it("商品目錄：遊戲帶 🎮 前綴", async () => {
      const r = await getRevenueBreakdown(FIELD, { from: D1, to: D3 }, "catalog");
      expect(r.rows[0].label).toContain("聚合測試遊戲");
      expect(r.rows[0].cents).toBe(8000);
    });
  });

  describe("明細 transactions", () => {
    it("跨源合併並依時間新到舊排序", async () => {
      const tx = await getRevenueTransactions(FIELD, { from: D1, to: D3 });
      expect(tx.length).toBe(3); // POS×2 + 遊戲×1
      expect(tx[0].businessDate).toBe("2026-04-03");
    });

    it("POS 明細帶品項摘要", async () => {
      const tx = await getRevenueTransactions(FIELD, { from: D1, to: D3 }, { sources: ["pos"] });
      const d3 = tx.find((t) => t.businessDate === "2026-04-03");
      expect(d3?.detail).toContain("美式咖啡×5");
      expect(d3?.label).toBe("現場散客");
    });

    it("可只取單一來源", async () => {
      const tx = await getRevenueTransactions(FIELD, { from: D1, to: D3 }, { sources: ["game"] });
      expect(tx).toHaveLength(1);
      expect(tx[0].amountCents).toBe(8000);
    });
  });
});
