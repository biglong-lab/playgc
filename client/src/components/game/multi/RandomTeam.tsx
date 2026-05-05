// 🎲 RandomTeam — 隨機組隊，L3 持久化
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Shuffle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TeamSlot {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export interface RandomTeamConfig {
  title: string;
  subtitle?: string;
  teams: TeamSlot[];
  startText?: string;
}

export interface WaitingMember {
  userId: string;
  userName: string;
}

export interface MemberAssignment {
  userId: string;
  userName: string;
  teamId: string;
}

export interface RandomTeamState extends Record<string, unknown> {
  waiting: WaitingMember[];
  assignments: MemberAssignment[];
  phase: "waiting" | "assigned";
  hostUserId: string | null;
}

interface RandomTeamProps {
  config: RandomTeamConfig;
  state: RandomTeamState;
  myUserId: string;
  onJoinWaiting: () => Promise<void>;
  onShuffle: () => Promise<void>;
  onReset: () => Promise<void>;
}

function TeamRoster({ team, assignments }: { team: TeamSlot; assignments: MemberAssignment[] }) {
  const members = assignments.filter((a) => a.teamId === team.id);
  return (
    <div
      data-testid={`team-roster-${team.id}`}
      className={cn("p-3 rounded-xl border-2", `border-${team.color}-300 dark:border-${team.color}-700`)}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{team.emoji}</span>
        <span className="font-bold">{team.name}</span>
        <Badge variant="secondary" className="ml-auto">{members.length} 人</Badge>
      </div>
      <div className="space-y-1">
        {members.length === 0 ? (
          <div className="text-xs text-muted-foreground">（尚無成員）</div>
        ) : (
          members.map((m) => (
            <div key={m.userId} data-testid={`member-${m.userId}`} className="text-sm px-2 py-1 rounded bg-muted">
              {m.userName}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function RandomTeam({ config, state, myUserId, onJoinWaiting, onShuffle, onReset }: RandomTeamProps) {
  const { waiting, assignments, phase, hostUserId } = state;
  const isInWaiting = waiting.some((w) => w.userId === myUserId);
  const myAssignment = assignments.find((a) => a.userId === myUserId);
  const isHost = hostUserId === myUserId;
  const myTeam = myAssignment ? config.teams.find((t) => t.id === myAssignment.teamId) : null;

  return (
    <Card data-testid="random-team-root">
      <CardContent className="p-6 space-y-5">
        {/* 標題 */}
        <div className="text-center">
          <h2 data-testid="random-team-title" className="text-2xl font-bold">{config.title}</h2>
          {config.subtitle && (
            <p data-testid="random-team-subtitle" className="text-muted-foreground text-sm mt-1">{config.subtitle}</p>
          )}
        </div>

        {phase === "waiting" && (
          <>
            {/* 等待人數 */}
            <div data-testid="waiting-count" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {waiting.length} 人等待分組
            </div>

            {/* 等待名單 */}
            {waiting.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {waiting.map((w) => (
                  <Badge key={w.userId} data-testid={`waiting-badge-${w.userId}`} variant="secondary">
                    {w.userName}
                  </Badge>
                ))}
              </div>
            )}

            {/* 加入等待 */}
            {!isInWaiting ? (
              <Button
                data-testid="join-waiting-btn"
                size="lg"
                onClick={onJoinWaiting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                🙋 我要參加分組
              </Button>
            ) : (
              <div data-testid="joined-waiting" className="text-center text-green-600 font-medium py-2">
                ✅ 已加入等待！等待分組開始…
              </div>
            )}

            {/* 分組按鈕 (任何人都可以觸發) */}
            {waiting.length >= 2 && (
              <Button
                data-testid="shuffle-btn"
                variant="outline"
                className="w-full border-purple-400 text-purple-600 hover:bg-purple-50"
                onClick={onShuffle}
              >
                <Shuffle className="w-4 h-4 mr-2" />
                {config.startText ?? "開始分組！"}
              </Button>
            )}

            {/* 預覽隊伍 */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">分組方案</h3>
              <div className="grid grid-cols-2 gap-2">
                {config.teams.map((team) => (
                  <div key={team.id} className="flex items-center gap-2 p-2 rounded border text-sm">
                    <span>{team.emoji}</span>
                    <span>{team.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {phase === "assigned" && (
          <>
            {/* 我的隊伍 */}
            {myAssignment && myTeam ? (
              <div
                data-testid="my-team-result"
                className="text-center p-5 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 border-2 border-purple-300"
              >
                <div className="text-4xl mb-2">{myTeam.emoji}</div>
                <div className="text-lg font-bold">{myTeam.name}</div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  你的隊伍
                </div>
              </div>
            ) : waiting.some((w) => w.userId !== myUserId) && (
              <div data-testid="not-assigned" className="text-center text-muted-foreground text-sm py-4">
                你不在本次分組名單中
              </div>
            )}

            {/* 所有隊伍名單 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">完整分組結果</h3>
              {config.teams.map((team) => (
                <TeamRoster key={team.id} team={team} assignments={assignments} />
              ))}
            </div>

            {/* 重新分組 (host only) */}
            {isHost && (
              <Button
                data-testid="reset-btn"
                variant="outline"
                size="sm"
                onClick={onReset}
                className="w-full"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                重新分組
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
