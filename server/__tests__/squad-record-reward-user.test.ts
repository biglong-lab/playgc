// 🎁 戰績寫入觸發獎勵時必須帶 userId — 真實 DB 整合測試
//
// 背景（Bug）：writeSquadRecordFromSession 呼叫 reward engine 時沒帶 userId →
//   - target=leader 的平台券 issuedToUserId = null
//   - 外部券（external_coupon）因無 userId 直接跳過
//   → 玩家在 /api/me/rewards（以 issuedToUserId / userId 查）永遠看不到隊伍獎勵。
//
// 驗證：
//   1. 隊伍局 → 獎勵發給 teams.leaderId（不是第一個有進度的隊員）
//   2. 單人局（teamName「xxx's Team」、無 team_sessions）→ 發給 player_progress 的玩家
//
// 本機執行：
//   node --env-file=.env node_modules/.bin/vitest run server/__tests__/squad-record-reward-user.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const FIELD = "__sqrwd_field__";
const GAME = "__sqrwd_game__";
const LEADER = "__sqrwd_leader__";
const MEMBER = "__sqrwd_member__";
const SOLO = "__sqrwd_solo__";
const TEAM = "__sqrwd_team__";
const SESSION_TEAM = "__sqrwd_session_team__";
const SESSION_SOLO = "__sqrwd_session_solo__";
const TPL = "__sqrwd_tpl__";
const RULE = "__sqrwd_rule__";
const PROVIDER = "__sqrwd_provider__";
const TEAM_NAME = "獎勵測試隊";
const SOLO_TEAM_NAME = "小明's Team";
const SESSIONS = [SESSION_TEAM, SESSION_SOLO];
const SQUAD_IDS = [`team:${GAME}:${TEAM_NAME}`, `team:${GAME}:${SOLO_TEAM_NAME}`];

type PgPool = import("pg").Pool;
let pool: PgPool;
let closePool: () => Promise<void>;
let writeSquadRecordFromSession: (typeof import("../services/squad-record-writer"))["writeSquadRecordFromSession"];
let storage: (typeof import("../storage"))["storage"];

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM platform_coupons WHERE template_id = $1`, [TPL]);
  await pool.query(`DELETE FROM squad_external_rewards WHERE provider = $1`, [PROVIDER]);
  await pool.query(`DELETE FROM reward_conversion_events WHERE source_id = ANY($1)`, [SESSIONS]);
  await pool.query(`DELETE FROM squad_match_records WHERE session_id = ANY($1)`, [SESSIONS]);
  await pool.query(`DELETE FROM squad_ratings WHERE squad_id = ANY($1)`, [SQUAD_IDS]);
  await pool.query(`DELETE FROM squad_stats WHERE squad_id = ANY($1)`, [SQUAD_IDS]);
  await pool.query(`DELETE FROM reward_conversion_rules WHERE id = $1`, [RULE]);
  await pool.query(`DELETE FROM coupon_templates WHERE id = $1`, [TPL]);
  await pool.query(`DELETE FROM player_progress WHERE session_id = ANY($1)`, [SESSIONS]);
  await pool.query(`DELETE FROM team_sessions WHERE session_id = ANY($1)`, [SESSIONS]);
  await pool.query(`DELETE FROM team_members WHERE team_id = $1`, [TEAM]);
  await pool.query(`DELETE FROM teams WHERE id = $1`, [TEAM]);
  await pool.query(`DELETE FROM game_sessions WHERE id = ANY($1)`, [SESSIONS]);
  await pool.query(`DELETE FROM games WHERE id = $1`, [GAME]);
  await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[LEADER, MEMBER, SOLO]]);
  await pool.query(`DELETE FROM fields WHERE id = $1`, [FIELD]);
}

async function seedBase(): Promise<void> {
  await pool.query(`INSERT INTO fields (id, name, code) VALUES ($1,'獎勵測試場域','SQRWDTEST')`, [FIELD]);
  await pool.query(
    `INSERT INTO users (id, email) VALUES ($1,'l@sqrwd.test'),($2,'m@sqrwd.test'),($3,'s@sqrwd.test')`,
    [LEADER, MEMBER, SOLO],
  );
  await pool.query(
    `INSERT INTO games (id, title, field_id, status, game_mode) VALUES ($1,'獎勵測試遊戲',$2,'published','team')`,
    [GAME, FIELD],
  );
  await pool.query(
    `INSERT INTO coupon_templates (id, name, discount_type, discount_value) VALUES ($1,'測試券','fixed',50)`,
    [TPL],
  );
  // 本測試場域專屬規則：完成遊戲 → 隊長拿平台券 + 外部券
  await pool.query(
    `INSERT INTO reward_conversion_rules (id, name, field_id, triggers, rewards) VALUES ($1,'測試隊長獎',$2,$3,$4)`,
    [
      RULE,
      FIELD,
      JSON.stringify({ eventType: "game_complete", fieldId: FIELD }),
      JSON.stringify([
        { type: "platform_coupon", templateId: TPL, target: "leader" },
        { type: "external_coupon", provider: PROVIDER, value: "測試外部券", target: "leader" },
      ]),
    ],
  );
}

/** 建一場已完成（時長 5 分鐘，避開 <60 秒防作弊）的 session */
async function seedSession(id: string, teamName: string): Promise<void> {
  const completedAt = new Date();
  const startedAt = new Date(completedAt.getTime() - 5 * 60_000);
  await pool.query(
    `INSERT INTO game_sessions (id, game_id, team_name, status, score, started_at, completed_at)
     VALUES ($1,$2,$3,'completed',100,$4,$5)`,
    [id, GAME, teamName, startedAt, completedAt],
  );
}

async function seedProgress(sessionId: string, userId: string, updatedAt: Date): Promise<void> {
  await pool.query(
    `INSERT INTO player_progress (session_id, user_id, updated_at) VALUES ($1,$2,$3)`,
    [sessionId, userId, updatedAt],
  );
}

async function seedTeamSession(): Promise<void> {
  await seedSession(SESSION_TEAM, TEAM_NAME);
  await pool.query(
    `INSERT INTO teams (id, game_id, name, access_code, leader_id, status) VALUES ($1,$2,$3,'SQRW01',$4,'completed')`,
    [TEAM, GAME, TEAM_NAME, LEADER],
  );
  await pool.query(
    `INSERT INTO team_members (team_id, user_id, role) VALUES ($1,$2,'leader'),($1,$3,'member')`,
    [TEAM, LEADER, MEMBER],
  );
  await pool.query(`INSERT INTO team_sessions (team_id, session_id) VALUES ($1,$2)`, [TEAM, SESSION_TEAM]);
  // 隊員比隊長更早有進度 — 確保不是「隨便挑第一個有進度的人」
  await seedProgress(SESSION_TEAM, MEMBER, new Date(Date.now() - 10 * 60_000));
  await seedProgress(SESSION_TEAM, LEADER, new Date());
}

async function completeSession(sessionId: string): Promise<void> {
  const session = await storage.getSession(sessionId);
  if (!session) throw new Error(`測試 session ${sessionId} 不存在`);
  await writeSquadRecordFromSession(session);
}

async function couponOwners(sessionId: string): Promise<Array<string | null>> {
  const { rows } = await pool.query(
    `SELECT issued_to_user_id FROM platform_coupons WHERE template_id = $1 AND source_event_id = $2`,
    [TPL, sessionId],
  );
  return rows.map((r: { issued_to_user_id: string | null }) => r.issued_to_user_id);
}

async function externalOwners(sessionId: string): Promise<Array<string | null>> {
  const { rows } = await pool.query(
    `SELECT user_id FROM squad_external_rewards WHERE provider = $1 AND source_event_id = $2`,
    [PROVIDER, sessionId],
  );
  return rows.map((r: { user_id: string | null }) => r.user_id);
}

describe.skipIf(!HAS_DB)("戰績寫入 → 獎勵發給正確玩家（userId）", () => {
  beforeAll(async () => {
    const dbMod = await import("../db");
    pool = dbMod.pool;
    closePool = dbMod.closePool;
    ({ writeSquadRecordFromSession } = await import("../services/squad-record-writer"));
    ({ storage } = await import("../storage"));
    await cleanup();
    await seedBase();
    await seedTeamSession();
    await seedSession(SESSION_SOLO, SOLO_TEAM_NAME);
    await seedProgress(SESSION_SOLO, SOLO, new Date());
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await cleanup();
    await closePool();
  });

  // 註：writeSquadRecordFromSession 冪等（重複呼叫不重發），各 it 自行觸發以便 retry 安全
  it("隊伍局：隊長平台券 issuedToUserId = teams.leaderId", async () => {
    await completeSession(SESSION_TEAM);
    expect(await couponOwners(SESSION_TEAM)).toEqual([LEADER]);
  });

  it("隊伍局：外部券不再因缺 userId 被跳過，且發給隊長", async () => {
    await completeSession(SESSION_TEAM);
    expect(await externalOwners(SESSION_TEAM)).toEqual([LEADER]);
  });

  it("單人局（無 team_sessions）：獎勵發給本局玩家（player_progress）", async () => {
    await completeSession(SESSION_SOLO);
    expect(await couponOwners(SESSION_SOLO)).toEqual([SOLO]);
    expect(await externalOwners(SESSION_SOLO)).toEqual([SOLO]);
  });
});
