// 🎟️ 訪客紀錄認領 — 憑證單元測試 + 真實 DB 搬移整合測試
//
// 本機執行（DB 部分需 DATABASE_URL，沒有會自動跳過）：
//   node --env-file=.env node_modules/.bin/vitest run server/__tests__/guest-claim.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const HAS_DB = Boolean(process.env.DATABASE_URL);

// 沒有 DB（CI 單元測試）→ 以空殼替代 db 模組，讓憑證純函式測試照跑；DB 整合段落自動 skip
vi.mock("../db", async (importOriginal) =>
  process.env.DATABASE_URL ? importOriginal() : { db: {}, pool: {}, closePool: async () => undefined },
);

describe("認領憑證（createClaimTicket / verifyClaimTicket）", () => {
  let svc: typeof import("../services/guest-claim");

  beforeAll(async () => {
    process.env.SESSION_SECRET ||= "test-session-secret";
    svc = await import("../services/guest-claim");
  });

  it("有效憑證 → 取回訪客 uid", () => {
    const ticket = svc.createClaimTicket("anon-1");
    expect(svc.verifyClaimTicket(ticket)).toBe("anon-1");
  });

  it("竄改內容或簽章 → 無效", () => {
    const ticket = svc.createClaimTicket("anon-1");
    const [body, sig] = ticket.split(".");
    const forged = Buffer.from(JSON.stringify({ v: 1, uid: "victim", exp: Date.now() + 60_000, n: "x" })).toString("base64url");
    expect(svc.verifyClaimTicket(`${forged}.${sig}`)).toBeNull();
    expect(svc.verifyClaimTicket(`${body}.${sig.slice(0, -2)}xx`)).toBeNull();
  });

  it("過期 → 無效", () => {
    const issuedAt = Date.now() - svc.CLAIM_TICKET_TTL_MS - 1000;
    const ticket = svc.createClaimTicket("anon-1", issuedAt);
    expect(svc.verifyClaimTicket(ticket)).toBeNull();
  });

  it("格式錯誤 → 無效、不拋錯", () => {
    expect(svc.verifyClaimTicket("")).toBeNull();
    expect(svc.verifyClaimTicket("abc")).toBeNull();
    expect(svc.verifyClaimTicket("a.b.c")).toBeNull();
  });

  it("同一訪客每張憑證都不同（含隨機值）", () => {
    expect(svc.createClaimTicket("anon-1")).not.toBe(svc.createClaimTicket("anon-1"));
  });
});

const FIELD = "__gclaim_field__";
const GAME = "__gclaim_game__";
const ANON = "__gclaim_anon__";
const REAL = "__gclaim_real__";
const SESSION = "__gclaim_session__";

type PgPool = import("pg").Pool;

describe.skipIf(!HAS_DB)("claimGuestRecords（真實 DB）", () => {
  let pool: PgPool;
  let closePool: () => Promise<void>;
  let claimGuestRecords: (typeof import("../services/guest-claim"))["claimGuestRecords"];

  async function cleanup() {
    await pool.query(`DELETE FROM field_memberships WHERE user_id = ANY($1)`, [[ANON, REAL]]);
    await pool.query(`DELETE FROM player_progress WHERE session_id = $1`, [SESSION]);
    await pool.query(`DELETE FROM game_sessions WHERE id = $1`, [SESSION]);
    await pool.query(`DELETE FROM games WHERE id = $1`, [GAME]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[ANON, REAL]]);
    await pool.query(`DELETE FROM fields WHERE id = $1`, [FIELD]);
  }

  beforeAll(async () => {
    const dbMod = await import("../db");
    pool = dbMod.pool;
    closePool = dbMod.closePool;
    ({ claimGuestRecords } = await import("../services/guest-claim"));
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
    await pool.query(`INSERT INTO fields (id, name, code) VALUES ($1,'認領測試場域','GCLAIMTEST')`, [FIELD]);
    await pool.query(
      `INSERT INTO users (id, email) VALUES ($1,$2),($3,'real@gclaim.test')`,
      [ANON, `user-${ANON}@firebase.local`, REAL],
    );
    await pool.query(`INSERT INTO games (id, title, field_id, status) VALUES ($1,'認領測試遊戲',$2,'published')`, [GAME, FIELD]);
    await pool.query(`INSERT INTO game_sessions (id, game_id, status, score) VALUES ($1,$2,'completed',80)`, [SESSION, GAME]);
    await pool.query(`INSERT INTO player_progress (session_id, user_id, score) VALUES ($1,$2,80)`, [SESSION, ANON]);
    // 兩個帳號都已是同場域會員 → 唯一鍵 (user_id, field_id) 衝突情境
    await pool.query(`INSERT INTO field_memberships (user_id, field_id) VALUES ($1,$3),($2,$3)`, [ANON, REAL, FIELD]);
  });

  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  it("訪客的遊戲紀錄搬到正式帳號", async () => {
    const moved = await claimGuestRecords(ANON, REAL);
    expect(moved.player_progress).toBe(1);
    const { rows } = await pool.query(`SELECT user_id FROM player_progress WHERE session_id = $1`, [SESSION]);
    expect(rows[0].user_id).toBe(REAL);
  });

  it("唯一鍵衝突（同場域會員）→ 保留正式帳號那筆、不報錯、不刪訪客那筆", async () => {
    const moved = await claimGuestRecords(ANON, REAL);
    expect(moved.field_memberships).toBeUndefined();
    const { rows } = await pool.query(
      `SELECT user_id FROM field_memberships WHERE field_id = $1 ORDER BY user_id`,
      [FIELD],
    );
    expect(rows.map((r) => r.user_id).sort()).toEqual([ANON, REAL].sort());
  });

  it("冪等：重複認領只會搬 0 筆", async () => {
    await claimGuestRecords(ANON, REAL);
    const again = await claimGuestRecords(ANON, REAL);
    expect(again).toEqual({});
  });

  it("同一個 uid 或空值 → 不動作", async () => {
    expect(await claimGuestRecords(ANON, ANON)).toEqual({});
    expect(await claimGuestRecords("", REAL)).toEqual({});
  });
});
