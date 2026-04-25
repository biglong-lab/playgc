// reward-engine 單元測試 — 規則引擎核心邏輯
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26.5
import { describe, it, expect } from "vitest";
import { matchTriggers, type RewardEvent } from "../reward-rules-matcher";

// ============================================================================
// 共用 fixture
// ============================================================================
function makeEvent(overrides: Partial<RewardEvent> = {}): RewardEvent {
  return {
    eventType: "game_complete",
    sourceId: "test-source-1",
    sourceType: "squad_match_record",
    squadId: "squad-1",
    userId: "user-1",
    fieldId: "jiachun",
    context: {},
    ...overrides,
  };
}

// ============================================================================
// matchTriggers — 觸發條件評估（純函式，最該測）
// ============================================================================
describe("matchTriggers", () => {
  describe("eventType 匹配", () => {
    it("eventType 一致 → 通過", () => {
      const event = makeEvent({ eventType: "game_complete" });
      expect(matchTriggers({ eventType: "game_complete" }, event)).toBe(true);
    });

    it("eventType 不一致 → 不通過", () => {
      const event = makeEvent({ eventType: "game_complete" });
      expect(matchTriggers({ eventType: "milestone" }, event)).toBe(false);
    });
  });

  describe("fieldId 限定", () => {
    it("規則限定場域 + event 是同場域 → 通過", () => {
      const event = makeEvent({ fieldId: "jiachun" });
      expect(matchTriggers({ eventType: "game_complete", fieldId: "jiachun" }, event)).toBe(true);
    });

    it("規則限定場域 + event 不同場域 → 不通過", () => {
      const event = makeEvent({ fieldId: "hpspace" });
      expect(matchTriggers({ eventType: "game_complete", fieldId: "jiachun" }, event)).toBe(false);
    });

    it("規則沒限定場域 → 任何場域都通過", () => {
      const event = makeEvent({ fieldId: "anywhere" });
      expect(matchTriggers({ eventType: "game_complete" }, event)).toBe(true);
    });
  });

  describe("gameTypes 限定", () => {
    it("event 的遊戲類型在清單中 → 通過", () => {
      const event = makeEvent({ context: { gameType: "battle" } });
      expect(matchTriggers({ eventType: "game_complete", gameTypes: ["battle", "competitive"] }, event)).toBe(true);
    });

    it("event 的遊戲類型不在清單中 → 不通過", () => {
      const event = makeEvent({ context: { gameType: "adventure" } });
      expect(matchTriggers({ eventType: "game_complete", gameTypes: ["battle"] }, event)).toBe(false);
    });

    it("event 沒帶 gameType → 不通過", () => {
      const event = makeEvent({ context: {} });
      expect(matchTriggers({ eventType: "game_complete", gameTypes: ["battle"] }, event)).toBe(false);
    });

    it("空 gameTypes 陣列 → 不限制（通過）", () => {
      const event = makeEvent({ context: { gameType: "battle" } });
      expect(matchTriggers({ eventType: "game_complete", gameTypes: [] }, event)).toBe(true);
    });
  });

  describe("result 限定", () => {
    it("結果在清單中 → 通過", () => {
      const event = makeEvent({ context: { result: "win" } });
      expect(matchTriggers({ eventType: "game_complete", result: ["win", "draw"] }, event)).toBe(true);
    });

    it("結果不在清單中 → 不通過", () => {
      const event = makeEvent({ context: { result: "loss" } });
      expect(matchTriggers({ eventType: "game_complete", result: ["win", "draw"] }, event)).toBe(false);
    });
  });

  describe("minTotalGames 累計場次門檻", () => {
    it("場次達標 → 通過", () => {
      const event = makeEvent({ context: { totalGames: 10 } });
      expect(matchTriggers({ eventType: "game_complete", minTotalGames: 10 }, event)).toBe(true);
    });

    it("場次超過 → 通過", () => {
      const event = makeEvent({ context: { totalGames: 25 } });
      expect(matchTriggers({ eventType: "game_complete", minTotalGames: 10 }, event)).toBe(true);
    });

    it("場次未達標 → 不通過", () => {
      const event = makeEvent({ context: { totalGames: 9 } });
      expect(matchTriggers({ eventType: "game_complete", minTotalGames: 10 }, event)).toBe(false);
    });

    it("沒帶 totalGames → 不通過（型別不對視為未達）", () => {
      const event = makeEvent({ context: {} });
      expect(matchTriggers({ eventType: "game_complete", minTotalGames: 1 }, event)).toBe(false);
    });
  });

  describe("crossField / firstVisit 跨場域條件", () => {
    it("crossField=true 且 event 是跨場域 → 通過", () => {
      const event = makeEvent({ context: { isCrossField: true } });
      expect(matchTriggers({ eventType: "game_complete", crossField: true }, event)).toBe(true);
    });

    it("crossField=true 但 event 不是跨場域 → 不通過", () => {
      const event = makeEvent({ context: { isCrossField: false } });
      expect(matchTriggers({ eventType: "game_complete", crossField: true }, event)).toBe(false);
    });

    it("firstVisit=true 且 event 是首航 → 通過", () => {
      const event = makeEvent({ context: { isFirstVisit: true } });
      expect(matchTriggers({ eventType: "game_complete", firstVisit: true }, event)).toBe(true);
    });

    it("firstVisit=true 但 event 不是首航 → 不通過", () => {
      const event = makeEvent({ context: { isFirstVisit: false } });
      expect(matchTriggers({ eventType: "game_complete", firstVisit: true }, event)).toBe(false);
    });
  });

  describe("minSquadTier 段位門檻", () => {
    it("我的段位 >= 規則要求 → 通過（gold >= silver）", () => {
      const event = makeEvent({ context: { tier: "gold" } });
      expect(matchTriggers({ eventType: "game_complete", minSquadTier: "silver" }, event)).toBe(true);
    });

    it("我的段位 < 規則要求 → 不通過（silver < gold）", () => {
      const event = makeEvent({ context: { tier: "silver" } });
      expect(matchTriggers({ eventType: "game_complete", minSquadTier: "gold" }, event)).toBe(false);
    });

    it("段位相同 → 通過（gold = gold）", () => {
      const event = makeEvent({ context: { tier: "gold" } });
      expect(matchTriggers({ eventType: "game_complete", minSquadTier: "gold" }, event)).toBe(true);
    });

    it("沒帶 tier 預設 silver → 通過 silver", () => {
      const event = makeEvent({ context: {} });
      expect(matchTriggers({ eventType: "game_complete", minSquadTier: "silver" }, event)).toBe(true);
    });

    it("沒帶 tier 預設 silver → 不通過 gold", () => {
      const event = makeEvent({ context: {} });
      expect(matchTriggers({ eventType: "game_complete", minSquadTier: "gold" }, event)).toBe(false);
    });
  });

  describe("minRecruits 招募數門檻", () => {
    it("招募達標 → 通過", () => {
      const event = makeEvent({ eventType: "recruit", context: { recruitsCount: 10 } });
      expect(matchTriggers({ eventType: "recruit", minRecruits: 10 }, event)).toBe(true);
    });

    it("招募未達標 → 不通過", () => {
      const event = makeEvent({ eventType: "recruit", context: { recruitsCount: 5 } });
      expect(matchTriggers({ eventType: "recruit", minRecruits: 10 }, event)).toBe(false);
    });
  });

  describe("多條件 AND 組合", () => {
    it("所有條件滿足 → 通過", () => {
      const event = makeEvent({
        context: {
          gameType: "battle",
          result: "win",
          totalGames: 50,
          isCrossField: true,
          tier: "gold",
        },
      });
      expect(
        matchTriggers(
          {
            eventType: "game_complete",
            gameTypes: ["battle"],
            result: ["win"],
            minTotalGames: 30,
            crossField: true,
            minSquadTier: "silver",
          },
          event,
        ),
      ).toBe(true);
    });

    it("任一條件不滿足 → 不通過", () => {
      const event = makeEvent({
        context: {
          gameType: "battle",
          result: "loss", // 不滿足 result
          totalGames: 50,
        },
      });
      expect(
        matchTriggers(
          {
            eventType: "game_complete",
            gameTypes: ["battle"],
            result: ["win"], // 要 win
            minTotalGames: 30,
          },
          event,
        ),
      ).toBe(false);
    });
  });
});
