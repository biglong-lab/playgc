#!/usr/bin/env node
// 🩺 Phase 2 W8 D1 — Scenario Platform Smoke Test
//
// 用法：
//   BASE_URL=https://game.homi.cc node scripts/smoke-test-scenarios.mjs
//   BASE_URL=http://localhost:3333 node scripts/smoke-test-scenarios.mjs
//
// 驗證項目：
//   1. 公開頁全部 200（主頁 / pitch / find-scenario / template-market / 13 情境 / showcase / scenario-qr-print）
//   2. /api/scenarios/health 回應 OK + 含 13 情境
//   3. POST /api/admin/scenarios/:id/instantiate 回應 401（認證守衛正確）
//   4. 13 情境健康狀態（live / preview / planned）

const BASE_URL = process.env.BASE_URL || "https://game.homi.cc";
const COLOR = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

let pass = 0;
let fail = 0;
const failures = [];

function log(symbol, msg) {
  console.log(`${symbol} ${msg}`);
}

async function check(name, expectedStatus, fn) {
  try {
    const result = await fn();
    if (result.ok) {
      log(`${COLOR.green}✅${COLOR.reset}`, name);
      pass++;
    } else {
      log(`${COLOR.red}❌${COLOR.reset}`, `${name} — ${result.error}`);
      fail++;
      failures.push({ name, error: result.error });
    }
  } catch (err) {
    log(`${COLOR.red}❌${COLOR.reset}`, `${name} — exception: ${err.message}`);
    fail++;
    failures.push({ name, error: err.message });
  }
}

async function fetchUrl(url, options = {}) {
  const start = Date.now();
  const res = await fetch(url, options);
  const ms = Date.now() - start;
  return { res, ms };
}

async function checkStatus(url, expectedCode, options = {}) {
  const { res, ms } = await fetchUrl(url, options);
  if (res.status !== expectedCode) {
    return { ok: false, error: `expected ${expectedCode}, got ${res.status} (${ms}ms)` };
  }
  return { ok: true, ms };
}

// ════════ Section 1: 公開頁 ════════
const PUBLIC_PAGES = [
  "/",
  "/pitch",
  "/find-scenario",
  "/template-market",
  "/showcase",
  "/admin/scenario-qr-print",
  "/faq", // W17 D2
  "/roi", // W17 D3
];

const SCENARIO_IDS = [
  "wedding",
  "birthday",
  "reunion",
  "kids-adventure",
  "carnival-stage",
  "icebreaker",
  "awards-ceremony",
  "street-walk",
  "district-checkin",
  "corporate-training",
  "company-trip",
  "venue-storyline",
];

async function runSmokeTest() {
  console.log(`${COLOR.bold}🩺 Scenario Platform Smoke Test${COLOR.reset}`);
  console.log(`Base URL: ${COLOR.cyan}${BASE_URL}${COLOR.reset}`);
  console.log("");

  // 1. 公開頁
  console.log(`${COLOR.bold}── Section 1: 公開頁（${PUBLIC_PAGES.length}）──${COLOR.reset}`);
  for (const path of PUBLIC_PAGES) {
    await check(`GET ${path}`, 200, () => checkStatus(`${BASE_URL}${path}`, 200));
  }

  // 2. 13 情境詳情頁
  console.log(`${COLOR.bold}── Section 2: 13 情境詳情頁 ──${COLOR.reset}`);
  for (const id of SCENARIO_IDS) {
    await check(`GET /template-market/${id}`, 200, () =>
      checkStatus(`${BASE_URL}/template-market/${id}`, 200),
    );
  }

  // 3. Health endpoint
  console.log(`${COLOR.bold}── Section 3: Health endpoint ──${COLOR.reset}`);
  await check("GET /api/scenarios/health", 200, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/scenarios/health`);
    if (res.status !== 200) return { ok: false, error: `status ${res.status}` };
    const data = await res.json();
    if (data.status !== "ok") return { ok: false, error: "status field != ok" };
    if (data.total < 12) return { ok: false, error: `total ${data.total} < 12` };
    if (data.byStatus.live < 9) return { ok: false, error: `live ${data.byStatus.live} < 9` };
    return { ok: true };
  });

  // 4. POST instantiate 認證守衛
  console.log(`${COLOR.bold}── Section 4: POST instantiate 認證守衛 ──${COLOR.reset}`);
  for (const id of SCENARIO_IDS.slice(0, 3)) {
    await check(`POST /api/admin/scenarios/${id}/instantiate (401)`, 401, async () => {
      const { res } = await fetchUrl(
        `${BASE_URL}/api/admin/scenarios/${id}/instantiate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      if (res.status !== 401) {
        return { ok: false, error: `expected 401, got ${res.status}` };
      }
      return { ok: true };
    });
  }

  // 4b. POST ai-preview 認證守衛（W9 D1 新增）
  console.log(`${COLOR.bold}── Section 4b: POST ai-preview 認證守衛 ──${COLOR.reset}`);
  for (const id of ["wedding"]) {
    await check(`POST /api/admin/scenarios/${id}/ai-preview (401)`, 401, async () => {
      const { res } = await fetchUrl(
        `${BASE_URL}/api/admin/scenarios/${id}/ai-preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context: "test" }),
        },
      );
      if (res.status !== 401) {
        return { ok: false, error: `expected 401, got ${res.status}` };
      }
      return { ok: true };
    });
  }

  // 4c. GET stats 認證守衛（W9 D4 新增）
  console.log(`${COLOR.bold}── Section 4c: GET stats 認證守衛 ──${COLOR.reset}`);
  await check("GET /api/admin/scenarios/stats (401)", 401, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/admin/scenarios/stats`);
    if (res.status !== 401) {
      return { ok: false, error: `expected 401, got ${res.status}` };
    }
    return { ok: true };
  });

  // 4c2. GET quota 認證守衛（W10 D4 新增）
  await check("GET /api/admin/scenarios/quota (401)", 401, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/admin/scenarios/quota`);
    if (res.status !== 401) {
      return { ok: false, error: `expected 401, got ${res.status}` };
    }
    return { ok: true };
  });

  // 4c3. POST notify-line 認證守衛（W15 D2 新增）
  await check("POST /api/admin/scenarios/notify-line (401)", 401, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/admin/scenarios/notify-line`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status !== 401) {
      return { ok: false, error: `expected 401, got ${res.status}` };
    }
    return { ok: true };
  });

  // 4d. GET payments health（W10 D1 新增 — 公開、不需認證）
  console.log(`${COLOR.bold}── Section 4d: 付費系統健康檢查 ──${COLOR.reset}`);
  await check("GET /api/payments/health", 200, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/payments/health`);
    if (res.status !== 200) {
      return { ok: false, error: `expected 200, got ${res.status}` };
    }
    const data = await res.json();
    if (data.status !== "ok") return { ok: false, error: "status field != ok" };
    if (typeof data.recurTwConfigured !== "boolean") {
      return { ok: false, error: "missing recurTwConfigured field" };
    }
    if (typeof data.resendConfigured !== "boolean") {
      return { ok: false, error: "missing resendConfigured field (W10 D5)" };
    }
    return { ok: true };
  });

  // 4d2. Resend test endpoint（503 graceful when no key）
  await check("GET /api/payments/email/test（缺 to → 400 或 503）", 400, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/payments/email/test`);
    if (res.status !== 400 && res.status !== 503) {
      return { ok: false, error: `expected 400 or 503, got ${res.status}` };
    }
    return { ok: true };
  });

  // 4e. Pricing 公開頁（W10 D1）
  await check("GET /pricing", 200, () => checkStatus(`${BASE_URL}/pricing`, 200));

  // 4f. Recur.tw create-checkout（W10 D2 — 503 graceful 或 400 缺欄位）
  console.log(`${COLOR.bold}── Section 4f: Recur.tw endpoints ──${COLOR.reset}`);
  await check("POST /api/payments/recur/create-checkout（缺欄位 → 400 或 503）", 400, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/payments/recur/create-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // 接受 400（驗證失敗）或 503（key 未設）
    if (res.status !== 400 && res.status !== 503) {
      return { ok: false, error: `expected 400 or 503, got ${res.status}` };
    }
    return { ok: true };
  });

  // 5a. Public API v1（W11 D1）
  console.log(`${COLOR.bold}── Section 5a: Public API v1（W11 D1）──${COLOR.reset}`);
  await check("GET /api/v1/health", 200, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/v1/health`);
    if (res.status !== 200) return { ok: false, error: `expected 200, got ${res.status}` };
    const data = await res.json();
    if (data.version !== "v1") return { ok: false, error: "version != v1" };
    return { ok: true };
  });
  await check("GET /api/v1/scenarios（無 API key → 401）", 401, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/v1/scenarios`);
    if (res.status !== 401) return { ok: false, error: `expected 401, got ${res.status}` };
    const data = await res.json();
    if (!data.error?.code) return { ok: false, error: "missing error.code field" };
    return { ok: true };
  });
  await check("GET /api/v1/scenarios（無效 key → 401）", 401, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/v1/scenarios`, {
      headers: { Authorization: "Bearer ck_invalid_xxx" },
    });
    if (res.status !== 401) return { ok: false, error: `expected 401, got ${res.status}` };
    return { ok: true };
  });

  // 5b. Rate limit / Idempotency middleware 載入驗證（W11 D2）
  // 驗證：401 response 不會帶 X-RateLimit-Limit（middleware 順序正確、認證先行）
  await check("API key 失敗時不執行 rate-limit middleware（順序正確）", 401, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/v1/scenarios`, {
      headers: { Authorization: "Bearer ck_invalid_xxx" },
    });
    if (res.status !== 401) return { ok: false, error: `expected 401, got ${res.status}` };
    // 401 不該設 rate-limit header（rateLimit 只在 requireApiKey 通過後執行）
    if (res.headers.get("X-RateLimit-Limit")) {
      return { ok: false, error: "401 不該設 X-RateLimit-Limit header" };
    }
    return { ok: true };
  });

  // 5c. POST /api/v1/instances 認證守衛（W11 D3）
  await check("POST /api/v1/instances（無 key → 401）", 401, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/v1/instances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: "wedding" }),
    });
    if (res.status !== 401) return { ok: false, error: `expected 401, got ${res.status}` };
    return { ok: true };
  });

  // 5d. OpenAPI spec + Docs 頁（W11 D4）
  console.log(`${COLOR.bold}── Section 5d: API 文件（W11 D4）──${COLOR.reset}`);
  await check("GET /api/v1/openapi.json（公開）", 200, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/v1/openapi.json`);
    if (res.status !== 200) return { ok: false, error: `expected 200, got ${res.status}` };
    const data = await res.json();
    if (data.openapi !== "3.1.0") return { ok: false, error: "openapi version != 3.1.0" };
    if (!data.paths?.["/instances"]) return { ok: false, error: "missing /instances path" };
    return { ok: true };
  });
  await check("GET /api-docs", 200, () => checkStatus(`${BASE_URL}/api-docs`, 200));

  // 5e. /api/v1/keys/me（W12 D1，無 key → 401）
  console.log(`${COLOR.bold}── Section 5e: keys/me（W12 D1）──${COLOR.reset}`);
  await check("GET /api/v1/keys/me（無 key → 401）", 401, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/v1/keys/me`);
    if (res.status !== 401) return { ok: false, error: `expected 401, got ${res.status}` };
    return { ok: true };
  });

  // 5f. /api/v1/webhooks/test（W12 D4，無 key → 401）
  await check("POST /api/v1/webhooks/test（無 key → 401）", 401, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/v1/webhooks/test`, { method: "POST" });
    if (res.status !== 401) return { ok: false, error: `expected 401, got ${res.status}` };
    return { ok: true };
  });

  // 5g. LIFF 玩家入口（W14 D1）
  await check("GET /liff/play/test", 200, () => checkStatus(`${BASE_URL}/liff/play/test-w14`, 200));

  // 5j. Admin Pilot Health endpoint（W17 D4）
  console.log(`${COLOR.bold}── Section 5j: Admin Pilot Health（W17 D4）──${COLOR.reset}`);
  await check("GET /api/admin/pilot/health（無認證 → 401）", 401, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/admin/pilot/health`);
    if (res.status !== 401) {
      return { ok: false, error: `expected 401, got ${res.status}` };
    }
    return { ok: true };
  });

  // 5i. Cron endpoints（W16 D4）
  console.log(`${COLOR.bold}── Section 5i: Cron Endpoints（W16 D4）──${COLOR.reset}`);
  await check("GET /api/cron/health（公開、不洩漏 secret）", 200, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/cron/health`);
    if (res.status !== 200) return { ok: false, error: `expected 200, got ${res.status}` };
    const data = await res.json();
    if (data.status !== "ok") return { ok: false, error: "status != ok" };
    if (typeof data.cronSecretConfigured !== "boolean") {
      return { ok: false, error: "missing cronSecretConfigured" };
    }
    return { ok: true };
  });
  await check("POST /api/cron/check-expiring-sessions（無 token → 401 或 503）", 401, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/cron/check-expiring-sessions`, {
      method: "POST",
    });
    if (res.status !== 401 && res.status !== 503) {
      return { ok: false, error: `expected 401 or 503, got ${res.status}` };
    }
    return { ok: true };
  });
  await check("POST /api/cron/check-expiring-sessions（錯誤 token → 401 或 503）", 401, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/cron/check-expiring-sessions`, {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    });
    if (res.status !== 401 && res.status !== 503) {
      return { ok: false, error: `expected 401 or 503, got ${res.status}` };
    }
    return { ok: true };
  });

  // 5h. LINE Bot webhook health（W15 D1，公開）+ W15 D5 admin 認證 status
  console.log(`${COLOR.bold}── Section 5h: LINE Bot（W15 D1+D5）──${COLOR.reset}`);
  await check("GET /api/webhooks/line/health", 200, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/webhooks/line/health`);
    if (res.status !== 200) return { ok: false, error: `expected 200, got ${res.status}` };
    const data = await res.json();
    if (data.status !== "ok") return { ok: false, error: "status != ok" };
    if (typeof data.lineBotConfigured !== "boolean") {
      return { ok: false, error: "missing lineBotConfigured" };
    }
    return { ok: true };
  });
  await check("GET /api/webhooks/line/health 含 W15 D5 admin status", 200, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/webhooks/line/health`);
    const data = await res.json();
    if (typeof data.adminConfigured !== "boolean") {
      return { ok: false, error: "missing adminConfigured（W15 D5）" };
    }
    if (typeof data.adminCount !== "number") {
      return { ok: false, error: "missing adminCount（W15 D5）" };
    }
    if (typeof data.nluConfigured !== "boolean") {
      return { ok: false, error: "missing nluConfigured（W15 D5）" };
    }
    return { ok: true };
  });
  await check("POST /api/webhooks/line（無簽章 → 401 或 503）", 401, async () => {
    const { res } = await fetchUrl(`${BASE_URL}/api/webhooks/line`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    // 接受 401（無 secret）或 503（未配置）
    if (res.status !== 401 && res.status !== 503) {
      return { ok: false, error: `expected 401 or 503, got ${res.status}` };
    }
    return { ok: true };
  });

  // 5. host/play 路徑
  console.log(`${COLOR.bold}── Section 5: host / play SPA 路徑 ──${COLOR.reset}`);
  await check("GET /host/smoke-test", 200, () =>
    checkStatus(`${BASE_URL}/host/smoke-test`, 200),
  );
  await check("GET /play/smoke-test", 200, () =>
    checkStatus(`${BASE_URL}/play/smoke-test`, 200),
  );

  // ════════ 結果 ════════
  console.log("");
  console.log(`${COLOR.bold}── 結果 ──${COLOR.reset}`);
  console.log(`  ${COLOR.green}通過：${pass}${COLOR.reset}`);
  console.log(`  ${COLOR.red}失敗：${fail}${COLOR.reset}`);

  if (fail > 0) {
    console.log("");
    console.log(`${COLOR.bold}${COLOR.red}失敗清單：${COLOR.reset}`);
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
    process.exit(1);
  }

  console.log(`${COLOR.green}${COLOR.bold}🎉 全部通過${COLOR.reset}`);
  process.exit(0);
}

runSmokeTest().catch((err) => {
  console.error(`${COLOR.red}Fatal error:${COLOR.reset}`, err);
  process.exit(1);
});
