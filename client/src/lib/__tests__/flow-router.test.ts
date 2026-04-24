// flow-router 核心邏輯測試
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  evaluateCondition,
  evaluateRoute,
  evaluateFlowRouter,
  pickRandomRoute,
  resolveFlowRouter,
  processOnCompleteActions,
} from "../flow-router";
import type {
  FlowCondition,
  FlowRoute,
  FlowRouterConfig,
  OnCompleteAction,
} from "@shared/schema";

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

// ============================================================================
// processOnCompleteActions — 頁面完成時的變數/道具/分數操作（核心邏輯）
// ============================================================================
describe("processOnCompleteActions — 純函式變更狀態", () => {
  // ----- 變數操作 -----
  describe("set_variable", () => {
    it("設定新變數", () => {
      const actions: OnCompleteAction[] = [
        { type: "set_variable", variableName: "level", value: 5 } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, {}, [], 0);
      expect(result.variables.level).toBe(5);
    });

    it("覆蓋已存在的變數", () => {
      const actions: OnCompleteAction[] = [
        { type: "set_variable", variableName: "name", value: "new" } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, { name: "old" }, [], 0);
      expect(result.variables.name).toBe("new");
    });

    it("沒給 variableName → 跳過（不破壞 state）", () => {
      const actions: OnCompleteAction[] = [
        { type: "set_variable", value: 5 } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, { x: 1 }, [], 0);
      expect(result.variables).toEqual({ x: 1 });
    });
  });

  describe("increment_variable", () => {
    it("不存在的變數從 0 開始 +1", () => {
      const actions: OnCompleteAction[] = [
        { type: "increment_variable", variableName: "counter", value: 1 } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, {}, [], 0);
      expect(result.variables.counter).toBe(1);
    });

    it("已有的數字遞增指定值", () => {
      const actions: OnCompleteAction[] = [
        { type: "increment_variable", variableName: "x", value: 5 } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, { x: 10 }, [], 0);
      expect(result.variables.x).toBe(15);
    });

    it("沒給 value → 預設 +1", () => {
      const actions: OnCompleteAction[] = [
        { type: "increment_variable", variableName: "x" } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, { x: 7 }, [], 0);
      expect(result.variables.x).toBe(8);
    });

    it("字串數字也能遞增（'10' + 5 = 15）", () => {
      const actions: OnCompleteAction[] = [
        { type: "increment_variable", variableName: "x", value: 5 } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, { x: "10" }, [], 0);
      expect(result.variables.x).toBe(15);
    });
  });

  describe("decrement_variable", () => {
    it("數字遞減", () => {
      const actions: OnCompleteAction[] = [
        { type: "decrement_variable", variableName: "hp", value: 3 } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, { hp: 10 }, [], 0);
      expect(result.variables.hp).toBe(7);
    });

    it("沒給 value → 預設 -1", () => {
      const actions: OnCompleteAction[] = [
        { type: "decrement_variable", variableName: "hp" } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, { hp: 5 }, [], 0);
      expect(result.variables.hp).toBe(4);
    });
  });

  describe("toggle_variable", () => {
    it("true → false", () => {
      const actions: OnCompleteAction[] = [
        { type: "toggle_variable", variableName: "flag" } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, { flag: true }, [], 0);
      expect(result.variables.flag).toBe(false);
    });

    it("false → true", () => {
      const actions: OnCompleteAction[] = [
        { type: "toggle_variable", variableName: "flag" } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, { flag: false }, [], 0);
      expect(result.variables.flag).toBe(true);
    });

    it("不存在的變數 → true（!undefined === true）", () => {
      const actions: OnCompleteAction[] = [
        { type: "toggle_variable", variableName: "missing" } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, {}, [], 0);
      expect(result.variables.missing).toBe(true);
    });
  });

  // ----- 道具操作 -----
  describe("add_item / remove_item", () => {
    it("add_item 加入道具", () => {
      const actions: OnCompleteAction[] = [
        { type: "add_item", itemId: "key-red" } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, {}, [], 0);
      expect(result.inventory).toEqual(["key-red"]);
    });

    it("add_item 已有相同道具 → 不重複加", () => {
      const actions: OnCompleteAction[] = [
        { type: "add_item", itemId: "key-red" } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, {}, ["key-red"], 0);
      expect(result.inventory).toEqual(["key-red"]); // 還是 1 個
    });

    it("itemId 是 number 也能比對（型別相容）", () => {
      const actions: OnCompleteAction[] = [
        { type: "add_item", itemId: 123 as unknown as string } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, {}, ["123"], 0);
      // 已存在（字串 "123" 與 number 123 比對視為相同）
      expect(result.inventory.length).toBe(1);
    });

    it("沒給 itemId → 跳過", () => {
      const actions: OnCompleteAction[] = [{ type: "add_item" } as OnCompleteAction];
      const result = processOnCompleteActions(actions, {}, ["existing"], 0);
      expect(result.inventory).toEqual(["existing"]);
    });

    it("remove_item 移除道具", () => {
      const actions: OnCompleteAction[] = [
        { type: "remove_item", itemId: "key-red" } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, {}, ["key-red", "key-blue"], 0);
      expect(result.inventory).toEqual(["key-blue"]);
    });

    it("remove_item 不存在的道具 → 不報錯", () => {
      const actions: OnCompleteAction[] = [
        { type: "remove_item", itemId: "ghost" } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, {}, ["key-red"], 0);
      expect(result.inventory).toEqual(["key-red"]);
    });
  });

  // ----- 分數操作 -----
  describe("add_score", () => {
    it("加分", () => {
      const actions: OnCompleteAction[] = [
        { type: "add_score", points: 100 } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, {}, [], 50);
      expect(result.score).toBe(150);
    });

    it("負分（扣分）也支援", () => {
      const actions: OnCompleteAction[] = [
        { type: "add_score", points: -20 } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, {}, [], 100);
      expect(result.score).toBe(80);
    });

    it("沒給 points → +0（不影響）", () => {
      const actions: OnCompleteAction[] = [{ type: "add_score" } as OnCompleteAction];
      const result = processOnCompleteActions(actions, {}, [], 50);
      expect(result.score).toBe(50);
    });
  });

  // ----- 不可變性 + 多動作 -----
  describe("不可變性與多動作組合", () => {
    it("不修改原 variables 物件（immutable）", () => {
      const original = { x: 1 };
      const actions: OnCompleteAction[] = [
        { type: "set_variable", variableName: "x", value: 99 } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, original, [], 0);
      expect(original.x).toBe(1); // 原物件不被修改
      expect(result.variables.x).toBe(99);
    });

    it("不修改原 inventory 陣列（immutable）", () => {
      const original = ["a"];
      const actions: OnCompleteAction[] = [
        { type: "add_item", itemId: "b" } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, {}, original, 0);
      expect(original).toEqual(["a"]); // 原陣列不被修改
      expect(result.inventory).toEqual(["a", "b"]);
    });

    it("多個 actions 依序執行（變數 + 道具 + 分數）", () => {
      const actions: OnCompleteAction[] = [
        { type: "increment_variable", variableName: "level", value: 1 } as OnCompleteAction,
        { type: "add_item", itemId: "trophy" } as OnCompleteAction,
        { type: "add_score", points: 50 } as OnCompleteAction,
      ];
      const result = processOnCompleteActions(actions, { level: 4 }, ["sword"], 100);
      expect(result.variables.level).toBe(5);
      expect(result.inventory).toEqual(["sword", "trophy"]);
      expect(result.score).toBe(150);
    });

    it("空 actions → 不變", () => {
      const result = processOnCompleteActions([], { x: 1 }, ["a"], 50);
      expect(result.variables).toEqual({ x: 1 });
      expect(result.inventory).toEqual(["a"]);
      expect(result.score).toBe(50);
    });
  });
});
