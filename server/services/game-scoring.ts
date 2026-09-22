// 🎯 遊戲計分開關（2026-09-22）
//
// 業主需求：「有些遊戲完全不需要積分、加減分，跟分數有關都不需要，所以需要一個開關」
// games.scoring_enabled（預設 true = 維持既有行為）
//
// 部署安全：scripts/deploy.sh 不跑遷移 → 新程式若先上線、生產 DB 還沒有欄位，
//   所有 games 查詢會失敗。因此啟動時冪等補欄位（只加不刪、PG11+ 常數預設值為 metadata 變更、瞬間完成）。
import { sql } from "drizzle-orm";
import { db } from "../db";

export async function ensureGameScoringSchema(): Promise<void> {
  // 🐛 2026-09-22 審查：先查欄位是否存在 —— ALTER TABLE 會拿 ACCESS EXCLUSIVE 鎖，
  //   不必每次開機都拿；真的要補時設 lock_timeout，避免被長查詢卡住導致服務起不來
  const existing = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'games' AND column_name = 'scoring_enabled'
  `);
  if ((existing as { rows?: unknown[] }).rows?.length) return;

  await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
    await tx.execute(sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS scoring_enabled BOOLEAN DEFAULT TRUE`);
  });
}
