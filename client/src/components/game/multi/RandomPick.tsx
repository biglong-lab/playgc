import { Shuffle, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── 型別 ──────────────────────────────────────────────
export interface PickParticipant extends Record<string, unknown> {
  participantId: string;
  userId: string;
  userName: string;
}

export interface RandomPickConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  pickCount: number;
  joinLabel: string;
  pickLabel: string;
}

export interface RandomPickState extends Record<string, unknown> {
  participants: PickParticipant[];
  picks: PickParticipant[];
  drawn: boolean;
}

interface Props {
  config: RandomPickConfig;
  state: RandomPickState;
  userId: string;
  isTeamLead?: boolean;
  onJoin: () => void;
  onDraw: () => void;
  onReset: () => void;
}

// ── 元件 ──────────────────────────────────────────────
export function RandomPick({ config, state, userId, isTeamLead, onJoin, onDraw, onReset }: Props) {
  const hasJoined = state.participants.some((p) => p.userId === userId);
  const isWinner = state.picks.some((p) => p.userId === userId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shuffle className="h-5 w-5 text-purple-500" />
        <h3 className="font-bold text-lg" data-testid="rp-title">
          {config.title}
        </h3>
      </div>
      <p className="text-sm font-medium" data-testid="rp-prompt">
        {config.prompt}
      </p>

      <div className="flex items-center gap-2">
        <Badge variant="outline" data-testid="rp-count">
          <Users className="h-3 w-3 mr-1" />
          {state.participants.length} 人報名
        </Badge>
        <Badge variant="outline" data-testid="rp-pick-count">
          抽 {config.pickCount} 人
        </Badge>
      </div>

      {!hasJoined && !state.drawn && (
        <Button onClick={onJoin} className="w-full" data-testid="rp-join-btn">
          {config.joinLabel}
        </Button>
      )}

      {hasJoined && !state.drawn && (
        <div
          className="border rounded-lg p-3 bg-purple-50 dark:bg-purple-900/20"
          data-testid="rp-joined"
        >
          <p className="text-sm font-medium">已報名！等待抽選...</p>
        </div>
      )}

      {state.participants.length === 0 && !state.drawn && (
        <p
          className="text-sm text-muted-foreground text-center py-4"
          data-testid="rp-empty"
        >
          還沒有人報名
        </p>
      )}

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          報名名單（{state.participants.length} 人）
        </p>
        <div className="flex flex-wrap gap-1" data-testid="rp-participant-list">
          {state.participants.map((p) => (
            <Badge
              key={p.participantId}
              variant="secondary"
              data-testid={`rp-participant-${p.participantId}`}
            >
              {p.userName}
            </Badge>
          ))}
        </div>
      </div>

      {state.drawn && (
        <div className="space-y-3" data-testid="rp-result">
          <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20 text-center">
            <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="font-bold text-lg">抽選結果</p>
            {isWinner && (
              <p className="text-green-600 font-bold mt-1" data-testid="rp-winner-banner">
                恭喜你被抽中！
              </p>
            )}
          </div>
          <div className="space-y-1">
            {state.picks.map((p, i) => (
              <div
                key={p.participantId}
                className="flex items-center gap-2 border rounded p-2"
                data-testid={`rp-pick-${p.participantId}`}
              >
                <span className="font-bold text-yellow-500 w-6">{i + 1}</span>
                <span className="font-medium">{p.userName}</span>
              </div>
            ))}
          </div>
          {isTeamLead && (
            <Button
              variant="outline"
              onClick={onReset}
              className="w-full"
              data-testid="rp-reset-btn"
            >
              重新抽選
            </Button>
          )}
        </div>
      )}

      {isTeamLead && !state.drawn && state.participants.length > 0 && (
        <Button onClick={onDraw} className="w-full" data-testid="rp-draw-btn">
          {config.pickLabel}
        </Button>
      )}
    </div>
  );
}

export default RandomPick;
