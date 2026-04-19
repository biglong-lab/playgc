#!/usr/bin/env node
/**
 * 補齊 draft 遊戲的 placeholder 設定（所有欄位都是後台編輯器支援的）
 * - gps_mission 無座標 → 補賈村中心座標 + 開 qrFallback
 * - time_bomb 無 tasks → 加一個範例 tap 任務
 *
 * 這些是 placeholder，管理員到實地後進後台編輯器即可修改。
 */
import pg from "pg";
const client = new pg.Client("postgresql://postgres:postgres@localhost:5437/gameplatform");
await client.connect();

// === 1. gps_mission 補座標 ===
// 金門金寧鄉賈村一帶（24.48°N, 118.30°E），管理員可到後台改
const { rows: gpsRows } = await client.query(`
  SELECT p.id, p.page_order, p.config, g.title
  FROM pages p JOIN games g ON g.id = p.game_id
  WHERE p.page_type = 'gps_mission'
    AND p.config->'targetLocation' IS NULL
    AND p.config->>'targetLatitude' IS NULL
  ORDER BY g.title, p.page_order
`);

console.log(`\n📍 GPS Mission 需補 ${gpsRows.length} 頁：\n`);
let i = 0;
for (const row of gpsRows) {
  // 每頁略偏移一點，避免全部重疊
  const lat = 24.4860 + i * 0.001;
  const lng = 118.3010 + i * 0.001;
  const newConfig = {
    ...row.config,
    targetLocation: { lat, lng, radius: 50 },
    qrFallback: true,
    fallbackQrCode: `MISSION_${row.page_order}_BACKUP`,
    hotZoneHints: true,
    // 保留原有的 title / instruction 等
  };
  await client.query("UPDATE pages SET config = $1 WHERE id = $2", [newConfig, row.id]);
  console.log(`  ✓ ${row.title} 頁 ${row.page_order} → (${lat.toFixed(4)}, ${lng.toFixed(4)}) r=50m`);
  i++;
}

// === 2. time_bomb 補 tasks ===
const { rows: bombRows } = await client.query(`
  SELECT p.id, p.page_order, p.config, g.title
  FROM pages p JOIN games g ON g.id = p.game_id
  WHERE p.page_type = 'time_bomb'
    AND (p.config->'tasks' IS NULL OR jsonb_array_length(COALESCE(p.config->'tasks', '[]'::jsonb)) = 0)
  ORDER BY g.title, p.page_order
`);

console.log(`\n💣 TimeBomb 需補 ${bombRows.length} 頁：\n`);
for (const row of bombRows) {
  const newConfig = {
    ...row.config,
    timeLimit: row.config.timeLimit || 60,
    tasks: [
      {
        type: "tap",
        targetCount: 20,
        question: "快速拆除引信 — 點擊 20 下！",
      },
      {
        type: "input",
        question: "輸入拆彈密碼（範本：0000）",
        answer: "0000",
      },
    ],
    rewardPoints: row.config.rewardPoints || 50,
    successMessage: row.config.successMessage || "炸彈拆除成功！",
    failureMessage: row.config.failureMessage || "爆炸了！",
  };
  await client.query("UPDATE pages SET config = $1 WHERE id = $2", [newConfig, row.id]);
  console.log(`  ✓ ${row.title} 頁 ${row.page_order} → 新增 tap + input 任務`);
}

console.log(`\n🎉 總共補齊：${gpsRows.length} GPS + ${bombRows.length} TimeBomb\n`);
console.log("⚠️  GPS 座標是 placeholder，管理員到實地後請進後台編輯器調整實際位置。");
console.log("⚠️  所有補齊欄位都是後台 UI 可編輯的 schema 格式，可重現。\n");

await client.end();
