// 🛡️ 守護測試：shared 的「可發佈頁面類型」清單必須跟玩家端渲染器完全一致
//   - 渲染器（GamePageRenderer + HostPageRenderer）的 switch case = 玩家實際看得到的元件
//   - 清單少了 → 合法遊戲發佈被誤擋；清單多了 → 玩家看到「未知頁面類型」
//   - 編輯器元件盒（PAGE_TYPES）裡的每一種都必須可發佈
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { PLAYABLE_PAGE_TYPES } from "@shared/lib/page-types";
import { PAGE_TYPES } from "@/pages/game-editor/constants";

const RENDERER_FILES = [
  "client/src/components/game/GamePageRenderer.tsx",
  "client/src/components/game/host/HostPageRenderer.tsx",
];

function rendererCaseTypes(): Set<string> {
  const types = new Set<string>();
  for (const file of RENDERER_FILES) {
    const src = fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
    for (const m of src.matchAll(/case\s+"([a-z0-9_]+)"/g)) types.add(m[1]);
  }
  return types;
}

describe("PLAYABLE_PAGE_TYPES 守護", () => {
  it("與渲染器 switch case 完全一致（新增元件要同步加進 shared/lib/page-types.ts）", () => {
    const rendered = [...rendererCaseTypes()].sort();
    expect([...PLAYABLE_PAGE_TYPES].sort()).toEqual(rendered);
  });

  it("編輯器元件盒的每種元件都可發佈", () => {
    const playable = new Set<string>(PLAYABLE_PAGE_TYPES);
    const missing = PAGE_TYPES.map((p) => p.value as string).filter((v) => !playable.has(v));
    expect(missing).toEqual([]);
  });
});
