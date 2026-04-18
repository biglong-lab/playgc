// flow-router 核心邏輯測試
import { describe, it, expect } from "vitest";
import { evaluateCondition, evaluateRoute, evaluateFlowRouter } from "../flow-router";
import type { FlowCondition, FlowRoute, FlowRouterConfig } from "@shared/schema";

describe("evaluateCondition — variable_equals 型別 coercion", () => {
  it("字串 '5' 與數字 5 應視為相等（管理員 JSON 編輯器常見情境）", () => {
    const cond: FlowCondition = {
      type: "variable_equals",
      variableName: "score",
      variableValue: 5,
    };
    expect(evaluateCondition(cond, { score: "5" }, [], 0)).toBe(true);
  });

  it("數字 5 與字串 '5' 應視為相等（相反方向）", () => {
    const cond: FlowCondition = {
      type: "variable_equals",
      variableName: "level",
      variableValue: "5",
    };
    expect(evaluateCondition(cond, { level: 5 }, [], 0)).toBe(true);
  });

  it("boolean true 與字串 'true' 應視為相等", () => {
    const cond: FlowCondition = {
      type: "variable_equals",
      variableName: "flag",
      variableValue: true,
    };
    expect(evaluateCondition(cond, { flag: "true" }, [], 0)).toBe(true);
  });

  it("不同值不應相等", () => {
    const cond: FlowCondition = {
      type: "variable_equals",
      variableName: "x",
      variableValue: 10,
    };
    expect(evaluateCondition(cond, { x: 5 }, [], 0)).toBe(false);
  });

  it("null/undefined 維持嚴格比對", () => {
    const cond: FlowCondition = {
      type: "variable_equals",
      variableName: "x",
      variableValue: null as any,
    };
    expect(evaluateCondition(cond, { x: undefined }, [], 0)).toBe(false);
  });
});

describe("evaluateCondition — has_item / not_has_item", () => {
  it("has_item 匹配成功", () => {
    const cond: FlowCondition = { type: "has_item", itemId: "key-red" };
    expect(evaluateCondition(cond, {}, ["key-red", "key-blue"], 0)).toBe(true);
  });

  it("has_item 匹配失敗", () => {
    const cond: FlowCondition = { type: "has_item", itemId: "key-green" };
    expect(evaluateCondition(cond, {}, ["key-red"], 0)).toBe(false);
  });

  it("not_has_item 邏輯反向", () => {
    const cond: FlowCondition = { type: "not_has_item", itemId: "key-red" };
    expect(evaluateCondition(cond, {}, ["key-blue"], 0)).toBe(true);
    expect(evaluateCondition(cond, {}, ["key-red"], 0)).toBe(false);
  });
});

describe("evaluateCondition — score 比較", () => {
  it("score_above 含等號", () => {
    const cond: FlowCondition = { type: "score_above", scoreThreshold: 100 };
    expect(evaluateCondition(cond, {}, [], 100)).toBe(true);
    expect(evaluateCondition(cond, {}, [], 99)).toBe(false);
  });

  it("score_below 不含等號", () => {
    const cond: FlowCondition = { type: "score_below", scoreThreshold: 50 };
    expect(evaluateCondition(cond, {}, [], 49)).toBe(true);
    expect(evaluateCondition(cond, {}, [], 50)).toBe(false);
  });
});

describe("evaluateRoute — 多條件 AND/OR", () => {
  it("無條件的 route 永遠通過（default fallback）", () => {
    const route: FlowRoute = { id: "r1", conditions: [], nextPageId: "p1" };
    expect(evaluateRoute(route, {}, [], 0)).toBe(true);
  });

  it("AND 邏輯：所有條件都要滿足", () => {
    const route: FlowRoute = {
      id: "r1",
      conditions: [
        { type: "has_item", itemId: "a" },
        { type: "score_above", scoreThreshold: 10 },
      ],
      conditionLogic: "and",
      nextPageId: "p1",
    };
    expect(evaluateRoute(route, {}, ["a"], 20)).toBe(true);
    expect(evaluateRoute(route, {}, ["a"], 5)).toBe(false);
    expect(evaluateRoute(route, {}, [], 20)).toBe(false);
  });

  it("OR 邏輯：任一條件滿足即通過", () => {
    const route: FlowRoute = {
      id: "r1",
      conditions: [
        { type: "has_item", itemId: "a" },
        { type: "score_above", scoreThreshold: 10 },
      ],
      conditionLogic: "or",
      nextPageId: "p1",
    };
    expect(evaluateRoute(route, {}, ["a"], 5)).toBe(true);
    expect(evaluateRoute(route, {}, [], 20)).toBe(true);
    expect(evaluateRoute(route, {}, [], 5)).toBe(false);
  });
});

describe("evaluateFlowRouter — 整合", () => {
  it("conditional 模式：選第一個符合的 route", () => {
    const config: FlowRouterConfig = {
      mode: "conditional",
      routes: [
        {
          id: "r1",
          conditions: [{ type: "score_above", scoreThreshold: 100 }],
          nextPageId: "winner",
        },
        {
          id: "r2",
          conditions: [{ type: "score_above", scoreThreshold: 50 }],
          nextPageId: "middle",
        },
      ],
      defaultNextPageId: "loser",
    };
    expect(evaluateFlowRouter(config, {}, [], 150)).toBe("winner");
    expect(evaluateFlowRouter(config, {}, [], 75)).toBe("middle");
    expect(evaluateFlowRouter(config, {}, [], 10)).toBe("loser");
  });

  it("無匹配且無 default → null", () => {
    const config: FlowRouterConfig = {
      mode: "conditional",
      routes: [
        {
          id: "r1",
          conditions: [{ type: "score_above", scoreThreshold: 100 }],
          nextPageId: "winner",
        },
      ],
    };
    expect(evaluateFlowRouter(config, {}, [], 10)).toBe(null);
  });
});
