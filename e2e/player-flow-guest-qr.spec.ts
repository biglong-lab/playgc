/**
 * 🎟️ 玩家動線 e2e（2026-09-22 玩家動線優化）— 真瀏覽器、手機、完整流程
 *
 *   1. 未登入掃 QR（/g/:slug）→ 直接進第一關（無登入牆、無繼續框、背景自動訪客身分）
 *   2. 走完全部關卡 → 結算畫面出現「保存這次紀錄」
 *   3. 按「登入保存紀錄」→ 以正式帳號登入（模擬 LINE 跳頁回到原本的結算頁 #lineToken）
 *      → 先保存再進頁面 → 顯示原本的結算畫面（不多開新局）→ 以正式帳號查詢，這場紀錄在他名下
 *
 * 前置：
 *   - server 啟用 ENABLE_E2E_HELPERS=true（_test API）
 *   - 步驟 3 需 E2E_CLAIM_EMAIL（本地 Firebase 已存在的帳號，用 /api/dev/custom-token 取 token）；
 *     未設定時只跑步驟 1–2
 *
 * 本機執行：
 *   E2E_CLAIM_EMAIL=you@example.com npx playwright test e2e/player-flow-guest-qr.spec.ts --project="Mobile Pixel 5"
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const CLAIM_EMAIL = process.env.E2E_CLAIM_EMAIL;

function readFirebaseApiKey(): string | null {
  if (process.env.VITE_FIREBASE_API_KEY) return process.env.VITE_FIREBASE_API_KEY;
  try {
    const env = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf-8");
    return env.match(/VITE_FIREBASE_API_KEY="?([^"\n]+)"?/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** 走完測試遊戲：text_card → text_card → choice_verify → text_card → text_card */
async function playThrough(page: Page) {
  const main = page.locator("main.game-prose");
  for (let step = 0; step < 10; step++) {
    if (await page.getByText("任務完成").count()) return;
    const confirm = main.getByRole("button", { name: "確認選擇" });
    if (await confirm.isVisible().catch(() => false)) {
      await main.getByRole("button", { name: "正確", exact: true }).click();
      await confirm.click();
    }
    const next = main.getByRole("button", { name: /繼續/ }).first();
    await next.waitFor({ state: "visible", timeout: 10_000 });
    await next.click();
    await page.waitForTimeout(600);
  }
}

test.describe.serial("玩家動線：免登入 QR 直達 → 通關 → 登入保存紀錄", () => {
  let gameId: string;
  let publicSlug: string;

  test.beforeAll(async ({ request }) => {
    const seed = await request.post("/api/_test/seed-game");
    test.skip(seed.status() === 404 || !seed.ok(), "_test API 未啟用（需 ENABLE_E2E_HELPERS=true）");
    ({ gameId, publicSlug } = await seed.json());
  });

  test.afterAll(async ({ request }) => {
    if (gameId) await request.post(`/api/_test/cleanup/${gameId}`);
  });

  test("訪客掃 QR 直達第一關、通關後可登入保存紀錄", async ({ page, request, isMobile }) => {
    test.skip(!isMobile, "遊玩頁只開放手機 / 平板（桌機由 DeviceGate 擋下）");
    test.setTimeout(120_000);

    await test.step("未登入掃 QR → 直接到第一關", async () => {
      await page.goto(`/g/${publicSlug}`);
      await expect(page.locator("main.game-prose")).toBeVisible({ timeout: 20_000 });
      await expect(page).toHaveURL(new RegExp(`/game/${gameId}$`)); // entry=qr 已移除
      await expect(page.getByText("此遊戲需登入")).toHaveCount(0);
      await expect(page.getByText("繼續上次")).toHaveCount(0);
      await expect(page.getByText("歡迎")).toBeVisible();
    });

    await test.step("走完所有關卡 → 結算畫面有「保存這次紀錄」", async () => {
      await playThrough(page);
      await expect(page.getByText("任務完成")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("save-record-card")).toBeVisible();
    });

    if (!CLAIM_EMAIL) {
      // 前半段（QR 直達 → 通關 → 保存卡）已驗證；沒有可用的正式帳號就到此為止
      test.info().annotations.push({ type: "note", description: "未設定 E2E_CLAIM_EMAIL，略過登入認領步驟" });
      return;
    }

    await test.step("按「登入保存紀錄」→ 登入框（不含訪客選項）", async () => {
      await page.getByTestId("button-save-record").click();
      await expect(page.getByRole("dialog").getByText("登入保存紀錄")).toBeVisible();
      await expect(page.getByTestId("button-guest-login")).toHaveCount(0);
    });

    const tokenRes = await request.post("/api/dev/custom-token", { data: { email: CLAIM_EMAIL } });
    expect(tokenRes.ok(), "取得開發用 custom token 失敗").toBeTruthy();
    const { customToken } = await tokenRes.json();

    await test.step("LINE 登入回到原頁（#lineToken）→ 自動保存 → 顯示原本的結算畫面", async () => {
      const gamePath = new URL(page.url()).pathname;
      // 真實 LINE 登入是從 LINE 網域整頁跳回；同網址只改 hash 不會重新載入 → 先離開再回來
      await page.goto("about:blank");
      await page.goto(`${gamePath}#lineToken=${encodeURIComponent(customToken)}`);
      await expect(page.getByText("紀錄已保存到你的帳號", { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText("任務完成")).toBeVisible({ timeout: 15_000 });
      // 已是正式帳號 → 不再顯示保存卡
      await expect(page.getByTestId("save-record-card")).toHaveCount(0);
    });

    await test.step("以正式帳號查詢：這場通關紀錄已在他名下", async () => {
      const apiKey = readFirebaseApiKey();
      test.skip(!apiKey, "讀不到 VITE_FIREBASE_API_KEY");
      const signIn = await request.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
        { data: { token: customToken, returnSecureToken: true } },
      );
      // signInWithCustomToken 的 REST 回應沒有 localId，用 idToken 查紀錄即可
      const { idToken } = await signIn.json();
      expect(idToken, "以 custom token 換 idToken 失敗").toBeTruthy();
      const sessions = await request.get("/api/sessions", { headers: { Authorization: `Bearer ${idToken}` } });
      const list = (await sessions.json()) as Array<{ gameId: string; status: string }>;
      const mine = list.filter((s) => s.gameId === gameId);
      expect(mine.some((s) => s.status === "completed")).toBe(true);
      expect(mine, "登入回來不該多開一場新局").toHaveLength(1);
    });
  });
});
