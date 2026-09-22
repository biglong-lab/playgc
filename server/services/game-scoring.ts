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
  await db.execute(sql`
    ALTER TABLE games ADD COLUMN IF NOT EXISTS scoring_enabled BOOLEAN DEFAULT TRUE
  `);
}
