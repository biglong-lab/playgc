// 招募獎勵金額常數 — 純資料（無 db 依賴，可單元測試）
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §13.1

export const RECRUIT_REWARD_CONFIG = {
  RECRUIT_BONUS_BASE: 50,
  SUPER_LEADER_MULTIPLIER: 2,
  FIRST_GAME_BONUS_NEW_USER: 30,
  FIRST_GAME_BONUS_SUPER_RECRUITER: 50,
  FIVE_GAMES_MILESTONE_BONUS: 100,
} as const;

export function calcRecruitJoinBonus(isSuperLeader: boolean): number {
  return RECRUIT_REWARD_CONFIG.RECRUIT_BONUS_BASE *
    (isSuperLeader ? RECRUIT_REWARD_CONFIG.SUPER_LEADER_MULTIPLIER : 1);
}
