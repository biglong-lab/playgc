// 訪客 demo 沙盒 — 可 demo 情境不變式（2026-07-05）
//
// demo 端點 POST /api/scenarios/:id/demo 只允許「全 host 情境」（免登入即玩）；
// 含 multi/shared 元件的情境需登入組隊、回 400 not_demoable。
// 此測試鎖住「哪些情境可匿名 demo」的安全決策——端點用同一 predicate
// (components.every axis==="host")，情境資料若被改動導致 multi 情境變成可 demo，這裡會擋下。
import { describe, it, expect } from "vitest";
import { SCENARIO_TEMPLATES } from "@shared/scenario-templates";

/** 與 demo 端點一致的可 demo 判斷 */
function isDemoable(scenarioId: string): boolean {
  const s = SCENARIO_TEMPLATES.find((x) => x.id === scenarioId);
  return !!s && s.components.every((c) => c.axis === "host");
}

describe("demo 可用情境不變式", () => {
  it("恰有 6 個全 host 情境可 demo，且為預期清單", () => {
    const demoable = SCENARIO_TEMPLATES.filter((s) => s.components.every((c) => c.axis === "host"))
      .map((s) => s.id)
      .sort();
    expect(demoable).toEqual(
      ["awards-ceremony", "birthday", "carnival-stage", "icebreaker", "reunion", "wedding"].sort(),
    );
  });

  it("含 multi/shared 元件的情境不可 demo（如 corporate-training / venue-storyline）", () => {
    expect(isDemoable("corporate-training")).toBe(false);
    expect(isDemoable("venue-storyline")).toBe(false);
    expect(isDemoable("street-walk")).toBe(false);
  });

  it("未知情境不可 demo", () => {
    expect(isDemoable("no-such-scenario")).toBe(false);
  });

  it("每個可 demo 情境至少含 1 個元件（不會建出空遊戲）", () => {
    const demoable = SCENARIO_TEMPLATES.filter((s) => s.components.every((c) => c.axis === "host"));
    for (const s of demoable) {
      expect(s.components.length).toBeGreaterThan(0);
    }
  });
});
