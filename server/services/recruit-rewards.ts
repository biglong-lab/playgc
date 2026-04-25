// 招募獎勵實寫 service — Phase 14.4
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §13.1
//
// 雙向獎勵規則：
//   - 新人：被招募加入 → +50 體驗點
//   - 推薦人：成功招募 → +50 體驗點（超級隊長 ×2 = 100）
//   - 新人首戰：+30 體驗點（額外給新人）
//   - 推薦人收成（新人首戰）：+50 體驗點（如果是超級隊長）
//   - 新人 5 場達標：+100 體驗點 + 「常客新生」徽章
//
// 設計關鍵：所有獎勵都寫進「新人加入後的 squad」+「推薦人的 squad」的 squad_stats
// （新人加入「火焰戰士」→ 新人不一定有自己的 squad；推薦人是「火焰戰士」隊長）
//
// 簡化：新人沒個人 squad → 獎勵只給推薦人那隊
//
import { db } from "../db";
import { squadStats, squadAchievements } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { RECRUIT_REWARD_CONFIG } from "./recruit-rewards-config";

const RECRUIT_BONUS_BASE = RECRUIT_REWARD_CONFIG.RECRUIT_BONUS_BASE;
const SUPER_LEADER_MULTIPLIER = RECRUIT_REWARD_CONFIG.SUPER_LEADER_MULTIPLIER;
const FIRST_GAME_BONUS_NEW_USER = RECRUIT_REWARD_CONFIG.FIRST_GAME_BONUS_NEW_USER;
const FIRST_GAME_BONUS_SUPER_RECRUITER =
  RECRUIT_REWARD_CONFIG.FIRST_GAME_BONUS_SUPER_RECRUITER;
const FIVE_GAMES_MILESTONE_BONUS =
  RECRUIT_REWARD_CONFIG.FIVE_GAMES_MILESTONE_BONUS;

export interface RecruitContext {
  inviterSquadId: string;
  inviteeUserId: string;
  isSuperLeader: boolean;
}

/**
 * 雙向招募獎勵發放（推薦人那隊 + 新人）
 *
 * 觸發點：邀請接受 (POST /api/invites/:token/accept)
 *
 * 寫入：
 *   - inviter squad totalExpPoints += base × multiplier（招募人那隊獲得）
 *   - inviter squad recruitsCount += 1
 *
 * 注意：新人本身的 squad（如果有）獎勵會在新人首戰時寫入
 */
export async function applyRecruitJoinReward(
  ctx: RecruitContext,
): Promise<{ inviterBonus: number; multiplier: number }> {
  const multiplier = ctx.isSuperLeader ? SUPER_LEADER_MULTIPLIER : 1;
  const inviterBonus = RECRUIT_BONUS_BASE * multiplier;

  await db
    .update(squadStats)
    .set({
      totalExpPoints: sql`${squadStats.totalExpPoints} + ${inviterBonus}`,
      recruitsCount: sql`${squadStats.recruitsCount} + 1`,
      monthlyRecruits: sql`${squadStats.monthlyRecruits} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(squadStats.squadId, ctx.inviterSquadId));

  return { inviterBonus, multiplier };
}

/**
 * 新人首戰獎勵（從 invite 來的玩家完成第一場時觸發）
 *
 * 寫入：
 *   1. 新人 squad（如果有）：+30 體驗點
 *   2. 推薦人 squad（如果是超級隊長）：再額外 +50
 */
export async function applyFirstGameReward(opts: {
  newUserSquadId?: string;
  inviterSquadId: string;
  isInviterSuperLeader: boolean;
}): Promise<{ newUserBonus: number; inviterBonus: number }> {
  let newUserBonus = 0;
  let inviterBonus = 0;

  // 新人 squad 加首戰點數
  if (opts.newUserSquadId) {
    newUserBonus = FIRST_GAME_BONUS_NEW_USER;
    await db
      .update(squadStats)
      .set({
        totalExpPoints: sql`${squadStats.totalExpPoints} + ${newUserBonus}`,
        updatedAt: new Date(),
      })
      .where(eq(squadStats.squadId, opts.newUserSquadId));
  }

  // 超級隊長收成
  if (opts.isInviterSuperLeader) {
    inviterBonus = FIRST_GAME_BONUS_SUPER_RECRUITER;
    await db
      .update(squadStats)
      .set({
        totalExpPoints: sql`${squadStats.totalExpPoints} + ${inviterBonus}`,
        updatedAt: new Date(),
      })
      .where(eq(squadStats.squadId, opts.inviterSquadId));
  }

  return { newUserBonus, inviterBonus };
}

/**
 * 5 場達標里程碑（新人完成第 5 場時觸發）
 *
 * 寫入：
 *   1. 新人 squad：+100 體驗點
 *   2. 「常客新生」徽章（regular_100 — 已由 achievement-scheduler 處理 100 點數里程碑）
 */
export async function applyFiveGamesMilestone(opts: {
  squadId: string;
}): Promise<{ bonus: number }> {
  const bonus = FIVE_GAMES_MILESTONE_BONUS;
  await db
    .update(squadStats)
    .set({
      totalExpPoints: sql`${squadStats.totalExpPoints} + ${bonus}`,
      updatedAt: new Date(),
    })
    .where(eq(squadStats.squadId, opts.squadId));

  // 額外發「五戰新銳」徽章（避免和成就 cron 重疊用獨立 key）
  try {
    await db
      .insert(squadAchievements)
      .values({
        squadId: opts.squadId,
        achievementKey: "five_games_milestone",
        category: "milestone",
        displayName: "五戰新銳",
        description: "新人完成 5 場挑戰",
      })
      .onConflictDoNothing();
  } catch (e) {
    console.warn("[recruit-rewards] 徽章寫入失敗:", e);
  }

  return { bonus };
}

export { RECRUIT_REWARD_CONFIG } from "./recruit-rewards-config";
