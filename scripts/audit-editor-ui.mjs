import { chromium } from "/Users/hung-macmini/projects/數位遊戲平台/node_modules/playwright/index.mjs";
import fs from "fs";

const firebaseApiKey = fs
  .readFileSync("/Users/hung-macmini/projects/數位遊戲平台/.env", "utf-8")
  .match(/VITE_FIREBASE_API_KEY="([^"]+)"/)[1];

// 先拿 idToken 後用 localStorage 注入（跳過 Google popup）
const customTokenRes = await fetch("http://localhost:3333/api/dev/custom-token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "twfam1@gmail.com" }),
});
const { customToken } = await customTokenRes.json();

const idTokenRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  },
);
const { idToken, localId } = await idTokenRes.json();

// 換 admin token cookie
const adminLoginRes = await fetch("http://localhost:3333/api/admin/firebase-login", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
  body: JSON.stringify({}),
});
const setCookie = adminLoginRes.headers.get("set-cookie");
const adminToken = setCookie.match(/adminToken=([^;]+)/)[1];

console.log("✅ 已取得 adminToken");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies([
  {
    name: "adminToken",
    value: adminToken,
    url: "http://localhost:3333",
    httpOnly: true,
    sameSite: "Lax",
  },
]);

const page = await context.newPage();
const report = [];
page.on("pageerror", (err) => console.log(`[ERROR] ${err.message}`));

// 測試列表
const PAGE_TYPES = [
  "text_card", "dialogue", "video", "button",
  "text_verify", "choice_verify", "conditional_verify",
  "qr_scan", "gps_mission", "photo_mission",
  "shooting_mission", "motion_challenge",
  "time_bomb", "lock", "vote", "flow_router",
];

console.log("\n🌐 進入遊戲編輯器（測試用：賈村保衛戰）");
await page.goto("http://localhost:3333/admin/games/jiachun-defense-battle", {
  waitUntil: "networkidle",
  timeout: 30000,
});
await page.waitForTimeout(2000);
console.log(`URL: ${page.url()}`);

// 找「新增頁面」按鈕
console.log("\n📋 遊戲編輯器測試中...");
const addBtn = page.locator('[data-testid^="button-add-page"]').first();
const addCount = await addBtn.count();
if (addCount > 0) {
  console.log("  ✓ 找到新增頁面按鈕");
} else {
  console.log("  ❌ 找不到新增頁面按鈕");
}

// 檢查 pageType 選單是否都有
const pageTypeSelector = await page.evaluate(() => {
  const selects = document.querySelectorAll('[role="combobox"], select');
  return Array.from(selects).map((s) => s.getAttribute("data-testid") || s.className.substring(0, 50));
});
console.log(`  找到 ${pageTypeSelector.length} 個 select/combobox`);

// 掃描頁面編輯區，看各 pageType editor 是否 render
console.log("\n🧪 檢查既有頁面的編輯器 render 狀況");
for (const type of PAGE_TYPES) {
  // 看頁面上有沒有該 pageType 的 edit ui
  const sel = `[data-testid*="${type}"]`;
  const count = await page.locator(sel).count();
  report.push({ type, editorElements: count });
}

// 快照遊戲編輯頁內容
const editorText = await page.locator("body").innerText();
console.log(`\n遊戲編輯頁總內容字數：${editorText.length}`);

// 測 /admin/templates
console.log("\n🌐 進入 /admin/templates");
await page.goto("http://localhost:3333/admin/templates", {
  waitUntil: "networkidle",
  timeout: 30000,
});
await page.waitForTimeout(3000);
console.log(`URL: ${page.url()}`);
const templatesText = await page.locator("body").innerText();
console.log(`Templates 頁內容：${templatesText.substring(0, 300)}`);

await browser.close();

console.log("\n\n📊 報告：");
report.forEach((r) => console.log(`  ${r.type}: 找到 ${r.editorElements} 個相關元素`));
