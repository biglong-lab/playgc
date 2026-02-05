/**
 * 從 Replit Neon DB 遷移資料到本地 PostgreSQL
 * 使用方式: node --env-file=.env node_modules/.bin/tsx script/migrate-data.ts
 */
import pg from "pg";

const { Pool } = pg;

// 遠端 Neon DB（Replit）
const SOURCE_URL =
  "postgresql://neondb_owner:npg_5IZl8aDrMCkX@ep-soft-credit-ae4gvfq2.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

// 本地 PostgreSQL
const TARGET_URL = process.env.DATABASE_URL!;

// 按照外鍵依賴排序的表格（先沒有依賴的，再有依賴的）
const TABLES_IN_ORDER = [
  "sessions",
  "fields",
  "permissions",
  "roles",
  "role_permissions",
  "users",
  "user_roles",
  "admin_accounts",
  "admin_sessions",
  "audit_logs",
  "games",
  "pages",
  "items",
  "events",
  "game_sessions",
  "player_progress",
  "teams",
  "team_members",
  "team_sessions",
  "team_votes",
  "team_vote_ballots",
  "team_score_history",
  "random_events",
  "random_event_occurrences",
  "chat_messages",
  "arduino_devices",
  "device_logs",
  "shooting_records",
  "leaderboard",
  "locations",
  "player_locations",
  "location_visits",
  "navigation_paths",
  "achievements",
  "player_achievements",
];

async function migrate() {
  const source = new Pool({ connectionString: SOURCE_URL });
  const target = new Pool({ connectionString: TARGET_URL });

  console.log("連接遠端 Neon DB...");
  await source.query("SELECT 1");
  console.log("連接本地 PostgreSQL...");
  await target.query("SELECT 1");
  console.log("兩邊資料庫都已連接\n");

  // 暫時停用外鍵約束
  await target.query("SET session_replication_role = 'replica';");

  let totalRows = 0;

  for (const table of TABLES_IN_ORDER) {
    try {
      // 檢查遠端表格是否存在
      const existsResult = await source.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
        [table]
      );

      if (!existsResult.rows[0].exists) {
        console.log(`⏭  ${table} — 遠端不存在，跳過`);
        continue;
      }

      // 讀取遠端資料
      const { rows } = await source.query(`SELECT * FROM "${table}"`);

      if (rows.length === 0) {
        console.log(`⏭  ${table} — 0 筆，跳過`);
        continue;
      }

      // 清空本地表格
      await target.query(`DELETE FROM "${table}"`);

      // 批次寫入
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      const quotedColumns = columns.map((c) => `"${c}"`).join(", ");
      const insertSQL = `INSERT INTO "${table}" (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

      let inserted = 0;
      for (const row of rows) {
        const values = columns.map((col) => row[col]);
        try {
          await target.query(insertSQL, values);
          inserted++;
        } catch (err: any) {
          console.error(`  ⚠ ${table} 寫入錯誤:`, err.message);
        }
      }

      totalRows += inserted;
      console.log(`✅ ${table} — ${inserted}/${rows.length} 筆`);
    } catch (err: any) {
      console.error(`❌ ${table} — 錯誤: ${err.message}`);
    }
  }

  // 恢復外鍵約束
  await target.query("SET session_replication_role = 'origin';");

  console.log(`\n🎉 遷移完成！共匯入 ${totalRows} 筆資料`);

  await source.end();
  await target.end();
}

migrate().catch((err) => {
  console.error("遷移失敗:", err);
  process.exit(1);
});
