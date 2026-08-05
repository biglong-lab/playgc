// 🔒 leftAt / leftReason 不變式 — 防止「加了欄位卻漏改清除點」
//
// 背景（2026-08-05）：新增 team_members.left_reason 用來區分
// auto_leave / manual / kicked，只有 auto_leave 可在玩家重連時撤銷。
// 但加欄位當下漏了一個清除點：/rejoin 端點只清 leftAt 沒清 leftReason，
// 會留下「人在隊上、卻標著 kicked」的髒資料。
//
// 這類 bug 的共通模式是「多處寫入、漏改其中一處」——ADR-0024 認定的
// 結構性根因之一。與其逐一測端點，不如把規則本身寫成不變式測試：
// 只要有人再加新的清除點卻漏改，這裡就會紅。
//
// 不變式：leftAt 為 null（人在隊上）⇒ leftReason 也必須為 null

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const HAS_DB = Boolean(process.env.DATABASE_URL);

// ─────────────────────────────────────────────
// A. 靜態檢查：程式碼層面不得有「只清 leftAt」的寫法
// ─────────────────────────────────────────────
describe("程式碼不變式：leftAt 與 leftReason 必須一起清", () => {
  it("所有清除 teamMembers.leftAt 的地方都同時清 leftReason", () => {
    // 只掃 team_members 相關檔案；walkie 用的是 walkieGroupMembers（無此欄位）
    const files = execSync(
      `grep -rl "teamMembers" server --include="*.ts" | grep -v __tests__ || true`,
      { encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);

    const offenders: string[] = [];
    for (const f of files) {
      const p = resolve(process.cwd(), f);
      if (!existsSync(p)) continue;
      const src = readFileSync(p, "utf8");

      // 找 .set({ ... leftAt: null ... }) 區塊，檢查同區塊有沒有 leftReason
      const setBlocks = src.match(/\.set\(\{[\s\S]{0,400}?\}\)/g) ?? [];
      for (const block of setBlocks) {
        if (!/leftAt:\s*null/.test(block)) continue;
        if (!/leftReason:\s*null/.test(block)) {
          offenders.push(`${f}: ${block.replace(/\s+/g, " ").slice(0, 90)}`);
        }
      }
    }

    expect(
      offenders,
      `以下地方清了 leftAt 卻沒清 leftReason，會留下「人在隊上卻標著離隊原因」的髒資料：\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("所有寫入 leftAt 的地方都有標記 leftReason（否則無法判斷能否撤銷）", () => {
    const src = readFileSync(resolve(process.cwd(), "server/routes/websocket.ts"), "utf8")
      + readFileSync(resolve(process.cwd(), "server/routes/team-lifecycle.ts"), "utf8");

    const writes = src.match(/\.set\(\{[^}]*leftAt:\s*new Date\(\)[^}]*\}\)/g) ?? [];
    expect(writes.length, "應該找得到離隊寫入點").toBeGreaterThan(0);

    const unmarked = writes.filter((w) => !/leftReason:/.test(w));
    expect(
      unmarked,
      `以下離隊寫入沒標 leftReason，重連時無法判斷該不該撤銷：\n${unmarked.join("\n")}`,
    ).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// B. 資料檢查：實際 DB 不得存在違反不變式的列
// ─────────────────────────────────────────────
describe.skipIf(!HAS_DB)("資料不變式（真實 DB）", () => {
  type PgPool = import("pg").Pool;
  let pool: PgPool;
  let closePool: () => Promise<void>;

  beforeAll(async () => {
    const m = await import("../db");
    pool = m.pool;
    closePool = m.closePool;
  });
  afterAll(async () => {
    if (HAS_DB) await closePool();
  });

  it("沒有「在隊上卻標著離隊原因」的成員", async () => {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM team_members
       WHERE left_at IS NULL AND left_reason IS NOT NULL`,
    );
    expect(
      rows[0].n,
      "left_at 已清空但 left_reason 殘留 —— 表示某個清除點漏改",
    ).toBe(0);
  });

  it("left_reason 只會是三種已定義的值", async () => {
    const { rows } = await pool.query(
      `SELECT DISTINCT left_reason FROM team_members
       WHERE left_reason IS NOT NULL`,
    );
    const allowed = ["auto_leave", "manual", "kicked"];
    const unexpected = rows.map((r) => r.left_reason).filter((v) => !allowed.includes(v));
    expect(unexpected, `出現未定義的離隊原因：${unexpected.join(", ")}`).toEqual([]);
  });
});
