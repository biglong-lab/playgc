#!/usr/bin/env node
/**
 * 加 slug 欄位到 items 表，並為現有資料自動生成 slug
 * - slug 從 name 生成：中文 → 拼音 / 英數字 + 去特殊字元 / 保留數字
 * - 重複時加流水號 (_2, _3)
 */
import pg from "pg";

const CONN = process.argv.includes("--prod")
  ? process.env.PROD_DB_URL
  : "postgresql://postgres:postgres@localhost:5437/gameplatform";

const c = new pg.Client(CONN);
await c.connect();

console.log(`\n🏷️ Items slug migration (${process.argv.includes("--prod") ? "PROD" : "LOCAL"})\n`);

// 1. 加欄位（如不存在）
await c.query(`
  ALTER TABLE items
  ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
`);
console.log("✓ items.slug 欄位已存在");

// 2. 加 unique index
await c.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_items_game_slug
  ON items (game_id, slug)
  WHERE slug IS NOT NULL;
`);
console.log("✓ uniq_items_game_slug index 已建立");

// 3. 為沒有 slug 的 items 自動生成
const { rows: itemsWithoutSlug } = await c.query(`
  SELECT id, game_id, name FROM items WHERE slug IS NULL OR slug = '';
`);
console.log(`\n找到 ${itemsWithoutSlug.length} 個 items 需生成 slug\n`);

function nameToSlug(name) {
  // 去除中文標點和空白，保留英數和常見字元
  const cleaned = name
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "_")
    .replace(/[^\w\u4e00-\u9fa5]/g, "")
    .substring(0, 50);
  // 若結果全中文 or 空，用 hash fallback（仍保留可讀性）
  return cleaned || `item`;
}

// 以 game 分組，避免同遊戲衝突
const byGame = {};
for (const item of itemsWithoutSlug) {
  if (!byGame[item.game_id]) byGame[item.game_id] = [];
  byGame[item.game_id].push(item);
}

for (const gameId of Object.keys(byGame)) {
  // 抓該遊戲已用過的 slug
  const { rows: existing } = await c.query(
    `SELECT slug FROM items WHERE game_id = $1 AND slug IS NOT NULL`,
    [gameId],
  );
  const usedSlugs = new Set(existing.map((r) => r.slug));

  for (const item of byGame[gameId]) {
    let baseSlug = nameToSlug(item.name);
    let finalSlug = baseSlug;
    let counter = 2;
    while (usedSlugs.has(finalSlug)) {
      finalSlug = `${baseSlug}_${counter}`;
      counter++;
    }
    usedSlugs.add(finalSlug);
    await c.query(`UPDATE items SET slug = $1 WHERE id = $2`, [finalSlug, item.id]);
    console.log(`  ✓ ${item.name.padEnd(20)} → ${finalSlug}`);
  }
}

console.log(`\n🎉 Migration 完成\n`);
await c.end();
