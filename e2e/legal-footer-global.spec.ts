/**
 * 全站宣告 footer 守護測試（CHITO c45e8915）
 * 需求：每一頁底部都要有五份宣告連結；沉浸式全螢幕頁除外。
 */
import { test, expect } from "@playwright/test";

/** 應該要有 footer 的頁面 */
const PAGES_WITH_FOOTER = [
  "/",
  "/f/HPSPACE",
  "/f/HPSPACE/home",
  "/f/HPSPACE/leaderboard",
  "/home",
  "/leaderboard",
  "/template-market",
  "/legal",
  "/legal/privacy",
  "/faq",
  "/pricing",
  "/admin/login",
];

/** 沉浸式頁面 — 不應該有 footer（底部是操作區） */
// 註：/pos/scan 等需登入頁未登入會轉址，路徑排除規則改由單元測試涵蓋
//     （client/src/components/__tests__/GlobalLegalFooter.test.ts）
const PAGES_WITHOUT_FOOTER = [
  "/game/67764841-cf7d-47d9-984f-17a973188bcf",
  "/f/HPSPACE/game/67764841-cf7d-47d9-984f-17a973188bcf",
  "/map/67764841-cf7d-47d9-984f-17a973188bcf",
];

for (const path of PAGES_WITH_FOOTER) {
  test(`宣告 footer 出現於 ${path}`, async ({ page }) => {
    await page.goto(path);
    const footer = page.getByTestId("legal-footer");
    await expect(footer).toBeAttached({ timeout: 15_000 });
    // 五份宣告連結齊全
    for (const label of ["使用條款", "隱私權政策", "免責聲明", "活動風險", "版權聲明"]) {
      await expect(footer.getByRole("link", { name: label })).toBeAttached();
    }
  });
}

for (const path of PAGES_WITHOUT_FOOTER) {
  test(`沉浸式頁面不掛 footer：${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("legal-footer")).toHaveCount(0);
  });
}
