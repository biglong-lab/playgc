#!/usr/bin/env node
/**
 * 盤點 items / achievements / chapters 在現有遊戲的使用狀況
 * 目標：找出「建了卻沒用」、「引用但不存在」、「硬編」等問題
 */
import pg from "pg";
const c = new pg.Client("postgresql://postgres:postgres@localhost:5437/gameplatform");
await c.connect();

const { rows: games } = await c.query(`SELECT id, title FROM games ORDER BY created_at`);

for (const g of games) {
  console.log(`\n━━━ ${g.title} (${g.id.substring(0, 12)}...) ━━━`);

  // 1. items 數量
  const items = (await c.query(`SELECT id, name FROM items WHERE game_id=$1`, [g.id])).rows;
  // 2. achievements 數量
  const achievements = (await c.query(`SELECT id, name, condition FROM achievements WHERE game_id=$1`, [g.id])).rows;
  // 3. chapters 數量
  const chapters = (await c.query(`SELECT id, title, unlock_type FROM game_chapters WHERE game_id=$1`, [g.id])).rows;
  // 4. pages 引用 items 的地方
  const pages = (await c.query(`SELECT id, page_order, page_type, config FROM pages WHERE game_id=$1`, [g.id])).rows;

  // 收集 pages 引用的 itemId
  const referencedItemIds = new Set();
  const referencedLocationIds = new Set();
  for (const p of pages) {
    const cfg = p.config || {};
    // onCompleteActions / onSuccess
    if (cfg.onSuccess?.grantItem) referencedItemIds.add(String(cfg.onSuccess.grantItem));
    if (Array.isArray(cfg.onCompleteActions)) {
      for (const a of cfg.onCompleteActions) {
        if ((a.type === "add_item" || a.type === "remove_item") && a.itemId) {
          referencedItemIds.add(String(a.itemId));
        }
      }
    }
    // conditional_verify conditions.has_item
    if (Array.isArray(cfg.conditions)) {
      for (const cond of cfg.conditions) {
        if (cond.itemId) referencedItemIds.add(String(cond.itemId));
        if (cond.locationId) referencedLocationIds.add(String(cond.locationId));
      }
    }
    // button.items
    if (Array.isArray(cfg.buttons)) {
      for (const b of cfg.buttons) {
        if (Array.isArray(b.items)) b.items.forEach((i) => referencedItemIds.add(String(i)));
      }
    }
    // conditional_verify fragments.sourceItemId
    if (Array.isArray(cfg.fragments)) {
      for (const f of cfg.fragments) {
        if (typeof f === "object" && f.sourceItemId) {
          referencedItemIds.add(String(f.sourceItemId));
        }
      }
    }
  }

  // items 用不到 + 被引用卻不存在
  const existingItemIds = new Set(items.map((i) => i.id));
  const unusedItems = items.filter((i) => !referencedItemIds.has(i.id));
  const danglingItemRefs = [...referencedItemIds].filter((id) => !existingItemIds.has(id));

  console.log(`  道具: ${items.length} | 被引用: ${referencedItemIds.size}`);
  if (unusedItems.length)
    console.log(`    🟡 建了沒用：${unusedItems.map((i) => i.name).join(", ")}`);
  if (danglingItemRefs.length)
    console.log(`    🔴 引用不存在的 itemId：${danglingItemRefs.join(", ")}（可能是字串 label 非真 UUID）`);

  console.log(`  成就: ${achievements.length}`);
  // achievements condition 統計
  const condTypes = achievements.map((a) => a.condition?.type || "(無)").reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  if (achievements.length) console.log(`    觸發類型: ${JSON.stringify(condTypes)}`);

  console.log(`  章節: ${chapters.length}`);
  if (chapters.length) {
    const byType = chapters.map((ch) => ch.unlock_type).reduce((acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
    // 分章 pages 數量
    const pagesInChapters = (await c.query(`SELECT COUNT(*) c FROM pages WHERE game_id=$1 AND chapter_id IS NOT NULL`, [g.id])).rows[0].c;
    console.log(`    解鎖類型: ${JSON.stringify(byType)} | pages 分章: ${pagesInChapters}/${pages.length}`);
  }
}

// === 全平台 ===
console.log(`\n━━━ 全平台統計 ━━━`);
const r1 = await c.query(`SELECT COUNT(*) c FROM items`);
const r2 = await c.query(`SELECT COUNT(*) c FROM achievements`);
const r3 = await c.query(`SELECT COUNT(*) c FROM game_chapters`);
const r4 = await c.query(`SELECT COUNT(*) c FROM pages WHERE chapter_id IS NOT NULL`);
console.log(`  items: ${r1.rows[0].c}`);
console.log(`  achievements: ${r2.rows[0].c}`);
console.log(`  chapters: ${r3.rows[0].c}`);
console.log(`  pages 分配到 chapter: ${r4.rows[0].c}`);

await c.end();
