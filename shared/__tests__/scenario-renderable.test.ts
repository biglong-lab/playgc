// 🛡️ 不變式測試：7 情境的每個元件 pageType 都必須有前端 renderer
//
// 背景（2026-06-13）：上一輪 loop 在 scenario-templates 塞了大量沒有 renderer 的
// 「幽靈元件」，玩家打開會看到「未知頁面類型」。瘦身後，此測試鎖死不變式：
//   SCENARIO_TEMPLATES 用到的每個 pageType 都能在 GamePageRenderer 找到對應 case。
//   再有人加幽靈元件，這裡就會紅。
//
// 📺 2026-09-25：大螢幕互動（host 軸）已移交 PhotoGo，情境模板不再含 host_* 元件，
//   只需對 GamePageRenderer 檢查（HostPageRenderer 隨 R3/R4 移除）。

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SCENARIO_TEMPLATES } from "../scenario-templates";

/** 從 renderer 原始碼抽出所有 `case "xxx"` 的 pageType */
function extractRenderableCases(relPath: string): Set<string> {
  const abs = resolve(process.cwd(), relPath);
  const src = readFileSync(abs, "utf8");
  const cases = [...src.matchAll(/case "([a-z0-9_]+)"/g)].map((m) => m[1]);
  return new Set(cases);
}

const RENDERABLE = extractRenderableCases("client/src/components/game/GamePageRenderer.tsx");

describe("情境元件可渲染性（防幽靈元件）", () => {
  it("renderer 至少涵蓋 60 種 pageType（基準線、避免抽取邏輯失效）", () => {
    expect(RENDERABLE.size).toBeGreaterThanOrEqual(60);
  });

  it("7 情境每個元件的 pageType 都有對應 renderer", () => {
    const offenders: string[] = [];
    for (const scenario of SCENARIO_TEMPLATES) {
      for (const c of scenario.components) {
        if (!RENDERABLE.has(c.pageType)) {
          offenders.push(`${scenario.id} → ${c.pageType} (${c.label})`);
        }
      }
    }
    expect(offenders, `以下元件無 renderer，玩家會看到「未知頁面類型」：\n${offenders.join("\n")}`).toEqual([]);
  });

  it("恰好 7 個情境（host 軸情境移交 PhotoGo 後）", () => {
    expect(SCENARIO_TEMPLATES.length).toBe(7);
  });

  it("每個情境至少有 1 個可運作元件", () => {
    for (const s of SCENARIO_TEMPLATES) {
      expect(s.components.length, `${s.id} 元件數`).toBeGreaterThanOrEqual(1);
    }
  });
});
