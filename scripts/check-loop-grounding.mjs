#!/usr/bin/env node
// 🔄 Loop 接地偵測（W3 / 2026-05-14）
//
// 紅線 #9（ADR-0017）：Loop 模式禁止連續 5 輪不做接地驗證
//
// 偵測邏輯：
//   - 掃最近 N 個 commit（預設 5）
//   - 若全部都是 chore(auto) / chore(checkpoint) → 提示太久沒實質提交
//   - 若 `.smoke-last-run` 超過 30 分鐘 → 提示該跑 smoke
//
// 用法：
//   node scripts/check-loop-grounding.mjs              # 警告模式（exit 0）
//   node scripts/check-loop-grounding.mjs --strict    # 紅燈模式（exit 1）
//
// 期望整合到 pre-push hook 或手動 loop 中段觸發
// 對應計畫：docs/changes/2026-05-14-platform-optimization-comprehensive.md (W3)

import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const strict = process.argv.includes("--strict");
const COMMIT_WINDOW = 5;
const SMOKE_STALE_MIN = 30;
const SMOKE_MARKER = join(root, ".smoke-last-run");

console.log("🔍 Loop 接地偵測");
console.log("─".repeat(50));

// 1. 取最近 N 個 commit 的 subject
let commitsRaw = "";
try {
  commitsRaw = execSync(`git log --oneline -n ${COMMIT_WINDOW}`, {
    cwd: root,
    encoding: "utf-8",
  });
} catch (err) {
  console.error("無法讀取 git log:", err.message);
  process.exit(strict ? 1 : 0);
}

const commits = commitsRaw.trim().split("\n").filter(Boolean);
const autoOrCheckpoint = commits.filter((line) =>
  /chore\((auto|checkpoint)\)/.test(line),
);

console.log(`最近 ${COMMIT_WINDOW} commit：${commits.length} 條`);
console.log(`其中 chore(auto/checkpoint)：${autoOrCheckpoint.length} 條`);

let warned = false;

if (autoOrCheckpoint.length === commits.length && commits.length > 0) {
  console.log();
  console.log("⚠️  最近 N commit 全是自動存檔，缺實質提交。");
  console.log("   建議：commit 一個明確的 feat/fix/chore + 跑 smoke");
  warned = true;
}

// 2. smoke marker stale check
if (existsSync(SMOKE_MARKER)) {
  const mtime = statSync(SMOKE_MARKER).mtime;
  const ageMin = Math.round((Date.now() - mtime.getTime()) / 60000);
  console.log();
  console.log(`smoke 上次通過：${ageMin} 分鐘前（${mtime.toISOString()}）`);
  if (ageMin > SMOKE_STALE_MIN) {
    console.log(`⚠️  超過 ${SMOKE_STALE_MIN} 分鐘 — 建議跑 node scripts/smoke-test-scenarios.mjs`);
    warned = true;
  }
} else {
  console.log();
  console.log(`⚠️  找不到 ${SMOKE_MARKER} — smoke 從未通過過或 marker 被清除`);
  console.log("   首次跑：node scripts/smoke-test-scenarios.mjs && touch .smoke-last-run");
  warned = true;
}

console.log();
if (!warned) {
  console.log("✅ Loop 接地驗證健康");
  process.exit(0);
}

if (!strict) {
  console.log("⚠️  目前為警告模式（exit 0）。");
  process.exit(0);
}

console.log("❌ 紅燈：strict 模式下接地不足");
process.exit(1);
