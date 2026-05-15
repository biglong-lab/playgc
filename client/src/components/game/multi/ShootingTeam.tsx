// 🎯 ShootingTeam — 隊伍射擊累計分元件（多人協作版）
//
// 與個人版 ShootingMissionPage 的差異：
//   - 隊內所有玩家命中即時累計到隊伍總分
//   - 顯示隊內排行榜（誰打最多 / 誰打最高分）
//   - 達標條件改為「隊伍總命中 ≥ requiredHits」或「隊伍總分 ≥ targetScore」
//   - 個人貢獻顯示在 TeammatePanel
//
// 後端依賴（待 part 2 實作）：
//   - WebSocket "shooting_hit" 事件需附帶 userId（隊內全員都看到）
//   - 後端 hit 紀錄加 team_id 欄位
//   - HMAC 防作弊（前端 simulateHit 帶簽章）
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.3
//
// 測試友善：純 presentational + props 注入 onSimulateHit / 接收 teamHits

import { useMemo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Crosshair, Trophy } from "lucide-react";
import type { ShootingMissionConfig } from "@shared/schema";

// ============================================================================
// 型別
// ============================================================================

/** 隊伍命中紀錄（含 userId，server 端 broadcast 時附加） */
export interface TeamShootingHit {
  userId: string;
  displayName: string;
  hitZone: string; // "bullseye" | "inner" | "outer" 等
  score: number;
  timestamp: string;
}

/** 隊員身份（用於排行榜顯示無命中的隊員） */
export interface TeamMemberInfo {
  userId: string;
  displayName: string;
}

export interface ShootingTeamProps {
  config: ShootingMissionConfig;
  /** 自己的 user id（用於高亮自己） */
  myUserId: string;
  /** 全隊命中紀錄（按時序排列） */
  teamHits: TeamShootingHit[];
  /** 隊伍成員清單（含未命中的） */
  members: TeamMemberInfo[];
  /** 完成時呼叫 */
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
  /** 是否已開始（連到設備、可開始接 hit） */
  isStarted?: boolean;
}

// ============================================================================
// 純函式 helpers（可單獨測試）
// ============================================================================

/** 隊伍總命中數 */
export function accumulateTeamHitCount(hits: TeamShootingHit[]): number {
  return hits.length;
}

/** 隊伍總分 */
export function accumulateTeamScore(hits: TeamShootingHit[]): number {
  return hits.reduce((sum, h) => sum + (h.score ?? 0), 0);
}

/** 按 userId 分組命中數 */
export function groupHitsByUser(
  hits: TeamShootingHit[],
): Map<string, { count: number; score: number; displayName: string }> {
  const map = new Map<
    string,
    { count: number; score: number; displayName: string }
  >();
  hits.forEach((h) => {
    const prev = map.get(h.userId);
    if (prev) {
      prev.count += 1;
      prev.score += h.score ?? 0;
    } else {
      map.set(h.userId, {
        count: 1,
        score: h.score ?? 0,
        displayName: h.displayName,
      });
    }
  });
  return map;
}

/** 取隊內排行（依命中數排序，相同則依分數）— 包含未命中的 0 分隊員 */
export interface RankingEntry {
  userId: string;
  displayName: string;
  count: number;
  score: number;
}

export function getTeamRanking(
  hits: TeamShootingHit[],
  members: TeamMemberInfo[],
): RankingEntry[] {
  const grouped = groupHitsByUser(hits);
  // 確保所有成員都在排行榜（即使沒命中）
  const ranking: RankingEntry[] = members.map((m) => {
    const stat = grouped.get(m.userId);
    return {
      userId: m.userId,
      displayName: m.displayName,
      count: stat?.count ?? 0,
      score: stat?.score ?? 0,
    };
  });
  // 加入有命中但不在 members 清單的玩家（防 server / client 不同步）
  grouped.forEach((stat, userId) => {
    if (!ranking.some((r) => r.userId === userId)) {
      ranking.push({
        userId,
        displayName: stat.displayName,
        count: stat.count,
        score: stat.score,
      });
    }
  });
  // 排序：先依 count 降冪，count 同則依 score 降冪
  ranking.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.score - a.score;
  });
  return ranking;
}

/** 判斷隊伍是否達成目標 */
export function isTeamComplete(
  hits: TeamShootingHit[],
  config: ShootingMissionConfig,
): boolean {
  const totalHits = accumulateTeamHitCount(hits);
  const totalScore = accumulateTeamScore(hits);
  const requiredHits = config.requiredHits ?? 0;
  const targetScore = config.targetScore ?? config.minScore ?? 0;

  // requiredHits 達標 OR targetScore 達標皆算完成（任一即可）
  if (requiredHits > 0 && totalHits >= requiredHits) return true;
  if (targetScore > 0 && totalScore >= targetScore) return true;
  return false;
}

// ============================================================================
// 主元件
// ============================================================================

export default function ShootingTeam({
  config,
  myUserId,
  teamHits,
  members,
  onComplete,
  isStarted = true,
}: ShootingTeamProps) {
  const [hasAdvanced, setHasAdvanced] = useState(false);

  const teamHitCount = useMemo(() => accumulateTeamHitCount(teamHits), [teamHits]);
  const teamScore = useMemo(() => accumulateTeamScore(teamHits), [teamHits]);
  const ranking = useMemo(
    () => getTeamRanking(teamHits, members),
    [teamHits, members],
  );
  const isComplete = useMemo(() => isTeamComplete(teamHits, config), [teamHits, config]);

  const requiredHits = config.requiredHits ?? 0;
  const targetScore = config.targetScore ?? config.minScore ?? 0;

  // 達標 → 1 秒延遲後 onComplete（給玩家看結果動畫）
  useEffect(() => {
    if (!isComplete || hasAdvanced || !isStarted) return;
    const timer = setTimeout(() => {
      setHasAdvanced(true);
      onComplete({ points: teamScore });
    }, 1000);
    return () => clearTimeout(timer);
  }, [isComplete, hasAdvanced, isStarted, teamScore, onComplete]);

  const myStat = ranking.find((r) => r.userId === myUserId);

  // 進度百分比（取較大者）
  const hitProgress = requiredHits > 0 ? (teamHitCount / requiredHits) * 100 : 0;
  const scoreProgress = targetScore > 0 ? (teamScore / targetScore) * 100 : 0;
  const overallProgress = Math.max(hitProgress, scoreProgress);

  return (
    <div className="space-y-4" data-testid="shooting-team">
      {/* 標題 + 規則 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">{config.title ?? "隊伍射擊任務"}</h2>
          </div>
          {config.description && (
            <p className="text-sm text-muted-foreground">{config.description}</p>
          )}
        </CardContent>
      </Card>

      {/* 隊伍總體進度 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Crosshair className="w-4 h-4" />
              隊伍總進度
            </div>
            <Badge variant="outline" className="font-number tabular-nums">
              {requiredHits > 0
                ? `${teamHitCount} / ${requiredHits} 命中`
                : `${teamScore} / ${targetScore} 分`}
            </Badge>
          </div>
          <Progress
            value={Math.min(overallProgress, 100)}
            className="h-3"
            data-testid="shooting-team-overall-progress"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              總命中 <span className="font-number tabular-nums">{teamHitCount}</span>
            </span>
            <span>
              總分 <span className="font-number tabular-nums">{teamScore}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 我的貢獻 */}
      {myStat && (
        <Card data-testid="shooting-team-my-stat">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">你的貢獻</span>
              <span className="font-medium">
                <span className="font-number tabular-nums">{myStat.count}</span>{" "}
                命中 ·{" "}
                <span className="font-number tabular-nums">{myStat.score}</span> 分
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 隊內排行 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5 mb-3 text-sm font-medium">
            <Trophy className="w-4 h-4 text-primary" />
            隊內排行
          </div>
          <div className="space-y-1.5" data-testid="shooting-team-ranking">
            {ranking.map((entry, idx) => {
              const isMe = entry.userId === myUserId;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                    isMe ? "bg-primary/10 border border-primary/30" : ""
                  }`}
                  data-testid={`shooting-team-rank-${idx}`}
                >
                  <span className="w-5 text-center text-muted-foreground font-number tabular-nums">
                    {idx + 1}
                  </span>
                  <span className="flex-1 font-medium truncate">
                    {entry.displayName}
                    {isMe && <span className="ml-1 text-xs text-primary">（你）</span>}
                  </span>
                  <span className="font-number tabular-nums text-muted-foreground">
                    {entry.count}
                  </span>
                  <span className="font-number tabular-nums text-xs text-muted-foreground w-12 text-right">
                    {entry.score} 分
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 完成提示 */}
      {isComplete && !hasAdvanced && (
        <div
          className="text-center text-sm text-success"
          data-testid="shooting-team-complete"
        >
          🎯 隊伍達標！
        </div>
      )}
    </div>
  );
}
