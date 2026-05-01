// 🏯 賈村 6 個多人示範遊戲 SQL generator
//
// 用途：把 JIACHUN_MODULES 轉成 SQL（DO $$ plpgsql block），可直接灌進 production DB。
//
// 執行（在主專案）：
//   npx tsx scripts/gen-jiachun-seed-sql.ts > /tmp/jiachun-seed.sql
//
// 套用到 production：
//   cat /tmp/jiachun-seed.sql | ssh root@172.233.89.147 "docker exec -i gamehomicc-db-1 psql -U \$POSTGRES_USER -d \$POSTGRES_DB"

import { JIACHUN_MODULES } from "../shared/schema/modules/jiachun";

/** 產生 8 字 alphanumeric slug */
function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** 把字串 escape 成 plpgsql 字串（單引號 → 雙單引號） */
function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

/** 把物件 escape 成 jsonb literal（單引號 → 雙單引號） */
function jsonbLit(obj: unknown): string {
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;
}

console.log("-- 🏯 賈村 6 個多人示範遊戲 一次性 seed");
console.log("-- 防重：依 title 比對，已存在則跳過");
console.log("BEGIN;");
console.log("");

console.log("DO $JIACHUN_SEED$");
console.log("DECLARE");
console.log("  v_field_id varchar;");
console.log("  v_game_id varchar;");
console.log("BEGIN");
console.log(
  "  SELECT id INTO v_field_id FROM fields WHERE code = 'JIACHUN' LIMIT 1;",
);
console.log("  IF v_field_id IS NULL THEN");
console.log("    RAISE EXCEPTION 'JIACHUN field not found';");
console.log("  END IF;");
console.log("");

for (const mod of JIACHUN_MODULES) {
  const slug = generateSlug();
  console.log(`  -- ${mod.coverEmoji} ${mod.name}`);
  console.log(
    `  IF NOT EXISTS (SELECT 1 FROM games WHERE title = '${sqlEscape(mod.name)}') THEN`,
  );
  console.log(`    INSERT INTO games (`);
  console.log(`      title, description, field_id, public_slug,`);
  console.log(
    `      difficulty, estimated_time, max_players, game_mode, status`,
  );
  console.log(`    ) VALUES (`);
  console.log(
    `      '${sqlEscape(mod.name)}', '${sqlEscape(mod.description)}', v_field_id, '${slug}',`,
  );
  console.log(
    `      '${mod.difficulty}', ${mod.estimatedTime ?? "NULL"}, ${mod.maxPlayers}, '${mod.gameMode ?? "individual"}', 'published'`,
  );
  console.log(`    ) RETURNING id INTO v_game_id;`);
  console.log(``);

  // pages
  for (let i = 0; i < mod.pages.length; i++) {
    const p = mod.pages[i];
    console.log(
      `    INSERT INTO pages (id, game_id, page_type, page_order, custom_name, config) VALUES`,
    );
    console.log(
      `      (gen_random_uuid(), v_game_id, '${p.pageType}', ${i + 1}, '${sqlEscape(p.title || "")}', ${jsonbLit(p.config)});`,
    );
  }
  console.log(`    RAISE NOTICE '✅ 建立 ${mod.name}（${mod.pages.length} 頁）';`);
  console.log(`  ELSE`);
  console.log(`    RAISE NOTICE '⏭️  跳過 ${mod.name}（已存在）';`);
  console.log(`  END IF;`);
  console.log(``);
}

console.log("END $JIACHUN_SEED$;");
console.log("");
console.log("COMMIT;");
console.log("");
console.log("-- 驗證：列出賈村場域所有遊戲");
console.log(
  `SELECT title, status, game_mode FROM games WHERE field_id = (SELECT id FROM fields WHERE code = 'JIACHUN') ORDER BY status, title;`,
);
