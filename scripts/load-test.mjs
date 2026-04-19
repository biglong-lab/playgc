#!/usr/bin/env node
/**
 * 500 人規模壓測腳本（純 Node.js，無外部依賴）
 *
 * 模擬目標：
 * - N 個並發「玩家」持續打 API
 * - 每玩家輪詢 /api/health 確認連線，並觀察後端 DB pool 狀態
 * - 測完顯示 p50/p95/p99 延遲、成功率、server-side DB pool 使用率
 *
 * 使用：
 *   node scripts/load-test.mjs --url https://game.homi.cc --users 200 --duration 30
 *   node scripts/load-test.mjs --url https://game.homi.cc --users 500 --duration 60
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith("--")) acc.push([arg.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const URL = args.url || "https://game.homi.cc";
const USERS = Number(args.users) || 100;
const DURATION = Number(args.duration) || 30; // 秒
const ENDPOINT = args.endpoint || "/api/health";

console.log(`\n🚀 壓測開始`);
console.log(`  目標：${URL}${ENDPOINT}`);
console.log(`  並發：${USERS} 人`);
console.log(`  時長：${DURATION} 秒\n`);

// 每次請求的延遲記錄
const latencies = [];
let okCount = 0;
let errorCount = 0;
let rateLimitedCount = 0;
const startTime = Date.now();

async function singleRequest() {
  const t0 = Date.now();
  try {
    const res = await fetch(URL + ENDPOINT);
    const latency = Date.now() - t0;
    latencies.push(latency);
    if (res.status === 200) okCount++;
    else if (res.status === 429) rateLimitedCount++;
    else errorCount++;
  } catch (err) {
    errorCount++;
  }
}

/** 一個「玩家」在壓測期間持續打 API */
async function simulatePlayer() {
  const endAt = startTime + DURATION * 1000;
  while (Date.now() < endAt) {
    await singleRequest();
    // 模擬玩家間隔（避免過度聚集在同一秒）
    await new Promise((r) => setTimeout(r, Math.random() * 100 + 50));
  }
}

/** 定期打印進度 + DB pool 狀態 */
async function monitor() {
  const endAt = startTime + DURATION * 1000;
  let lastCount = 0;
  while (Date.now() < endAt) {
    await new Promise((r) => setTimeout(r, 5000));
    const rps = Math.round((okCount + errorCount - lastCount) / 5);
    lastCount = okCount + errorCount;

    // 抓 server DB pool 狀態
    let poolInfo = "";
    try {
      const r = await fetch(URL + "/api/health/detail");
      if (r.ok) {
        const d = await r.json();
        poolInfo = ` | DB pool: ${d.dbPool.total}/${d.dbPool.max} (${d.dbPool.waiting} waiting) | mem: ${Math.round(d.memory.rss / 1024 / 1024)}MB`;
      }
    } catch {}

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  [${elapsed}s] rps=${rps} ok=${okCount} 429=${rateLimitedCount} err=${errorCount}${poolInfo}`);
  }
}

/** 百分位計算 */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

async function main() {
  const players = Array.from({ length: USERS }, () => simulatePlayer());
  const monitoring = monitor();
  await Promise.all([...players, monitoring]);

  const elapsed = (Date.now() - startTime) / 1000;
  const total = okCount + errorCount + rateLimitedCount;
  const p50 = percentile(latencies, 0.5);
  const p95 = percentile(latencies, 0.95);
  const p99 = percentile(latencies, 0.99);
  const max = latencies.length ? Math.max(...latencies) : 0;

  console.log(`\n📊 結果`);
  console.log(`  總請求：${total}`);
  console.log(`  成功：${okCount} (${((okCount / total) * 100).toFixed(1)}%)`);
  console.log(`  Rate limited (429)：${rateLimitedCount}`);
  console.log(`  錯誤：${errorCount}`);
  console.log(`  平均 RPS：${(total / elapsed).toFixed(1)}`);
  console.log(`  延遲：p50=${p50}ms  p95=${p95}ms  p99=${p99}ms  max=${max}ms`);
  console.log(`  驗證：${okCount / total > 0.95 ? "✅ 成功率 > 95%" : "❌ 成功率 < 95%"}`);
  console.log(`       ${p95 < 1000 ? "✅ p95 < 1s" : "❌ p95 > 1s"}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("壓測失敗：", err);
  process.exit(1);
});
