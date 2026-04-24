// flow-router 核心邏輯測試
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  evaluateCondition,
  evaluateRoute,
  evaluateFlowRouter,
  pickRandomRoute,
  resolveFlowRouter,
} from "../flow-router";
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

// ============================================================================
// 數字比較條件（之前完全沒測）
// ============================================================================
describe("evaluateCondition — variable_gt/lt/gte/lte 數字比較", () => {
  it("variable_gt 嚴格大於", () => {
    const cond: FlowCondition = { type: "variable_gt", variableName: "x", variableValue: 10 };
    expect(evaluateCondition(cond, { x: 11 }, [], 0)).toBe(true);
    expect(evaluateCondition(cond, { x: 10 }, [], 0)).toBe(false);
    expect(evaluateCondition(cond, { x: 5 }, [], 0)).toBe(false);
  });

  it("variable_lt 嚴格小於", () => {
    const cond: FlowCondition = { type: "variable_lt", variableName: "x", variableValue: 10 };
    expect(evaluateCondition(cond, { x: 9 }, [], 0)).toBe(true);
    expect(evaluateCondition(cond, { x: 10 }, [], 0)).toBe(false);
    expect(evaluateCondition(cond, { x: 11 }, [], 0)).toBe(false);
  });

  it("variable_gte 大於等於", () => {
    const cond: FlowCondition = { type: "variable_gte", variableName: "x", variableValue: 10 };
    expect(evaluateCondition(cond, { x: 10 }, [], 0)).toBe(true);
    expect(evaluateCondition(cond, { x: 11 }, [], 0)).toBe(true);
    expect(evaluateCondition(cond, { x: 9 }, [], 0)).toBe(false);
  });

  it("variable_lte 小於等於", () => {
    const cond: FlowCondition = { type: "variable_lte", variableName: "x", variableValue: 10 };
    expect(evaluateCondition(cond, { x: 10 }, [], 0)).toBe(true);
    expect(evaluateCondition(cond, { x: 9 }, [], 0)).toBe(true);
    expect(evaluateCondition(cond, { x: 11 }, [], 0)).toBe(false);
  });

  it("字串數字也能比（'5' > 3）", () => {
    const cond: FlowCondition = { type: "variable_gt", variableName: "x", variableValue: 3 };
    expect(evaluateCondition(cond, { x: "5" }, [], 0)).toBe(true);
  });

  it("缺少變數視為 0", () => {
    const cond: FlowCondition = { type: "variable_gt", variableName: "missing", variableValue: -1 };
    expect(evaluateCondition(cond, {}, [], 0)).toBe(true); // 0 > -1
  });
});

// ============================================================================
// pickRandomRoute（加權隨機）
// ============================================================================
describe("pickRandomRoute — 加權隨機選擇", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("空 routes → null", () => {
    expect(pickRandomRoute([])).toBe(null);
  });

  it("單一 route → 一定選到它", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const routes: FlowRoute[] = [{ id: "r1", conditions: [], nextPageId: "p1" }];
    expect(pickRandomRoute(routes)).toBe("p1");
  });

  it("Math.random=0 → 選第一個", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const routes: FlowRoute[] = [
      { id: "r1", conditions: [{ type: "random", weight: 1 }], nextPageId: "p1" },
      { id: "r2", conditions: [{ type: "random", weight: 1 }], nextPageId: "p2" },
    ];
    expect(pickRandomRoute(routes)).toBe("p1");
  });

  it("Math.random=0.99 → 選最後一個", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const routes: FlowRoute[] = [
      { id: "r1", conditions: [{ type: "random", weight: 1 }], nextPageId: "p1" },
      { id: "r2", conditions: [{ type: "random", weight: 1 }], nextPageId: "p2" },
    ];
    expect(pickRandomRoute(routes)).toBe("p2");
  });

  it("加權：weight=9 比 weight=1 容易被選到", () => {
    // total weight = 10，random*10=5（落在 weight 9 範圍內）
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const routes: FlowRoute[] = [
      { id: "heavy", conditions: [{ type: "random", weight: 9 }], nextPageId: "common" },
      { id: "light", conditions: [{ type: "random", weight: 1 }], nextPageId: "rare" },
    ];
    expect(pickRandomRoute(routes)).toBe("common");
  });

  it("總權重 0 → 回傳第一個 route", () => {
    const routes: FlowRoute[] = [
      { id: "r1", conditions: [{ type: "random", weight: 0 }], nextPageId: "p1" },
      { id: "r2", conditions: [{ type: "random", weight: 0 }], nextPageId: "p2" },
    ];
    expect(pickRandomRoute(routes)).toBe("p1");
  });
});

// ============================================================================
// resolveFlowRouter — 連續 flow_router 跳轉解析
// ============================================================================
describe("resolveFlowRouter — 多 router 跳轉", () => {
  it("非 flow_router 頁面 → 直接回傳 startIndex", () => {
    const pages = [
      { id: "p1", pageType: "text_card", config: {} },
      { id: "p2", pageType: "vote", config: {} },
    ];
    expect(resolveFlowRouter(pages, 0, {}, [], 0)).toBe(0);
  });

  it("單一 flow_router 跳到目標頁", () => {
    const pages = [
      {
        id: "router1",
        pageType: "flow_router",
        config: {
          mode: "conditional",
          routes: [{ id: "r1", conditions: [], nextPageId: "target" }],
        } as FlowRouterConfig,
      },
      { id: "target", pageType: "text_card", config: {} },
    ];
    expect(resolveFlowRouter(pages, 0, {}, [], 0)).toBe(1); // 跳到 index 1
  });

  it("_end 特殊值 → 返回 -1（遊戲結束）", () => {
    const pages = [
      {
        id: "router1",
        pageType: "flow_router",
        config: {
          mode: "conditional",
          routes: [{ id: "r1", conditions: [], nextPageId: "_end" }],
        } as FlowRouterConfig,
      },
    ];
    expect(resolveFlowRouter(pages, 0, {}, [], 0)).toBe(-1);
  });

  it("無匹配 + 無 default → 跳到下一頁", () => {
    const pages = [
      {
        id: "router1",
        pageType: "flow_router",
        config: {
          mode: "conditional",
          routes: [
            { id: "r1", conditions: [{ type: "score_above", scoreThreshold: 100 }], nextPageId: "winner" },
          ],
        } as FlowRouterConfig,
      },
      { id: "next", pageType: "text_card", config: {} },
    ];
    expect(resolveFlowRouter(pages, 0, {}, [], 10)).toBe(1);
  });

  it("連續兩個 flow_router 鏈式跳轉", () => {
    const pages = [
      {
        id: "router1",
        pageType: "flow_router",
        config: {
          mode: "conditional",
          routes: [{ id: "r1", conditions: [], nextPageId: "router2" }],
        } as FlowRouterConfig,
      },
      {
        id: "router2",
        pageType: "flow_router",
        config: {
          mode: "conditional",
          routes: [{ id: "r2", conditions: [], nextPageId: "final" }],
        } as FlowRouterConfig,
      },
      { id: "final", pageType: "text_card", config: {} },
    ];
    expect(resolveFlowRouter(pages, 0, {}, [], 0)).toBe(2);
  });

  it("找不到 nextPageId → 跳到下一頁（fallthrough）", () => {
    const pages = [
      {
        id: "router1",
        pageType: "flow_router",
        config: {
          mode: "conditional",
          routes: [{ id: "r1", conditions: [], nextPageId: "ghost" }], // 不存在
          defaultNextPageId: "ghost",
        } as FlowRouterConfig,
      },
      { id: "next", pageType: "text_card", config: {} },
    ];
    // 不存在的目標 → 走到 fallback 路徑（index++）
    expect(resolveFlowRouter(pages, 0, {}, [], 0)).toBe(1);
  });
});
