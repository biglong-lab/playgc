import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ensureRaceState,
  getRaceState,
  recordAnswer,
  advanceQuestion,
  cleanupRaceState,
  getStateSnapshot,
  getAllScores,
  getMyScore,
} from "../lib/race-state";

const baseArgs = {
  sessionId: "s1",
  teamId: "t1",
  pageId: "p1",
  totalQuestions: 3,
  secondsPerQuestion: 20,
  member: { userId: "u1", displayName: "Alice" },
};

describe("race-state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    // cleanup any leftover state
    const s = getRaceState("s1", "t1", "p1");
    if (s) cleanupRaceState(s);
  });

  describe("ensureRaceState", () => {
    it("第一次呼叫 → 建立新 state", () => {
      const onAdvance = vi.fn();
      const state = ensureRaceState(baseArgs, onAdvance);
      expect(state.sessionId).toBe("s1");
      expect(state.currentQuestionIndex).toBe(0);
      expect(state.members).toHaveLength(1);
      expect(state.members[0].userId).toBe("u1");
      expect(state.endAt - state.startAt).toBe(20_000);
    });

    it("同 key 重複呼叫 → 返回既有 state（不建新）", () => {
      const onAdvance = vi.fn();
      const s1 = ensureRaceState(baseArgs, onAdvance);
      const s2 = ensureRaceState(baseArgs, onAdvance);
      expect(s1).toBe(s2);
    });

    it("第二位玩家進場 → 加入 members", () => {
      const onAdvance = vi.fn();
      const s1 = ensureRaceState(baseArgs, onAdvance);
      const s2 = ensureRaceState(
        { ...baseArgs, member: { userId: "u2", displayName: "Bob" } },
        onAdvance,
      );
      expect(s1).toBe(s2);
      expect(s2.members).toHaveLength(2);
      expect(s2.members[1].userId).toBe("u2");
    });

    it("secondsPerQuestion 軟邊界 5-120", () => {
      const onAdvance = vi.fn();
      const sLow = ensureRaceState(
        { ...baseArgs, sessionId: "s-low", secondsPerQuestion: 1 },
        onAdvance,
      );
      expect(sLow.secondsPerQuestion).toBe(5);
      cleanupRaceState(sLow);

      const sHigh = ensureRaceState(
        { ...baseArgs, sessionId: "s-high", secondsPerQuestion: 999 },
        onAdvance,
      );
      expect(sHigh.secondsPerQuestion).toBe(120);
      cleanupRaceState(sHigh);
    });

    it("timer 到時呼叫 onAdvance callback", () => {
      const onAdvance = vi.fn();
      const state = ensureRaceState(baseArgs, onAdvance);
      vi.advanceTimersByTime(20_000);
      expect(onAdvance).toHaveBeenCalledWith(state);
    });
  });

  describe("recordAnswer", () => {
    it("記錄答題、累積分數", () => {
      const onAdvance = vi.fn();
      const state = ensureRaceState(baseArgs, onAdvance);
      recordAnswer(state, {
        userId: "u1",
        displayName: "Alice",
        questionIndex: 0,
        selectedOption: 1,
        isCorrect: true,
        points: 10,
        answeredAt: new Date().toISOString(),
      });
      expect(state.scores.get("u1")).toBe(10);
      expect(state.answers).toHaveLength(1);
    });

    it("同題同人重複答題 → 只記第一次", () => {
      const onAdvance = vi.fn();
      const state = ensureRaceState(baseArgs, onAdvance);
      const entry = {
        userId: "u1",
        displayName: "Alice",
        questionIndex: 0,
        selectedOption: 1,
        isCorrect: true,
        points: 10,
        answeredAt: new Date().toISOString(),
      };
      recordAnswer(state, entry);
      recordAnswer(state, entry);
      expect(state.answers).toHaveLength(1);
      expect(state.scores.get("u1")).toBe(10);
    });

    it("錯題不加分但記錄", () => {
      const onAdvance = vi.fn();
      const state = ensureRaceState(baseArgs, onAdvance);
      recordAnswer(state, {
        userId: "u1",
        displayName: "Alice",
        questionIndex: 0,
        selectedOption: 2,
        isCorrect: false,
        points: 0,
        answeredAt: new Date().toISOString(),
      });
      expect(state.scores.get("u1")).toBeUndefined();
      expect(state.answers).toHaveLength(1);
    });

    it("超前 / 過期題的答題忽略", () => {
      const onAdvance = vi.fn();
      const state = ensureRaceState(baseArgs, onAdvance);
      recordAnswer(state, {
        userId: "u1",
        displayName: "Alice",
        questionIndex: 99,
        selectedOption: 1,
        isCorrect: true,
        points: 10,
        answeredAt: new Date().toISOString(),
      });
      expect(state.answers).toHaveLength(0);
    });
  });

  describe("advanceQuestion", () => {
    it("第 0 題推進 → 第 1 題、startAt 重設", () => {
      const onAdvance = vi.fn();
      const state = ensureRaceState(baseArgs, onAdvance);
      const originalStartAt = state.startAt;
      vi.advanceTimersByTime(5_000);
      const result = advanceQuestion(state, onAdvance);
      expect(result.advanced).toBe(true);
      expect(result.completed).toBe(false);
      expect(state.currentQuestionIndex).toBe(1);
      expect(state.startAt).toBeGreaterThan(originalStartAt);
    });

    it("最後題推進 → completed=true", () => {
      const onAdvance = vi.fn();
      const state = ensureRaceState({ ...baseArgs, totalQuestions: 2 }, onAdvance);
      advanceQuestion(state, onAdvance); // 0 → 1
      const result = advanceQuestion(state, onAdvance); // 1 → completed
      expect(result.advanced).toBe(false);
      expect(result.completed).toBe(true);
      expect(state.completed).toBe(true);
    });

    it("已 completed 不再推進", () => {
      const onAdvance = vi.fn();
      const state = ensureRaceState({ ...baseArgs, totalQuestions: 1 }, onAdvance);
      advanceQuestion(state, onAdvance); // 已完成
      const result = advanceQuestion(state, onAdvance);
      expect(result.advanced).toBe(false);
      expect(result.completed).toBe(true);
    });
  });

  describe("getStateSnapshot", () => {
    it("回傳 client 用的 snapshot", () => {
      const onAdvance = vi.fn();
      const state = ensureRaceState(baseArgs, onAdvance);
      const snap = getStateSnapshot(state);
      expect(snap.currentQuestionIndex).toBe(0);
      expect(snap.totalQuestions).toBe(3);
      expect(snap.secondsPerQuestion).toBe(20);
      expect(snap.completed).toBe(false);
      expect(snap.members).toHaveLength(1);
    });
  });

  describe("getAllScores / getMyScore", () => {
    it("getAllScores 回傳 record", () => {
      const onAdvance = vi.fn();
      const state = ensureRaceState(baseArgs, onAdvance);
      recordAnswer(state, {
        userId: "u1",
        displayName: "Alice",
        questionIndex: 0,
        selectedOption: 1,
        isCorrect: true,
        points: 10,
        answeredAt: new Date().toISOString(),
      });
      expect(getAllScores(state)).toEqual({ u1: 10 });
      expect(getMyScore(state, "u1")).toBe(10);
      expect(getMyScore(state, "u-unknown")).toBe(0);
    });
  });

  describe("cleanupRaceState", () => {
    it("清除 timer + 從 map 移除", () => {
      const onAdvance = vi.fn();
      const state = ensureRaceState(baseArgs, onAdvance);
      cleanupRaceState(state);
      expect(getRaceState("s1", "t1", "p1")).toBeUndefined();
    });
  });
});
