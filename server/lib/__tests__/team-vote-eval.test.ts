// 🗳️ computeVoteCompletion 單元測試（CHITO #8687281e 投票完成 server 權威）
import { describe, it, expect, vi } from "vitest";

// computeVoteCompletion 是純函式，但模組 top-level import 了 db（reevaluate 用）
// → 測試環境無 DATABASE_URL 會 throw，mock 掉即可
vi.mock("../../db", () => ({ db: {} }));
vi.mock("@shared/schema", () => ({
  teamVotes: {},
  teamVoteBallots: {},
  teamMembers: {},
}));

import { computeVoteCompletion } from "../team-vote-eval";

describe("computeVoteCompletion", () => {
  describe("majority 模式", () => {
    it("3 人 1 票 → 未完成（需 ceil(3/2)=2）", () => {
      const r = computeVoteCompletion("majority", ["option_0"], 3);
      expect(r.isComplete).toBe(false);
      expect(r.winningOptionId).toBeNull();
    });

    it("3 人 2 票同選項 → 完成", () => {
      const r = computeVoteCompletion("majority", ["option_0", "option_0"], 3);
      expect(r.isComplete).toBe(true);
      expect(r.winningOptionId).toBe("option_0");
    });

    it("3 人 2 票不同選項 → 未完成（無選項過半）", () => {
      const r = computeVoteCompletion("majority", ["option_0", "option_1"], 3);
      expect(r.isComplete).toBe(false);
    });

    it("3 人全投完但三方分散 → 完成、取最高票", () => {
      const r = computeVoteCompletion(
        "majority",
        ["option_0", "option_0", "option_1"],
        3,
      );
      // option_0 有 2 票 >= ceil(3/2)=2 → 過半直接完成
      expect(r.isComplete).toBe(true);
      expect(r.winningOptionId).toBe("option_0");
    });

    it("2 人 1 票 → 完成（ceil(2/2)=1，與既有行為一致）", () => {
      const r = computeVoteCompletion("majority", ["option_1"], 2);
      expect(r.isComplete).toBe(true);
      expect(r.winningOptionId).toBe("option_1");
    });

    it("全員投完、平票 → 完成、取最高（先到先贏）", () => {
      const r = computeVoteCompletion("majority", ["option_0", "option_1"], 2);
      // 各 1 票、皆達 ceil(2/2)=1 → 第一個達標的選項贏
      expect(r.isComplete).toBe(true);
      expect(r.winningOptionId).not.toBeNull();
    });
  });

  describe("unanimous 模式", () => {
    it("3 人 2 票同選項 → 未完成（需全員）", () => {
      const r = computeVoteCompletion("unanimous", ["option_0", "option_0"], 3);
      expect(r.isComplete).toBe(false);
    });

    it("3 人 3 票同選項 → 完成", () => {
      const r = computeVoteCompletion(
        "unanimous",
        ["option_0", "option_0", "option_0"],
        3,
      );
      expect(r.isComplete).toBe(true);
      expect(r.winningOptionId).toBe("option_0");
    });

    it("3 人 3 票不同選項 → 未完成（未全體同意）", () => {
      const r = computeVoteCompletion(
        "unanimous",
        ["option_0", "option_0", "option_1"],
        3,
      );
      expect(r.isComplete).toBe(false);
    });
  });

  describe("成員離開重算情境（分母縮小）", () => {
    it("3 人 2 票未達（分散）→ 1 人離開分母變 2 → option 有 1 票即過半", () => {
      // 離開前：3 人、option_0=1 / option_1=1 → 未完成
      const before = computeVoteCompletion("majority", ["option_0", "option_1"], 3);
      expect(before.isComplete).toBe(false);
      // 離開後重算：2 人、ceil(2/2)=1 → 完成
      const after = computeVoteCompletion("majority", ["option_0", "option_1"], 2);
      expect(after.isComplete).toBe(true);
    });
  });

  describe("邊界", () => {
    it("分母 0（隊伍無人）→ 不完成", () => {
      const r = computeVoteCompletion("majority", ["option_0"], 0);
      expect(r.isComplete).toBe(false);
    });

    it("無票 → 不完成", () => {
      const r = computeVoteCompletion("majority", [], 3);
      expect(r.isComplete).toBe(false);
      expect(r.voteCounts).toEqual({});
    });

    it("voteCounts 正確彙總", () => {
      const r = computeVoteCompletion(
        "majority",
        ["option_0", "option_1", "option_0"],
        5,
      );
      expect(r.voteCounts).toEqual({ option_0: 2, option_1: 1 });
    });
  });
});
