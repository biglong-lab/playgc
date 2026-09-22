/**
 * 👥 組隊動線 e2e（2026-09-22 玩家動線優化）— 兩支手機、兩位訪客、真瀏覽器
 *
 *   1. 訪客 A 掃組隊遊戲 QR → 直達組隊大廳（自動訪客身分 + 自動暱稱）→ 建隊
 *   2. 訪客 B 開邀請連結（?code=）→ 組隊碼已預填 → 加入
 *   3. 只有隊長看得到「開始遊戲」，隊員看到等待提示
 *   4. 全員準備 → 隊長開始 → 3 秒倒數 → 兩人進到同一個共用場次
 *
 * 前置：server 啟用 ENABLE_E2E_HELPERS=true（_test API）
 */
import { test, expect, type Browser, type Page } from "@playwright/test";

async function newPhone(browser: Browser, baseURL: string | undefined, contextOptions: object): Promise<Page> {
  const ctx = await browser.newContext({ ...contextOptions, baseURL });
  return ctx.newPage();
}

test.describe.serial("組隊動線：兩位訪客免登入組隊開賽", () => {
  let gameId: string;
  let publicSlug: string;

  test.beforeAll(async ({ request }) => {
    const seed = await request.post("/api/_test/seed-multi-game");
    test.skip(seed.status() === 404 || !seed.ok(), "_test API 未啟用（需 ENABLE_E2E_HELPERS=true）");
    ({ gameId, publicSlug } = await seed.json());
  });

  test.afterAll(async ({ request }) => {
    if (gameId) await request.post(`/api/_test/cleanup/${gameId}`);
  });

  test("掃碼直達組隊大廳 → 建隊 / 邀請加入 → 隊長開始 → 同場進遊戲", async ({ browser, isMobile, baseURL }, testInfo) => {
    test.skip(!isMobile, "遊玩頁只開放手機 / 平板");
    test.setTimeout(120_000);
    const phone = testInfo.project.use;
    const leader = await newPhone(browser, baseURL, phone);
    const member = await newPhone(browser, baseURL, phone);

    let code = "";
    await test.step("訪客 A 掃 QR → 直達組隊大廳 → 建隊", async () => {
      await leader.goto(`/g/${publicSlug}`);
      await expect(leader).toHaveURL(new RegExp(`/team/${gameId}`), { timeout: 20_000 });
      await expect(leader.getByTestId("button-guest-name-chip")).toContainText(/探險家\d{4}/);
      await leader.getByRole("button", { name: "建立新隊伍" }).click();
      code = (await leader.getByTestId("text-access-code").textContent({ timeout: 15_000 }))?.trim() ?? "";
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    });

    await test.step("訪客 B 開邀請連結 → 組隊碼預填 → 加入", async () => {
      await member.goto(`/g/${publicSlug}?code=${code}`);
      await expect(member).toHaveURL(new RegExp(`/team/${gameId}\\?code=${code}`), { timeout: 20_000 });
      await expect(member.getByTestId("input-access-code")).toHaveValue(code);
      await member.getByTestId("button-confirm-join").click();
      await expect(member.getByTestId("text-access-code")).toHaveText(code, { timeout: 15_000 });
    });

    await test.step("只有隊長有開始鈕，隊員看到等待提示", async () => {
      await expect(member.getByTestId("button-start-game")).toHaveCount(0);
      await expect(member.getByTestId("text-wait-leader-start")).toBeVisible();
      await expect(leader.getByTestId("button-start-game")).toBeVisible();
    });

    await test.step("全員準備 → 隊長開始 → 3 秒倒數 → 同一個共用場次", async () => {
      await leader.getByTestId("button-ready").click();
      await member.getByTestId("button-ready").click();
      const start = leader.getByTestId("button-start-game");
      await expect(start).toBeEnabled({ timeout: 15_000 });
      await start.click();
      await expect(leader.getByTestId("starting-countdown-seconds")).toHaveText(/^[1-3]$/, { timeout: 10_000 });

      await expect(leader).toHaveURL(/\/game\/.+\?session=/, { timeout: 15_000 });
      await expect(member).toHaveURL(/\/game\/.+\?session=/, { timeout: 15_000 });
      const sid = (p: Page) => new URL(p.url()).searchParams.get("session");
      expect(sid(leader)).toBeTruthy();
      expect(sid(leader)).toBe(sid(member));
    });

    await leader.context().close();
    await member.context().close();
  });
});
