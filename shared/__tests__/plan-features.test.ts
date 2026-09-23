// 💳 方案功能目錄（前後端共用）
import { describe, it, expect } from "vitest";
import { PLAN_FEATURES, featureForModule, featureUpgradeMessage, getPlanFeature, planHasFeature } from "../lib/plan-features";
import { MODULE_KEYS } from "../lib/module-registry";

describe("方案功能目錄", () => {
  it("鍵不重複、都有名稱與說明", () => {
    const keys = PLAN_FEATURES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(PLAN_FEATURES.filter((f) => !f.label.trim() || !f.description.trim())).toEqual([]);
  });

  it("有對應模組的功能，模組必須真的存在於登錄表", () => {
    const bad = PLAN_FEATURES.filter((f) => f.moduleKey && !MODULE_KEYS.includes(f.moduleKey));
    expect(bad.map((f) => f.key)).toEqual([]);
  });

  it("水彈模組對應 battle_system", () => {
    expect(featureForModule("battle")?.key).toBe("battle_system");
    expect(featureForModule("pos")).toBeUndefined();
  });
});

describe("planHasFeature", () => {
  it("方案有列 → 通過；沒列 → 擋", () => {
    expect(planHasFeature(["basic_games", "battle_system"], "battle_system")).toBe(true);
    expect(planHasFeature(["basic_games"], "battle_system")).toBe(false);
  });

  it("讀不到方案（null / 空）→ 一律放行，不把客戶鎖死", () => {
    expect(planHasFeature(null, "battle_system")).toBe(true);
    expect(planHasFeature([], "api_access")).toBe(true);
  });

  it("還沒接程式的功能（白牌 / 自訂網域）不擋", () => {
    expect(getPlanFeature("white_label")?.notEnforced).toBe(true);
    expect(planHasFeature(["basic_games"], "white_label")).toBe(true);
  });

  it("擋下時的訊息看得懂、含功能名稱", () => {
    expect(featureUpgradeMessage("battle_system")).toContain("水彈對戰");
  });
});
