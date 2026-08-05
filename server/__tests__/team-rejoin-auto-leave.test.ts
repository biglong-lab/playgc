// 🔁 重連撤銷自動離隊 — 真實 DB 整合測試
//
// 背景（2026-08-05）：斷線寬限過期會寫 team_members.leftAt，但玩家切回來重連時
// 只把自己加回記憶體房間、沒清 DB → WS 說「他在」、DB 說「他離隊了」。玩家一重整
// 就發現不在隊上、隊友從 DB 讀成員也看不到他。生產實測：279 次 auto_leave 中
// 71 次（25%）該玩家事後仍有 WS 活動，人根本還在玩。
//
// 這裡最重要的不是「撤銷會成功」，而是**撤銷不會誤傷**：
// 被踢的人、主動離隊的人、已結束的隊伍，一律不得被自動加回。
//
// 本機執行：
//   node --env-file=.env node_modules/.bin/vitest run server/__tests__/team-rejoin-auto-leave.test.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const FIELD = "__rejoin_field__";
const GAME = "__rejoin_game__";
const USER_A = "__rejoin_user_a__";
const USER_B = "__rejoin_user_b__";
const TEAM_PLAYING = "__rejoin_team_playing__";
const TEAM_DONE = "__rejoin_team_done__";
const TEAM_OTHER = "__rejoin_team_other__";

type PgPool = import("pg").Pool;
let pool: PgPool;
let closePool: () => Promise<void>;
let revokeAutoLeave: (typeof import("../lib/team-membership"))["revokeAutoLeave"];

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM team_members WHERE team_id = ANY($1)`, [
    [TEAM_PLAYING, TEAM_DONE, TEAM_OTHER],
  ]);
  await pool.query(`DELETE FROM teams WHERE id = ANY($1)`, [[TEAM_PLAYING, TEAM_DONE, TEAM_OTHER]]);
  await pool.query(`DELETE FROM games WHERE id = $1`, [GAME]);
  await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[USER_A, USER_B]]);
  await pool.query(`DELETE FROM fields WHERE id = $1`, [FIELD]);
}

async function seedBase(): Promise<void> {
  await pool.query(`INSERT INTO fields (id, name, code) VALUES ($1,'重連測試場域','REJOINTEST')`, [FIELD]);
  await pool.query(`INSERT INTO users (id, email) VALUES ($1,'a@rejoin.test'),($2,'b@rejoin.test')`, [USER_A, USER_B]);
  await pool.query(
    `INSERT INTO games (id, title, field_id, status) VALUES ($1,'重連測試遊戲',$2,'published')`,
    [GAME, FIELD],
  );
  const team = `INSERT INTO teams (id, game_id, name, access_code, status) VALUES ($1,$2,$3,$4,$5)`;
  await pool.query(team, [TEAM_PLAYING, GAME, "進行中隊伍", "RJ0001", "playing"]);
  await pool.query(team, [TEAM_DONE, GAME, "已完成隊伍", "RJ0002", "completed"]);
  await pool.query(team, [TEAM_OTHER, GAME, "另一隊", "RJ0003", "playing"]);
}

/** 重設成員狀態（每個 it 前跑，確保彼此獨立） */
async function resetMembers(): Promise<void> {
  await pool.query(`DELETE FROM team_members WHERE team_id = ANY($1)`, [
    [TEAM_PLAYING, TEAM_DONE, TEAM_OTHER],
  ]);
}

async function addMember(
  teamId: string,
  userId: string,
  leftReason: string | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO team_members (team_id, user_id, left_at, left_reason)
     VALUES ($1,$2,$3,$4)`,
    [teamId, userId, leftReason ? new Date() : null, leftReason],
  );
}

async function memberState(teamId: string, userId: string) {
  const { rows } = await pool.query(
    `SELECT left_at, left_reason FROM team_members WHERE team_id=$1 AND user_id=$2`,
    [teamId, userId],
  );
  return rows[0] as { left_at: Date | null; left_reason: string | null };
}

describe.skipIf(!HAS_DB)("重連撤銷自動離隊", () => {
  beforeAll(async () => {
    const dbMod = await import("../db");
    const libMod = await import("../lib/team-membership");
    pool = dbMod.pool;
    closePool = dbMod.closePool;
    revokeAutoLeave = libMod.revokeAutoLeave;
    await cleanup();
    await seedBase();
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await cleanup();
    await closePool();
  });

  beforeEach(resetMembers);

  describe("該撤銷的情況", () => {
    it("斷線自動離隊後重連 → leftAt 與 leftReason 都被清掉", async () => {
      await addMember(TEAM_PLAYING, USER_A, "auto_leave");
      const revoked = await revokeAutoLeave(TEAM_PLAYING, USER_A);
      expect(revoked).toBe(true);

      const state = await memberState(TEAM_PLAYING, USER_A);
      expect(state.left_at).toBeNull();
      expect(state.left_reason).toBeNull();
    });
  });

  describe("🛡️ 絕不能誤撤銷（迴歸防護）", () => {
    it("被隊長/管理員踢出後重連 → 仍是離隊狀態（否則等於踢不掉人）", async () => {
      await addMember(TEAM_PLAYING, USER_A, "kicked");
      const revoked = await revokeAutoLeave(TEAM_PLAYING, USER_A);
      expect(revoked).toBe(false);

      const state = await memberState(TEAM_PLAYING, USER_A);
      expect(state.left_at).not.toBeNull();
      expect(state.left_reason).toBe("kicked");
    });

    it("玩家自己按離開後重連 → 仍是離隊狀態", async () => {
      await addMember(TEAM_PLAYING, USER_A, "manual");
      const revoked = await revokeAutoLeave(TEAM_PLAYING, USER_A);
      expect(revoked).toBe(false);

      const state = await memberState(TEAM_PLAYING, USER_A);
      expect(state.left_reason).toBe("manual");
    });

    it("隊伍已完成 → 即使是 auto_leave 也不加回", async () => {
      await addMember(TEAM_DONE, USER_A, "auto_leave");
      const revoked = await revokeAutoLeave(TEAM_DONE, USER_A);
      expect(revoked).toBe(false);

      const state = await memberState(TEAM_DONE, USER_A);
      expect(state.left_at).not.toBeNull();
    });

    it("沒有離隊紀錄的正常成員 → 不受影響、不誤報成功", async () => {
      await addMember(TEAM_PLAYING, USER_A, null);
      const revoked = await revokeAutoLeave(TEAM_PLAYING, USER_A);
      expect(revoked).toBe(false);

      const state = await memberState(TEAM_PLAYING, USER_A);
      expect(state.left_at).toBeNull();
    });
  });

  describe("🛡️ 不得波及其他隊伍與帳號", () => {
    it("只影響指定隊伍 —— 同一玩家在別隊的離隊狀態不動", async () => {
      await addMember(TEAM_PLAYING, USER_A, "auto_leave");
      await addMember(TEAM_OTHER, USER_A, "auto_leave");

      await revokeAutoLeave(TEAM_PLAYING, USER_A);

      expect((await memberState(TEAM_PLAYING, USER_A)).left_at).toBeNull();
      // 另一隊必須原封不動
      const other = await memberState(TEAM_OTHER, USER_A);
      expect(other.left_at).not.toBeNull();
      expect(other.left_reason).toBe("auto_leave");
    });

    it("只影響指定帳號 —— 同隊其他成員的離隊狀態不動", async () => {
      await addMember(TEAM_PLAYING, USER_A, "auto_leave");
      await addMember(TEAM_PLAYING, USER_B, "auto_leave");

      await revokeAutoLeave(TEAM_PLAYING, USER_A);

      expect((await memberState(TEAM_PLAYING, USER_A)).left_at).toBeNull();
      const b = await memberState(TEAM_PLAYING, USER_B);
      expect(b.left_at).not.toBeNull();
      expect(b.left_reason).toBe("auto_leave");
    });
  });

  describe("冪等性", () => {
    it("重複呼叫不會出錯，第二次回 false", async () => {
      await addMember(TEAM_PLAYING, USER_A, "auto_leave");
      expect(await revokeAutoLeave(TEAM_PLAYING, USER_A)).toBe(true);
      expect(await revokeAutoLeave(TEAM_PLAYING, USER_A)).toBe(false);
    });
  });
});
