#!/usr/bin/env node
// 📊 CI 檢核：元件 → 五大情境 mapping（W3 / 2026-05-14）
//
// 紅線 #11：「新元件必須對應五大商業情境之一」
// 用法：
//   node scripts/check-component-scenarios.mjs              # 警告模式（exit 0）
//   node scripts/check-component-scenarios.mjs --strict    # 紅燈模式（exit 1）
//
// 預設先警告（W3 初期），未來轉 --strict 自動觸發
//
// 對應計畫：docs/changes/2026-05-14-platform-optimization-comprehensive.md (W3)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const strict = process.argv.includes("--strict");

// 1. 從 multiplayer-component-types.ts 提取已知 componentType
function extractKnownComponentTypes() {
  const file = join(root, "shared", "multiplayer-component-types.ts");
  const text = readFileSync(file, "utf-8");
  const types = new Set();
  // 抓 export const xxx = [ "type1", "type2", ... ]
  const arrayRegex = /export const (?:SHARED_COMPONENTS|SOLO_ONLY_COMPONENTS|MULTI_ONLY_COMPONENTS|HOST_ONLY_COMPONENTS)\s*=\s*\[([^\]]+)\]/g;
  let m;
  while ((m = arrayRegex.exec(text))) {
    const items = m[1].matchAll(/"([^"]+)"/g);
    for (const item of items) types.add(item[1]);
  }
  return Array.from(types).sort();
}

// 2. 從 component-scenarios.ts 提取已標註 mapping
function extractMappedComponentTypes() {
  const file = join(root, "shared", "component-scenarios.ts");
  const text = readFileSync(file, "utf-8");
  const mappedSection = text.split("COMPONENT_SCENARIOS")[1] ?? "";
  const types = new Set();
  // 抓 key（identifier 或 quoted）: [
  const keyRegex = /^\s+(\w+):\s*\[/gm;
  let m;
  while ((m = keyRegex.exec(mappedSection))) {
    types.add(m[1]);
  }
  return Array.from(types).sort();
}

console.log("🔍 元件 → 情境 mapping 檢核");
console.log("─".repeat(50));

const known = extractKnownComponentTypes();
const mapped = extractMappedComponentTypes();

console.log(`已知元件總數: ${known.length}`);
console.log(`已標註情境: ${mapped.length}`);

const knownSet = new Set(known);
const mappedSet = new Set(mapped);

// missing: 已知但未標註
const missing = known.filter((t) => !mappedSet.has(t));
// orphan: 標註了但已知清單沒有（可能拼錯）
const orphan = mapped.filter((t) => !knownSet.has(t));

console.log();

if (missing.length > 0) {
  console.log(`⚠️  ${missing.length} 個已知元件缺情境標註：`);
  for (const t of missing) console.log(`   - ${t}`);
  console.log();
  console.log("   修補：在 shared/component-scenarios.ts 的 COMPONENT_SCENARIOS 加入對應");
  console.log();
}

if (orphan.length > 0) {
  console.log(`⚠️  ${orphan.length} 個情境標註找不到對應元件（可能拼錯或元件已移除）：`);
  for (const t of orphan) console.log(`   - ${t}`);
  console.log();
}

if (missing.length === 0 && orphan.length === 0) {
  console.log("✅ mapping 完整、所有元件都標註情境");
  process.exit(0);
}

// W3 初期：警告模式 exit 0
if (!strict) {
  console.log("⚠️  目前為警告模式（exit 0）。完成全部標註後可改 --strict 觸發紅燈。");
  process.exit(0);
}

console.log("❌ 紅燈：strict 模式下不允許缺少情境標註");
process.exit(1);
