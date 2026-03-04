// 水彈對戰 PK 擂台 — 配對引擎（蛇形分配 + 預組小隊保護）
import type { BattleRegistration, BattleVenue, BattleSlot, BattlePremadeGroup } from "@shared/schema";

/** 隊伍分配結果 */
export interface TeamAssignment {
  teamIndex: number;
  teamName: string;
  members: { userId: string; registrationId: string; premadeGroupId?: string | null }[];
}

/** 配對結果 */
export interface MatchmakingResult {
  teams: TeamAssignment[];
  unassigned: string[]; // 無法分配的 userId（人數不足時）
}

/** 技能等級數值映射 */
const SKILL_VALUES: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

/** 產生隊伍名稱 */
function getTeamName(index: number): string {
  const names = ["紅隊", "藍隊", "綠隊", "黃隊", "紫隊", "橙隊"];
  return names[index] ?? `隊伍 ${index + 1}`;
}

/**
 * 蛇形分配演算法
 *
 * 1. 先將預組小隊（keepTogether=true）整組放入人數最少的隊伍
 * 2. 剩餘散客依技能等級排序，用蛇形順序分配
 *    - 第 1 輪: 隊伍 0, 1, 2, ... N-1
 *    - 第 2 輪: 隊伍 N-1, N-2, ... 0
 *    - 以此交替確保平衡
 */
export function assignTeams(
  registrations: BattleRegistration[],
  premadeGroups: BattlePremadeGroup[],
  venue: BattleVenue,
  slot: BattleSlot,
): MatchmakingResult {
  const maxTeams = venue.maxTeams;
  const teamSize = venue.teamSize;

  // 初始化隊伍
  const teams: TeamAssignment[] = Array.from({ length: maxTeams }, (_, i) => ({
    teamIndex: i,
    teamName: getTeamName(i),
    members: [],
  }));

  // 建立報名查詢 Map (userId → registration)
  const regMap = new Map(
    registrations
      .filter((r) => r.status !== "cancelled")
      .map((r) => [r.userId, r]),
  );

  const assigned = new Set<string>();

  // 第一步：分配 keepTogether 的預組小隊
  const keepTogetherGroups = premadeGroups
    .filter((g) => g.keepTogether)
    .sort((a, b) => b.memberCount - a.memberCount); // 大隊先分配

  for (const group of keepTogetherGroups) {
    const groupMembers = registrations.filter(
      (r) => r.premadeGroupId === group.id && r.status !== "cancelled",
    );
    if (groupMembers.length === 0) continue;

    // 找人數最少的隊伍
    const targetTeam = teams.reduce((min, t) =>
      t.members.length < min.members.length ? t : min,
    );

    // 檢查隊伍是否容納得下
    if (targetTeam.members.length + groupMembers.length > teamSize) {
      // 嘗試其他隊伍
      const availableTeam = teams.find(
        (t) => t.members.length + groupMembers.length <= teamSize,
      );
      if (!availableTeam) continue; // 無法整組塞入，跳過
      for (const member of groupMembers) {
        availableTeam.members.push({
          userId: member.userId,
          registrationId: member.id,
          premadeGroupId: member.premadeGroupId,
        });
        assigned.add(member.userId);
      }
    } else {
      for (const member of groupMembers) {
        targetTeam.members.push({
          userId: member.userId,
          registrationId: member.id,
          premadeGroupId: member.premadeGroupId,
        });
        assigned.add(member.userId);
      }
    }
  }

  // 第二步：收集未分配的散客 + 不要求同隊的預組成員
  const unassignedRegs = registrations.filter(
    (r) => !assigned.has(r.userId) && r.status !== "cancelled",
  );

  // 依技能排序（高技能優先，確保蛇形分配時平衡）
  unassignedRegs.sort((a, b) => {
    const skillA = SKILL_VALUES[a.skillLevel ?? "beginner"] ?? 1;
    const skillB = SKILL_VALUES[b.skillLevel ?? "beginner"] ?? 1;
    return skillB - skillA;
  });

  // 蛇形分配
  let round = 0;
  let idx = 0;
  const unassignedUserIds: string[] = [];

  for (const reg of unassignedRegs) {
    // 計算蛇形順序
    const teamOrder = round % 2 === 0
      ? idx % maxTeams
      : maxTeams - 1 - (idx % maxTeams);

    const team = teams[teamOrder];

    if (team.members.length >= teamSize) {
      // 所有隊伍都滿了
      unassignedUserIds.push(reg.userId);
    } else {
      team.members.push({
        userId: reg.userId,
        registrationId: reg.id,
        premadeGroupId: reg.premadeGroupId,
      });
      assigned.add(reg.userId);
    }

    idx++;
    if (idx % maxTeams === 0) {
      round++;
    }
  }

  return { teams, unassigned: unassignedUserIds };
}

/**
 * 檢查時段是否已達到自動配對條件
 */
export function shouldAutoMatch(
  slot: BattleSlot,
  venue: BattleVenue,
  activeCount: number,
): boolean {
  const minPlayers = slot.minPlayersOverride ?? venue.minPlayers;
  return activeCount >= minPlayers;
}
