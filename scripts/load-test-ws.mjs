#!/usr/bin/env node
/**
 * 🔬 WebSocket 壓測 — 量出單機能撐多少人（2026-08-05）
 *
 * 為什麼要有這支：ADR-0023 把 CLUSTER_WORKERS 設為 0（單進程），當時的判斷是
 * 「場域型平台幾十~百級在線綽綽有餘」，但從來沒有人實際量過極限。要辦上百人
 * 活動之前，先量出數字，才不會花大錢解決不存在的問題。
 *
 * 特別關注兩件事：
 *   1. 廣播扇出 —— 100 人同隊時，一個動作要寫 100 次 socket，這通常才是真瓶頸
 *   2. team_join 的 DB 寫入 —— revokeAutoLeave 讓每次進場多一次 UPDATE，
 *      上百人同時進場等於上百次 UPDATE，必須確認不會塞住
 *
 * 用法：
 *   node --env-file=.env scripts/load-test-ws.mjs --clients 100 --teams 20
 *   node --env-file=.env scripts/load-test-ws.mjs --clients 100 --teams 1   # 單一大隊，扇出最大
 *   node --env-file=.env scripts/load-test-ws.mjs --steps                   # 階梯加壓 50/100/200/500
 *
 * ⚠️ 預設打本機 ws://localhost:3333，不會碰生產。要打其他目標請帶 --url。
 */

import WebSocket from "ws";
import pg from "pg";

// ── 參數 ─────────────────────────────────────────
const args = process.argv.slice(2);
const argVal = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const hasFlag = (name) => args.includes(`--${name}`);

const URL = argVal("url", "ws://localhost:3333/ws");
const STEPS_MODE = hasFlag("steps");
const HOLD_MS = Number(argVal("hold", 15000));
const MSG_INTERVAL_MS = Number(argVal("interval", 1000));

const PREFIX = "__lt__";

// ── 工具 ─────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length * p) / 100))];
};
const fmt = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");

// ── DB fixtures ──────────────────────────────────
async function setupFixtures(pool, teamCount, clientCount) {
  const q = (s, p) => pool.query(s, p);
  await teardownFixtures(pool);

  await q(`INSERT INTO fields (id,name,code) VALUES ($1,'壓測場域','LTTEST')`, [`${PREFIX}field`]);
  await q(
    `INSERT INTO games (id,title,field_id,status) VALUES ($1,'壓測遊戲',$2,'published')`,
    [`${PREFIX}game`, `${PREFIX}field`],
  );

  // users
  const userValues = [];
  const userParams = [];
  for (let i = 0; i < clientCount; i++) {
    userParams.push(`${PREFIX}u${i}`, `lt${i}@loadtest.local`);
    userValues.push(`($${userParams.length - 1},$${userParams.length})`);
  }
  await q(`INSERT INTO users (id,email) VALUES ${userValues.join(",")}`, userParams);

  // teams
  for (let t = 0; t < teamCount; t++) {
    await q(
      `INSERT INTO teams (id,game_id,name,access_code,status) VALUES ($1,$2,$3,$4,'playing')`,
      [`${PREFIX}t${t}`, `${PREFIX}game`, `壓測隊${t}`, `LT${String(t).padStart(4, "0")}`],
    );
  }

  // members
  const memValues = [];
  const memParams = [];
  for (let i = 0; i < clientCount; i++) {
    memParams.push(`${PREFIX}t${i % teamCount}`, `${PREFIX}u${i}`);
    memValues.push(`($${memParams.length - 1},$${memParams.length})`);
  }
  await q(`INSERT INTO team_members (team_id,user_id) VALUES ${memValues.join(",")}`, memParams);
}

async function teardownFixtures(pool) {
  const q = (s) => pool.query(s);
  await q(`DELETE FROM team_members WHERE user_id LIKE '${PREFIX}%'`);
  await q(`DELETE FROM teams WHERE id LIKE '${PREFIX}%'`);
  await q(`DELETE FROM games WHERE id LIKE '${PREFIX}%'`);
  await q(`DELETE FROM users WHERE id LIKE '${PREFIX}%'`);
  await q(`DELETE FROM fields WHERE id LIKE '${PREFIX}%'`);
}

// ── 單輪壓測 ──────────────────────────────────────
async function runRound(pool, clientCount, teamCount) {
  await setupFixtures(pool, teamCount, clientCount);

  const sockets = [];
  const joinLatencies = [];
  const bcastLatencies = [];
  let received = 0;
  let errors = 0;
  let closedUnexpectedly = 0;

  // 連線 + join（量 join 到收到自己 join 回應/廣播的時間）
  const connectStart = Date.now();
  await Promise.all(
    Array.from({ length: clientCount }, (_, i) => {
      return new Promise((resolve) => {
        const teamId = `${PREFIX}t${i % teamCount}`;
        const sessionId = `${PREFIX}s${i % teamCount}`;
        const userId = `${PREFIX}u${i}`;
        const ws = new WebSocket(URL);
        const t0 = Date.now();
        let joined = false;

        ws.on("open", () => {
          // team_join：測 team 廣播扇出 + revokeAutoLeave 的 DB UPDATE
          ws.send(JSON.stringify({ type: "team_join", teamId, userId, userName: `壓測${i}` }));
          // join session：game_update 走 session 廣播，用來測持續高頻扇出
          //（team_location / team_chat 都要 Firebase 認證，壓測拿不到真 token）
          ws.send(JSON.stringify({ type: "join", sessionId, userId, userName: `壓測${i}` }));
        });
        ws.on("message", (raw) => {
          received++;
          let msg;
          try { msg = JSON.parse(raw.toString()); } catch { return; }
          if (!joined) {
            joined = true;
            joinLatencies.push(Date.now() - t0);
            resolve();
          }
          // 廣播延遲：訊息帶 sentAt 就能算單程時間
          if (msg?.payload?.sentAt) bcastLatencies.push(Date.now() - msg.payload.sentAt);
        });
        ws.on("error", () => { errors++; resolve(); });
        ws.on("close", () => { if (joined) closedUnexpectedly++; });
        sockets.push({ ws, teamId, sessionId, userId });

        // 沒收到任何訊息也要放行，避免整輪卡住
        setTimeout(() => { if (!joined) { joined = true; resolve(); } }, 10000);
      });
    }),
  );
  const connectMs = Date.now() - connectStart;

  // 持續互動：每個 client 週期性送訊息 → 觸發同隊廣播
  const timers = sockets.map(({ ws, sessionId }, i) =>
    setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({
        type: "game_update",
        sessionId,
        payload: { sentAt: Date.now(), seq: i },
      }));
    }, MSG_INTERVAL_MS + (i % 10) * 20), // 錯開避免同一毫秒全部送出
  );

  await sleep(HOLD_MS);
  timers.forEach(clearInterval);

  const alive = sockets.filter((s) => s.ws.readyState === WebSocket.OPEN).length;
  sockets.forEach((s) => s.ws.close());
  await sleep(500);
  await teardownFixtures(pool);

  return {
    clientCount, teamCount, connectMs, alive, errors, closedUnexpectedly, received,
    joinP50: pct(joinLatencies, 50), joinP95: pct(joinLatencies, 95), joinMax: Math.max(0, ...joinLatencies),
    bcastP50: pct(bcastLatencies, 50), bcastP95: pct(bcastLatencies, 95),
    bcastSamples: bcastLatencies.length,
  };
}

function printRow(r) {
  const shape = r.teamCount === 1 ? `1隊×${r.clientCount}人` : `${r.teamCount}隊×${Math.round(r.clientCount / r.teamCount)}人`;
  console.log(
    `${String(r.clientCount).padStart(4)} 連線 | ${shape.padEnd(12)} | ` +
    `建連 ${String(r.connectMs).padStart(5)}ms | ` +
    `join p50/p95 ${String(r.joinP50).padStart(4)}/${String(r.joinP95).padStart(5)}ms | ` +
    `廣播 p50/p95 ${String(r.bcastP50).padStart(4)}/${String(r.bcastP95).padStart(5)}ms | ` +
    `存活 ${r.alive}/${r.clientCount} | 錯誤 ${r.errors} | 收訊 ${r.received}`,
  );
}

// ── 主流程 ────────────────────────────────────────
(async () => {
  if (!process.env.DATABASE_URL) {
    console.error("❌ 需要 DATABASE_URL（用 node --env-file=.env 執行）");
    process.exit(1);
  }
  if (!URL.includes("localhost") && !hasFlag("i-know-this-is-not-local")) {
    console.error(`❌ 目標不是 localhost（${URL}）。壓測非本機請加 --i-know-this-is-not-local`);
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log(`\n🔬 WS 壓測 → ${URL}`);
  console.log(`   每輪持續 ${HOLD_MS / 1000}s、每 client 每 ${MSG_INTERVAL_MS}ms 送一則\n`);

  const results = [];
  try {
    if (STEPS_MODE) {
      // 階梯加壓，兩種扇出型態各跑一次
      for (const n of [50, 100, 200, 500]) {
        console.log(`── ${n} 連線 ──`);
        results.push(await runRound(pool, n, Math.max(1, Math.round(n / 5)))); // N隊×5人
        printRow(results.at(-1));
        results.push(await runRound(pool, n, 1));                              // 1隊×N人
        printRow(results.at(-1));
        console.log("");
      }
    } else {
      const clients = Number(argVal("clients", 100));
      const teams = Number(argVal("teams", 20));
      results.push(await runRound(pool, clients, teams));
      printRow(results.at(-1));
    }
  } finally {
    await teardownFixtures(pool).catch(() => {});
    await pool.end();
  }

  // 判讀提示
  console.log("\n── 判讀 ──");
  const worst = results.reduce((a, b) => (b.bcastP95 > a.bcastP95 ? b : a), results[0]);
  console.log(`最差廣播 p95：${worst.bcastP95}ms（${worst.clientCount} 連線 / ${worst.teamCount} 隊）`);
  const lost = results.filter((r) => r.alive < r.clientCount);
  if (lost.length) {
    console.log(`⚠️ 有掉線：${lost.map((r) => `${r.clientCount}連線掉${r.clientCount - r.alive}`).join("、")}`);
  } else {
    console.log("✅ 全程無非預期掉線");
  }
  console.log("（廣播 p95 > 1000ms 或開始掉線 = 該規模已超過單機舒適區）\n");
})();
