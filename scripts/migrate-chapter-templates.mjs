#!/usr/bin/env node
/**
 * 章節模板（chapter_templates）+ game_chapters.source_template_id migration
 *
 * 執行：
 *   node scripts/migrate-chapter-templates.mjs         # 本地
 *   node scripts/migrate-chapter-templates.mjs --prod  # 生產（需 PROD_DB_URL 環境變數）
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
  `\n📚 Chapter templates migration (${process.argv.includes("--prod") ? "PROD" : "LOCAL"})\n`
);

// 1. 建立 chapter_templates 表
await c.query(`
  CREATE TABLE IF NOT EXISTS chapter_templates (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id VARCHAR NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    category VARCHAR(50),
    estimated_time INTEGER,
    unlock_type VARCHAR(20) DEFAULT 'complete_previous',
    unlock_config JSONB DEFAULT '{}'::jsonb,
    pages_snapshot JSONB DEFAULT '[]'::jsonb NOT NULL,
    source_chapter_id VARCHAR,
    source_game_id VARCHAR,
    created_by VARCHAR REFERENCES admin_accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
`);
console.log("✓ chapter_templates 表已建立");

// 2. 建立索引
await c.query(`
  CREATE INDEX IF NOT EXISTS idx_chapter_templates_field
    ON chapter_templates (field_id);
  CREATE INDEX IF NOT EXISTS idx_chapter_templates_category
    ON chapter_templates (field_id, category);
`);
console.log("✓ chapter_templates 索引已建立");

// 3. game_chapters 加 source_template_id 欄位
await c.query(`
  ALTER TABLE game_chapters
  ADD COLUMN IF NOT EXISTS source_template_id VARCHAR;
`);
console.log("✓ game_chapters.source_template_id 欄位已存在");

await c.query(`
  CREATE INDEX IF NOT EXISTS idx_chapters_source_template
    ON game_chapters (source_template_id);
`);
console.log("✓ idx_chapters_source_template 索引已建立");

console.log(`\n🎉 Migration 完成\n`);
await c.end();
