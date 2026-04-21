#!/usr/bin/env node
/**
 * 加 slug 欄位到 locations 和 achievements 表，並為現有資料自動生成 slug
 *
 * 執行：
 *   node scripts/migrate-locations-achievements-slug.mjs         # 本地
 *   node scripts/migrate-locations-achievements-slug.mjs --prod  # 生產
 */
import pg from "pg";

const CONN = process.argv.includes("--prod")
  ? process.env.PROD_DB_URL
  : "postgresql://postgres:postgres@localhost:5437/gameplatform";

if (!CONN) {
  console.error("❌ 未設定資料庫連線字串");
  process.exit(1);
}

const c = new pg.Client(CONN);
await c.connect();

console.log(
  `\n🏷️ Locations + Achievements slug migration (${process.argv.includes("--prod") ? "PROD" : "LOCAL"})\n`,
);

function nameToSlug(name) {
  if (!name) return "unnamed";
  const cleaned = name
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "_")
    .replace(/[^\w\u4e00-\u9fa5]/g, "")
    .substring(0, 50);
  return cleaned || "unnamed";
}

async function migrateTable(tableName, logEmoji) {
  console.log(`\n${logEmoji} Migrating ${tableName}...`);

  // 1. 加欄位
  await c.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS slug VARCHAR(100);`);
  console.log(`✓ ${tableName}.slug 欄位已存在`);

  // 2. unique index
  const idxName = `uniq_${tableName}_game_slug`;
  await c.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ${idxName}
    ON ${tableName} (game_id, slug)
    WHERE slug IS NOT NULL;
  `);
  console.log(`✓ ${idxName} 已建立`);

  // 3. 為沒 slug 的自動生成
  const { rows } = await c.query(
    `SELECT id, game_id, name FROM ${tableName} WHERE slug IS NULL OR slug = '';`,
  );
  console.log(`找到 ${rows.length} 筆需生成 slug\n`);

  const byGame = {};
  for (const row of rows) {
    if (!byGame[row.game_id]) byGame[row.game_id] = [];
    byGame[row.game_id].push(row);
  }

  for (const gameId of Object.keys(byGame)) {
    const { rows: existing } = await c.query(
      `SELECT slug FROM ${tableName} WHERE game_id = $1 AND slug IS NOT NULL`,
      [gameId],
    );
    const usedSlugs = new Set(existing.map((r) => r.slug));

    for (const row of byGame[gameId]) {
      let baseSlug = nameToSlug(row.name);
      let finalSlug = baseSlug;
      let counter = 2;
      while (usedSlugs.has(finalSlug)) {
        finalSlug = `${baseSlug}_${counter}`;
        counter++;
      }
      usedSlugs.add(finalSlug);
      await c.query(`UPDATE ${tableName} SET slug = $1 WHERE id = $2`, [finalSlug, row.id]);
      console.log(`  ✓ ${row.name.padEnd(24)} → ${finalSlug}`);
    }
  }
}

await migrateTable("locations", "📍");
await migrateTable("achievements", "🏆");

console.log(`\n🎉 Migration 完成\n`);
await c.end();
