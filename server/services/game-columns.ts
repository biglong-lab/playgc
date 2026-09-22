// 🧱 games 表啟動時冪等補欄位（2026-09-22）
//
// 部署安全：scripts/deploy.sh 不跑遷移 → 新程式若先上線、生產 DB 還沒有欄位，
//   所有 games 查詢會失敗。因此啟動時冪等補欄位（只加不刪）。
// - 先查 information_schema：已存在就跳過（ALTER TABLE 會拿 ACCESS EXCLUSIVE 鎖，不必每次開機都拿）
// - 真的要補時設 lock_timeout，避免被長查詢卡住導致服務起不來
//
// 欄位：
//   scoring_enabled  計分開關（業主：有些遊戲完全不需要積分）— 預設 TRUE 維持既有行為
//   match_config     競賽 / 接力設定（時間限制、倒數、人數、接力分段）— 預設 NULL = 用系統預設
import { sql } from "drizzle-orm";
import { db } from "../db";

/** 欄位名與型別定義皆為常數（非使用者輸入） */
const GAME_COLUMNS: ReadonlyArray<{ name: string; ddl: string }> = [
  { name: "scoring_enabled", ddl: "BOOLEAN DEFAULT TRUE" },
  { name: "match_config", ddl: "JSONB" },
];

async function columnExists(name: string): Promise<boolean> {
  const existing = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'games' AND column_name = ${name}
  `);
  return !!(existing as { rows?: unknown[] }).rows?.length;
}

export async function ensureGameColumns(): Promise<void> {
  for (const col of GAME_COLUMNS) {
    if (await columnExists(col.name)) continue;
    await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
      await tx.execute(sql.raw(`ALTER TABLE games ADD COLUMN IF NOT EXISTS ${col.name} ${col.ddl}`));
    });
  }
}
