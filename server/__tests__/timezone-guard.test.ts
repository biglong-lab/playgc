// 🕐 時區寫法守門測試（不需 DB，純原始碼掃描）
//
// 背景：DB timezone 是 Etc/UTC，兩種時間欄位的 Taipei 營業日轉換法「不同」：
//   naive timestamp（存 UTC 值） → 必須雙層 (AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei')
//   timestamptz（自帶時區）      → 只能單層 (AT TIME ZONE 'Asia/Taipei')
// 混用會差一天。2026-08-01 實測：POS 每日報表因少一層，128 筆交易中有 9 筆
// （NT$12,530）被錯歸前一天。修好後加這個測試，避免同樣的寫法再長回來。

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** 存 naive timestamp 的欄位（drizzle 未加 withTimezone），必須雙層轉換 */
const NAIVE_COLUMNS = [
  "posTransactions.createdAt",
  "purchases.createdAt",
  "battleRegistrations.registeredAt",
];

/** 掃描範圍：所有會做營收/報表聚合的檔案 */
const FILES = [
  "server/routes/admin-pos-reports.ts",
  "server/routes/revenue.ts",
  "server/lib/revenue-facts.ts",
  "server/lib/revenue-aggregations.ts",
  "server/routes/revenue-analytics.ts",
];

function readSource(rel: string): string | null {
  const p = resolve(process.cwd(), rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

describe("時區寫法守門", () => {
  for (const file of FILES) {
    for (const col of NAIVE_COLUMNS) {
      it(`${file}：${col} 不得使用單層時區轉換`, () => {
        const src = readSource(file);
        if (src === null) return; // 檔案不存在就跳過，不製造假紅燈

        // 抓「${col} AT TIME ZONE 'Asia/Taipei'」但前面沒有先轉 UTC 的寫法
        const bad = new RegExp(
          `\\$\\{${col.replace(".", "\\.")}\\}\\s+AT TIME ZONE 'Asia/Taipei'`,
          "g",
        );
        const hits = src.match(bad) ?? [];
        expect(
          hits,
          `${col} 少了 UTC 那一層，Taipei 08:00–16:00 的資料會被錯歸前一天。` +
            `請改用 revenue-facts 的 taipeiBusinessDate() / taipeiLocalTime()`,
        ).toHaveLength(0);
      });
    }
  }

  it("正規化層本身用的是雙層轉換", () => {
    const src = readSource("server/lib/revenue-facts.ts");
    expect(src).toContain("AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Taipei'");
  });
});
