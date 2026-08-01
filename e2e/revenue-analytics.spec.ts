// 💰 營收分析儀表板 e2e — 真實瀏覽器跑完整流程
//
// 紅線：不可用單元測試替代 e2e。這裡實際開瀏覽器、載入頁面、
// 操作篩選與維度切換，並驗證畫面數字與 API 一致。
//
// 前置：本機需有 dev server（npm run dev，port 3333）與可用的 DATABASE_URL。

import { test, expect, type Page } from "@playwright/test";
import jwt from "jsonwebtoken";
import pg from "pg";

const FIELD_ID = "72cc204d-8481-4276-b913-0033d69bf654"; // JIACHUN
const ACCOUNT_ID = "8c551bbe-3d6f-42ea-9592-22a2ef515ffe";
const ROLE_ID = "6df784c6-1bfe-4f66-9972-3659498564e6";

const hasEnv = Boolean(process.env.DATABASE_URL && process.env.SESSION_SECRET);

let adminToken = "";
let sessionTag = "";

// ⚠️ 每個 worker 必須有自己的 session：Playwright 平行跑時，
//    共用同一筆 admin_sessions 會被先結束的 worker 在 afterAll 刪掉，
//    其餘 worker 隨即全部 401（單獨跑會過、一起跑就掛的典型症狀）。
test.beforeAll(async ({}, testInfo) => {
  if (!hasEnv) return;
  sessionTag = `e2e-revenue-w${testInfo.workerIndex}`;
  adminToken = jwt.sign(
    {
      sub: ACCOUNT_ID,
      fieldId: FIELD_ID,
      roleId: ROLE_ID,
      type: "admin",
      wi: testInfo.workerIndex, // 讓各 worker 的 token 不同，避免 unique 衝突
    },
    process.env.SESSION_SECRET as string,
    { expiresIn: "2h" },
  );
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`DELETE FROM admin_sessions WHERE user_agent = $1`, [sessionTag]);
  await pool.query(
    `INSERT INTO admin_sessions (admin_account_id, token, expires_at, user_agent)
     VALUES ($1, $2, now() + interval '2 hours', $3)`,
    [ACCOUNT_ID, adminToken, sessionTag],
  );
  await pool.end();
});

test.afterAll(async () => {
  if (!hasEnv || !sessionTag) return;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`DELETE FROM admin_sessions WHERE user_agent = $1`, [sessionTag]);
  await pool.end();
});

async function openDashboard(page: Page): Promise<void> {
  await page.context().addCookies([
    { name: "adminToken", value: adminToken, domain: "localhost", path: "/" },
  ]);
  await page.goto("/admin/revenue");
  await expect(page.getByTestId("kpi-net")).toBeVisible({ timeout: 15_000 });
}

test.describe("營收分析儀表板", () => {
  test.skip(!hasEnv, "需要 DATABASE_URL 與 SESSION_SECRET");

  test("載入後顯示 KPI、趨勢圖、維度排行與熱力圖", async ({ page }) => {
    await openDashboard(page);

    // KPI 四張卡都在，且淨收入是實際金額而非 0
    for (const id of ["kpi-net", "kpi-gross", "kpi-count", "kpi-avg"]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    const net = await page.getByTestId("kpi-net").innerText();
    expect(net).toMatch(/NT\$\s?[\d,]+/);
    expect(net).not.toContain("NT$ 0");

    // 三個圖表都渲染出來
    await expect(page.getByTestId("trend-chart")).toBeVisible();
    await expect(page.getByTestId("breakdown-chart")).toBeVisible();
    await expect(page.getByTestId("heatmap-grid")).toBeVisible();
    await expect(page.getByTestId("source-donut")).toBeVisible();

    // UnifiedAdminLayout 有自己的捲動容器，fullPage 只會截到視窗高度，
    // 所以逐個元件截圖，確保下半部圖表也真的被看過。
    await page.screenshot({ path: "test-results/revenue-01-top.png" });
    await page.getByTestId("trend-chart").scrollIntoViewIfNeeded();
    await page.getByTestId("trend-chart").screenshot({ path: "test-results/revenue-02-trend.png" });
    await page.getByTestId("heatmap-grid").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/revenue-03-mid.png" });
    await page.getByTestId("breakdown-chart").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/revenue-04-breakdown.png" });
  });

  test("切換快捷區間會更新網址與資料", async ({ page }) => {
    await openDashboard(page);
    await page.getByTestId("range-7d").click();
    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
    await expect(page.getByTestId("kpi-net")).toBeVisible();
  });

  test("維度切換：品項 → 付款方式", async ({ page }) => {
    await openDashboard(page);
    await expect(page.getByTestId("breakdown-chart")).toBeVisible();
    await page.getByTestId("dim-method").click();
    await expect(page.getByTestId("breakdown-chart")).toBeVisible();
    // 切到表格檢視應看得到中文付款方式標籤
    await page.getByTestId("toggle-breakdown-table").click();
    await expect(page.getByTestId("breakdown-table")).toContainText("現金");
  });

  test("趨勢圖可切換表格檢視（顏色不是唯一資訊來源）", async ({ page }) => {
    await openDashboard(page);
    await page.getByTestId("toggle-trend-table").click();
    const table = page.getByTestId("trend-table");
    await expect(table).toBeVisible();
    await expect(table).toContainText("淨收入");
    await expect(table).toContainText("現場收款");
  });

  test("畫面數字與 API 回傳一致", async ({ page }) => {
    await openDashboard(page);
    const url = new URL(page.url());
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const res = await page.request.get(
      `/api/revenue/analytics/summary?from=${from}&to=${to}&compare=prev`,
    );
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as { netCents: number; txCount: number };

    const expectedNet = `NT$ ${Math.round(json.netCents / 100).toLocaleString("en-US")}`;
    await expect(page.getByTestId("kpi-net")).toContainText(expectedNet);
    await expect(page.getByTestId("kpi-count")).toContainText(
      json.txCount.toLocaleString("en-US"),
    );
  });
});
