/**
 * 🏁 競賽 / 接力 e2e（2026-09-23 P1）— 兩支手機、兩位訪客、真瀏覽器、真資料庫
 *
 * 競賽（個人）：
 *   A 建賽事 → B 開分享連結（?code=）自動加入 → A 開賽 → 伺服器倒數 → 兩人進遊戲（賽事看板）
 *   → A 先玩完看到等待畫面 → B 玩完 → 伺服器自動結算 → 兩人都到結算頁（同分比完成速度）
 * 接力（依頁面分段）：
 *   4 頁分 2 棒 → A 第 1 棒只玩第 1–2 頁、B 等待 → A 完成自動交棒 → B 只玩第 3–4 頁 → 自動結算、全隊總分
 *
 * 前置：server 啟用 ENABLE_E2E_HELPERS=true（_test API）
 * 本機：ENABLE_E2E_HELPERS=true npm run dev；npx playwright test e2e/match-competitive-relay.spec.ts --project="Mobile Pixel 5"
 */
import { test, expect, type Browser, type Page } from "@playwright/test";

/** 本機跑很多容器時伺服器回應可能到數秒（開局 / 完成 / 輪詢），單步驟寬限放寬 */
const STEP_TIMEOUT = 60_000;

async function newPhone(browser: Browser, baseURL: string | undefined, contextOptions: object): Promise<Page> {
  const ctx = await browser.newContext({ ...contextOptions, baseURL });
  return ctx.newPage();
}

/** 在遊戲頁連續按「繼續」通過 n 關（每關出現的標題要符合 expectTitles） */
async function playPages(page: Page, expectTitles: string[]) {
  const main = page.locator("main.game-prose");
  for (const title of expectTitles) {
    await expect(main.getByText(title, { exact: true })).toBeVisible({ timeout: STEP_TIMEOUT });
    await main.getByRole("button", { name: /繼續/ }).first().click();
  }
}

async function seedMatchGame(request: import("@playwright/test").APIRequestContext, body: object) {
  const seed = await request.post("/api/_test/seed-match-game", { data: body });
  test.skip(seed.status() === 404 || !seed.ok(), "_test API 未啟用（需 ENABLE_E2E_HELPERS=true）");
  return (await seed.json()) as { gameId: string };
}

/** A 建賽事、B 用分享連結加入，回傳邀請碼 */
async function createAndJoin(host: Page, guest: Page, gameId: string): Promise<string> {
  await host.goto(`/match/${gameId}`);
  await host.getByTestId("button-create-match").click();
  const code = ((await host.getByTestId("text-match-code").textContent({ timeout: 15_000 })) ?? "").trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  await guest.goto(`/match/${gameId}?code=${code}`);
  await expect(guest.getByTestId("text-match-code")).toHaveText(code, { timeout: 15_000 });
  await expect(host.getByTestId("button-start-match")).toBeEnabled({ timeout: 10_000 });
  return code;
}

test.describe("競賽 / 接力：兩位訪客免登入", () => {
  const cleanup: string[] = [];

  test.afterAll(async ({ request }) => {
    if (process.env.KEEP_E2E_DATA === "1") return;
    for (const id of cleanup) await request.post(`/api/_test/cleanup/${id}`);
  });

  test("競賽：建賽 → 邀請加入 → 開賽 → 各自玩 → 自動結算排名", async ({ browser, isMobile, baseURL, request }, testInfo) => {
    test.skip(!isMobile, "遊玩頁只開放手機 / 平板");
    test.setTimeout(240_000);
    const { gameId } = await seedMatchGame(request, { mode: "competitive", pageCount: 3, matchConfig: { countdownSeconds: 1, minParticipants: 2 } });
    cleanup.push(gameId);
    const phone = testInfo.project.use;
    const a = await newPhone(browser, baseURL, phone);
    const b = await newPhone(browser, baseURL, phone);

    await test.step("A 建賽事、B 分享連結自動加入；非房主沒有開始鈕", async () => {
      await createAndJoin(a, b, gameId);
      await expect(b.getByTestId("button-start-match")).toHaveCount(0);
    });

    await test.step("A 開賽 → 兩人都進遊戲頁（?match=）且看到賽事看板", async () => {
      await a.getByTestId("button-start-match").click();
      for (const p of [a, b]) {
        await expect(p).toHaveURL(new RegExp(`/game/${gameId}\\?match=`), { timeout: STEP_TIMEOUT });
        await expect(p.getByTestId("match-hud")).toBeVisible({ timeout: 15_000 });
      }
    });

    await test.step("A 先玩完 → 等待畫面；B 玩完 → 自動結算、兩人到結算頁", async () => {
      await playPages(a, ["第 1 關", "第 2 關", "第 3 關"]);
      await expect(a.getByTestId("match-waiting-screen")).toBeVisible({ timeout: STEP_TIMEOUT });
      await expect(a.getByText("你完成了！")).toBeVisible();
      await playPages(b, ["第 1 關", "第 2 關", "第 3 關"]);
      for (const p of [a, b]) {
        await expect(p).toHaveURL(new RegExp(`/match/${gameId}\\?m=`), { timeout: STEP_TIMEOUT });
        await expect(p.getByText("賽事結束！")).toBeVisible({ timeout: 15_000 });
      }
      await expect(a.getByTestId("text-my-rank")).toHaveText("你是第 1 名");
      await expect(b.getByTestId("text-my-rank")).toHaveText("你是第 2 名");
    });

    await test.step("資料庫：賽事已結算、兩人 30 分、同分依完成先後排名", async () => {
      const matchId = new URL(a.url()).searchParams.get("m");
      const detail = await (await request.get(`/api/matches/${matchId}`)).json();
      expect(detail.status).toBe("finished");
      expect(detail.ranking.map((r: { score: number; rank: number; completed: boolean }) => [r.score, r.rank, r.completed]))
        .toEqual([[30, 1, true], [30, 2, true]]);
    });

    await a.context().close();
    await b.context().close();
  });

  test("接力：第 1 棒玩 1–2 頁 → 自動交棒 → 第 2 棒玩 3–4 頁 → 自動結算", async ({ browser, isMobile, baseURL, request }, testInfo) => {
    test.skip(!isMobile, "遊玩頁只開放手機 / 平板");
    test.setTimeout(240_000);
    const { gameId } = await seedMatchGame(request, {
      mode: "relay",
      pageCount: 4,
      matchConfig: { countdownSeconds: 1, relaySegments: [{ fromPage: 1, toPage: 2 }, { fromPage: 3, toPage: 4 }] },
    });
    cleanup.push(gameId);
    const phone = testInfo.project.use;
    const a = await newPhone(browser, baseURL, phone);
    const b = await newPhone(browser, baseURL, phone);

    await createAndJoin(a, b, gameId);
    await a.getByTestId("button-start-match").click();

    await test.step("開賽：A 是第 1 棒進遊戲；B 看到「你是第 2 棒（第 3–4 頁）」", async () => {
      await expect(a).toHaveURL(new RegExp(`/game/${gameId}\\?match=`), { timeout: STEP_TIMEOUT });
      await expect(b.getByText("你是第 2 棒（第 3–4 頁）")).toBeVisible({ timeout: STEP_TIMEOUT });
    });

    await test.step("A 只玩第 1–2 頁 → 完成自動交棒；B 自動開始、從第 3 關開始", async () => {
      await playPages(a, ["第 1 關", "第 2 關"]);
      await expect(a.getByText("你這一棒完成了！")).toBeVisible({ timeout: STEP_TIMEOUT });
      await playPages(b, ["第 3 關", "第 4 關"]);
    });

    await test.step("最後一棒完成 → 自動結算、全隊總分 40", async () => {
      for (const p of [a, b]) {
        await expect(p).toHaveURL(new RegExp(`/match/${gameId}\\?m=`), { timeout: STEP_TIMEOUT });
      }
      await expect(b.getByTestId("text-relay-total")).toHaveText("全隊總分 40", { timeout: 15_000 });
    });

    await a.context().close();
    await b.context().close();
  });
});
