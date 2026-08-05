// 🔁 session 揀選 — 測試員三步重現鏈固定驗證（CHITO f095652b，11 修未果）
//
// 這題修了 11 次的模式：每次修一個觸發點、沒有人把「測試員實際操作鏈」
// 固定成測試。本檔把重現鏈變成不變式 —— 之後任何人再動揀選邏輯，
// 這裡先擋。真實 DB（mock 掉 db 就測不到 SQL 排序與應用層決策的組合）。
//
// 鏈（對應 getActiveSessionByUserAndGame 的 5 條規則）：
//   A. 只有已通關 C            → 回 C（顯示任務完成，設計如此）
//   B. C + 剛建的空場 N        → 回 N（「再玩一次」不得又跳回通關）
//   C. C + N 走到第 2 頁       → 回 N + 進度第 2 頁
//   D. 離開(保留進度)重進      → 仍回 N 第 2 頁（不得跳任務完成）
//   E. C + 超過 24h 的空場     → 回 C（陳年空場不該讓玩家卡在第 0 頁）

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const FIELD = "__selchain_field__";
const USER = "__selchain_user__";
const GAME = "__selchain_game__";
const S_DONE = "__selchain_done__";
const S_NEW = "__selchain_new__";
const PAGE2 = "__selchain_page2__";
const PAGE_END = "__selchain_endpage__";

type PgPool = import("pg").Pool;
let pool: PgPool;
let closePool: () => Promise<void>;
let getActive: (userId: string, gameId: string) => Promise<{ session: { id: string; status: string | null }; progress: { currentPageId: string | null } } | null>;

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM player_progress WHERE user_id = $1`, [USER]);
  await pool.query(`DELETE FROM pages WHERE id = ANY($1)`, [[PAGE2, PAGE_END]]);
  await pool.query(`DELETE FROM game_sessions WHERE id = ANY($1)`, [[S_DONE, S_NEW]]);
  await pool.query(`DELETE FROM games WHERE id = $1`, [GAME]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [USER]);
  await pool.query(`DELETE FROM fields WHERE id = $1`, [FIELD]);
}

describe.skipIf(!HAS_DB)("session 揀選：通關→再玩→保留進度 鏈", () => {
  beforeAll(async () => {
    const dbMod = await import("../db");
    pool = dbMod.pool;
    closePool = dbMod.closePool;
    const { storage } = await import("../storage");
    getActive = storage.getActiveSessionByUserAndGame.bind(storage);

    await cleanup();
    await pool.query(`INSERT INTO fields (id,name,code) VALUES ($1,'揀選鏈場域','SELCHAIN')`, [FIELD]);
    await pool.query(`INSERT INTO users (id,email) VALUES ($1,'selchain@test.local')`, [USER]);
    await pool.query(
      `INSERT INTO games (id,title,field_id,status,game_mode) VALUES ($1,'揀選鏈遊戲',$2,'published','individual')`,
      [GAME, FIELD],
    );
    // current_page_id 有 FK → 先建兩個真實頁
    await pool.query(
      `INSERT INTO pages (id,game_id,page_order,page_type,config) VALUES
        ($1,$2,1,'text_card','{}'::jsonb), ($3,$2,2,'text_card','{}'::jsonb)`,
      [PAGE2, GAME, PAGE_END],
    );
    // 已通關 C（3 天前開始）
    await pool.query(
      `INSERT INTO game_sessions (id,game_id,team_name,status,started_at) VALUES ($1,$2,'C隊','completed', now()-interval '3 days')`,
      [S_DONE, GAME],
    );
    await pool.query(
      `INSERT INTO player_progress (session_id,user_id,current_page_id,score) VALUES ($1,$2,$3,100)`,
      [S_DONE, USER, PAGE_END],
    );
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await cleanup();
    await closePool();
  });

  it("A. 只有已通關 → 回通關場（顯示任務完成是設計行為）", async () => {
    const r = await getActive(USER, GAME);
    expect(r?.session.id).toBe(S_DONE);
    expect(r?.session.status).toBe("completed");
  });

  it("B. 再玩一次剛建新場（空進度）→ 回新場，不得又跳回通關", async () => {
    await pool.query(
      `INSERT INTO game_sessions (id,game_id,team_name,status,started_at) VALUES ($1,$2,'N隊','playing', now())`,
      [S_NEW, GAME],
    );
    await pool.query(
      `INSERT INTO player_progress (session_id,user_id,current_page_id,score) VALUES ($1,$2,NULL,0)`,
      [S_NEW, USER],
    );
    const r = await getActive(USER, GAME);
    expect(r?.session.id).toBe(S_NEW);
    expect(r?.session.status).toBe("playing");
  });

  it("C. 新場走到第 2 頁 → 回新場 + 第 2 頁進度", async () => {
    await pool.query(
      `UPDATE player_progress SET current_page_id=$1 WHERE session_id=$2 AND user_id=$3`,
      [PAGE2, S_NEW, USER],
    );
    const r = await getActive(USER, GAME);
    expect(r?.session.id).toBe(S_NEW);
    expect(r?.progress.currentPageId).toBe(PAGE2);
  });

  it("D. 離開(保留進度)重進 → 仍回新場第 2 頁，不得跳任務完成", async () => {
    // 離開只是導航離頁、不改資料 → 重進就是再查一次
    const r = await getActive(USER, GAME);
    expect(r?.session.id).toBe(S_NEW);
    expect(r?.session.status).toBe("playing");
    expect(r?.progress.currentPageId).toBe(PAGE2);
  });

  it("E. 新場是超過 24h 的『空』場 → 回通關場（陳年空場不接續）", async () => {
    await pool.query(
      `UPDATE game_sessions SET started_at = now()-interval '25 hours' WHERE id=$1`,
      [S_NEW],
    );
    await pool.query(
      `UPDATE player_progress SET current_page_id=NULL WHERE session_id=$1 AND user_id=$2`,
      [S_NEW, USER],
    );
    const r = await getActive(USER, GAME);
    expect(r?.session.id).toBe(S_DONE);
    expect(r?.session.status).toBe("completed");
  });

  it("E2. 超過 24h 但『有進度』的場 → 仍要接續（進度不因時間蒸發）", async () => {
    await pool.query(
      `UPDATE player_progress SET current_page_id=$1 WHERE session_id=$2 AND user_id=$3`,
      [PAGE2, S_NEW, USER],
    );
    const r = await getActive(USER, GAME);
    expect(r?.session.id).toBe(S_NEW);
    expect(r?.progress.currentPageId).toBe(PAGE2);
  });
});
