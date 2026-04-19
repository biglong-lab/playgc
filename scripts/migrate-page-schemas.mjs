#!/usr/bin/env node
/**
 * 一次性遷移：把舊 schema 升級成元件讀得懂的新 schema
 * - choice_verify: options:["a","b"] + correctIndex:N → options:[{text:"a",correct:false},...]
 * - lock: correctCode + codeLength → combination + digits
 *
 * 安全可重複執行（已是新格式會 skip）。
 * 支援：--prod 推生產、--local 本地（預設）
 */
import pg from "pg";

const PROD = process.argv.includes("--prod");
const CONN = PROD
  ? "postgresql://postgres:rh750920@172.233.89.147:54321/gameplatform" // 需 SSH tunnel 或 port expose
  : "postgresql://postgres:postgres@localhost:5437/gameplatform";

const client = new pg.Client(CONN);
await client.connect();

console.log(`\n🔧 Page Schema Migration (${PROD ? "PROD" : "LOCAL"})\n`);

// === 1. choice_verify: 舊 options 陣列 + correctIndex → 新物件陣列 ===
const { rows: choiceRows } = await client.query(`
  SELECT p.id, p.config
  FROM pages p
  WHERE p.page_type = 'choice_verify'
    AND jsonb_typeof(p.config->'options') = 'array'
    AND jsonb_array_length(p.config->'options') > 0
    AND jsonb_typeof(p.config->'options'->0) = 'string'
`);

let choiceFixed = 0;
for (const row of choiceRows) {
  const c = row.config;
  const oldOptions = c.options;
  const correctIndex = c.correctIndex;
  const newOptions = oldOptions.map((text, idx) => ({
    text,
    correct: idx === correctIndex,
  }));
  const newConfig = { ...c, options: newOptions };
  delete newConfig.correctIndex;

  await client.query(`UPDATE pages SET config = $1 WHERE id = $2`, [newConfig, row.id]);
  choiceFixed++;
}
console.log(`✅ choice_verify 升級：${choiceFixed} 頁（字串陣列 → 物件陣列）`);

// === 2. lock: correctCode / codeLength → combination / digits ===
const { rows: lockRows } = await client.query(`
  SELECT p.id, p.config
  FROM pages p
  WHERE p.page_type = 'lock'
    AND p.config ? 'correctCode'
    AND NOT (p.config ? 'combination')
`);

let lockFixed = 0;
for (const row of lockRows) {
  const c = row.config;
  const newConfig = {
    ...c,
    combination: c.correctCode,
    digits: c.codeLength || c.correctCode?.length || 4,
  };
  delete newConfig.correctCode;
  delete newConfig.codeLength;

  await client.query(`UPDATE pages SET config = $1 WHERE id = $2`, [newConfig, row.id]);
  lockFixed++;
}
console.log(`✅ lock 升級：${lockFixed} 頁（correctCode → combination）`);

// === 3. gps_mission: targetLat/targetLng 扁平 → targetLocation 物件 ===
const { rows: gpsRows } = await client.query(`
  SELECT p.id, p.config
  FROM pages p
  WHERE p.page_type = 'gps_mission'
    AND (p.config ? 'targetLatitude' OR p.config ? 'targetLongitude')
    AND NOT (p.config ? 'targetLocation')
`);

let gpsFixed = 0;
for (const row of gpsRows) {
  const c = row.config;
  const lat = Number(c.targetLatitude);
  const lng = Number(c.targetLongitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

  const newConfig = {
    ...c,
    targetLocation: { lat, lng, radius: c.radius || c.targetRadius || 50 },
  };
  delete newConfig.targetLatitude;
  delete newConfig.targetLongitude;
  delete newConfig.radius;
  delete newConfig.targetRadius;

  await client.query(`UPDATE pages SET config = $1 WHERE id = $2`, [newConfig, row.id]);
  gpsFixed++;
}
console.log(`✅ gps_mission 升級：${gpsFixed} 頁（扁平座標 → targetLocation 物件）`);

console.log(`\n🎉 總計升級：${choiceFixed + lockFixed + gpsFixed} 頁\n`);

await client.end();
