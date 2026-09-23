// 🔒 守護棘輪：原生 confirm / prompt 只能變少，不能變多
//
// 背景（通盤規劃 P4 防呆）：原生對話框不能寫清楚影響範圍、手機體驗差、也無法自動測試，
//   目標是全部換成 AlertDialog / 原因輸入框。P4 會一次清掉，這支先把數字鎖住：
//   新程式碼再加一個就會紅 —— 這就是「棘輪」，只能往好的方向轉。
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/** 目前殘留數（2026-09-23 基準）。清掉幾個就把數字改小，永遠不准調大。 */
const BASELINE = 7;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : walk(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

function findNativeDialogs(): { file: string; line: string }[] {
  const hits: { file: string; line: string }[] = [];
  for (const file of walk(join(process.cwd(), "client/src"))) {
    readFileSync(file, "utf-8").split("\n").forEach((line) => {
      if (/window\.(confirm|prompt)\s*\(/.test(line)) {
        hits.push({ file: file.split("/client/src/")[1], line: line.trim().slice(0, 80) });
      }
    });
  }
  return hits;
}

describe("防呆守護：原生對話框", () => {
  it(`window.confirm / window.prompt 不得多於基準 ${BASELINE} 處（新程式請用 AlertDialog）`, () => {
    const hits = findNativeDialogs();
    expect(
      hits.length,
      `目前 ${hits.length} 處：\n${hits.map((h) => `  ${h.file} — ${h.line}`).join("\n")}`,
    ).toBeLessThanOrEqual(BASELINE);
  });

  it("基準沒有過時（清掉之後請把 BASELINE 調小）", () => {
    // 殘留數明顯低於基準時提醒更新數字，避免棘輪鬆掉
    expect(findNativeDialogs().length).toBeGreaterThan(BASELINE - 3);
  });
});
