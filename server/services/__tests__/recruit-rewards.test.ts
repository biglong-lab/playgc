import { describe, expect, it } from "vitest";
import {
  RECRUIT_REWARD_CONFIG,
  calcRecruitJoinBonus,
} from "../recruit-rewards-config";

describe("recruit-rewards constants", () => {
  it("符合設計文件 §13.1 的金額", () => {
    expect(RECRUIT_REWARD_CONFIG.RECRUIT_BONUS_BASE).toBe(50);
    expect(RECRUIT_REWARD_CONFIG.SUPER_LEADER_MULTIPLIER).toBe(2);
    expect(RECRUIT_REWARD_CONFIG.FIRST_GAME_BONUS_NEW_USER).toBe(30);
    expect(RECRUIT_REWARD_CONFIG.FIRST_GAME_BONUS_SUPER_RECRUITER).toBe(50);
    expect(RECRUIT_REWARD_CONFIG.FIVE_GAMES_MILESTONE_BONUS).toBe(100);
  });

  it("一般隊長 ×1 招募獎勵 = 50", () => {
    expect(RECRUIT_REWARD_CONFIG.RECRUIT_BONUS_BASE).toBe(50);
  });

  it("超級隊長 ×2 招募獎勵 = 100", () => {
    expect(
      RECRUIT_REWARD_CONFIG.RECRUIT_BONUS_BASE *
        RECRUIT_REWARD_CONFIG.SUPER_LEADER_MULTIPLIER,
    ).toBe(100);
  });

  it("calcRecruitJoinBonus(false) = 50", () => {
    expect(calcRecruitJoinBonus(false)).toBe(50);
  });

  it("calcRecruitJoinBonus(true) = 100", () => {
    expect(calcRecruitJoinBonus(true)).toBe(100);
  });
});
