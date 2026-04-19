#!/usr/bin/env node
/**
 * 把本地修正過的 pages config 推送到生產 DB
 * 範圍：只推本地近 1 小時更新過的 pages
 */
import pg from "pg";
import { execSync } from "child_process";

const local = new pg.Client("postgresql://postgres:postgres@localhost:5437/gameplatform");
await local.connect();

// 1. 抓需要推送的 pages（剛 migration + fill 的範圍）
// - choice_verify 含 correct 在 options 物件（新 schema）
// - lock 含 combination（新 schema）
// - gps_mission 含 targetLocation（剛填的 placeholder）
// - time_bomb 含非空 tasks
const { rows } = await local.query(`
  SELECT id, config, game_id, page_order, page_type
  FROM pages
  WHERE (
    page_type = 'choice_verify'
    OR page_type = 'lock'
    OR (page_type = 'gps_mission' AND config->'targetLocation' IS NOT NULL)
    OR (page_type = 'time_bomb' AND jsonb_array_length(COALESCE(config->'tasks','[]'::jsonb)) > 0)
  )
  ORDER BY page_type, page_order
`);

console.log(`📤 準備推送 ${rows.length} 個 pages 到生產：\n`);
rows.forEach((r) => console.log(`  - [${r.page_type}] page_order ${r.page_order} id=${r.id.substring(0, 20)}...`));

// 2. 生成 SQL UPDATE 陳述
let sqlStatements = [];
for (const row of rows) {
  // 用 dollar-quoted string 避免 escape 地獄
  const configJson = JSON.stringify(row.config).replace(/'/g, "''");
  sqlStatements.push(
    `UPDATE pages SET config = '${configJson}'::jsonb WHERE id = '${row.id}';`,
  );
}

// 加個 BEGIN / COMMIT 做 transaction
const fullSQL = `\\set ON_ERROR_STOP on
BEGIN;
${sqlStatements.join("\n")}
COMMIT;
SELECT COUNT(*) as total FROM pages;
`;

import { writeFileSync } from "fs";
writeFileSync("/tmp/push-pages.sql", fullSQL);
console.log(`\n📝 SQL 已寫入 /tmp/push-pages.sql（${fullSQL.length} bytes）`);

// 3. SCP + 執行
console.log("\n🚀 上傳到生產並執行...");
execSync("scp -q /tmp/push-pages.sql root@172.233.89.147:/tmp/push-pages.sql", { stdio: "inherit" });
const result = execSync(
  `ssh root@172.233.89.147 "docker exec -i gamehomicc-db-1 psql -U postgres -d gameplatform < /tmp/push-pages.sql && rm /tmp/push-pages.sql"`,
  { encoding: "utf8" },
);
console.log(result);

console.log("✅ 生產已同步！\n");
await local.end();
