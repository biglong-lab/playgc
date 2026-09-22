// 🎮 大廳遊戲卡（2026-09-22 自 Home.tsx 拆出 — Home 原 1123 行超過上限）
// 行為不變：未完成的卡整張可點進遊戲；已完成的卡只有「再玩一次」按鈕可點。
import type { Game } from "@shared/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import GenericCoverFallback from "@/components/shared/GenericCoverFallback";
import EditableCoverImage from "@/components/shared/EditableCoverImage";
import {
  Clock, Users, Star, Trophy, Play, RotateCcw, CheckCircle2, TrendingUp,
} from "lucide-react";

export interface UserGameStatus {
  gameId: string;
  status: "playing" | "completed";
  sessionId: string;
  score: number;
}

export interface GameStats {
  totalPlays: number;
  uniquePlayers: number;
  completedPlays: number;
}

interface LobbyGameCardProps {
  game: Game;
  status?: UserGameStatus;
  stats?: GameStats;
  canEditField: boolean;
  onSaveCover: (gameId: string, data: { src?: string; position?: string }) => Promise<void>;
  /** 點卡片（開始 / 繼續） */
  onOpen: (game: Game) => void;
  /** 已完成卡的「再玩一次」 */
  onReplay: (game: Game) => void;
}

const DIFFICULTY_STYLE: Record<string, { color: string; label: string }> = {
  easy: { color: "bg-success/20 text-success border-success/30", label: "簡單" },
  medium: { color: "bg-warning/20 text-warning border-warning/30", label: "中等" },
  hard: { color: "bg-destructive/20 text-destructive border-destructive/30", label: "困難" },
};

function difficultyStyle(difficulty: string) {
  return DIFFICULTY_STYLE[difficulty] ?? { color: "bg-muted text-muted-foreground", label: difficulty };
}

// CTA 文案依 gameStructure / gameMode 動態化
function getStartLabel(game: Game): string {
  if (game.gameStructure === "chapters") return "選擇章節";
  if (game.gameMode === "team") return "創建或加入隊伍";
  if (game.gameMode === "relay") return "開始接力賽";
  if (game.gameMode === "competitive") return "開始競賽";
  return "開始遊戲";
}

// 🔄 2026-05-02 統一語意：所有「已完成過、再來一場」的 CTA 都用「再玩一次」
function getReplayLabel(game: Game): string {
  return game.gameStructure === "chapters" ? "再玩一次（重選章節）" : "再玩一次";
}

function getContinueLabel(game: Game): string {
  if (game.gameStructure === "chapters") return "繼續章節";
  if (game.gameMode === "team") return "返回隊伍";
  return "返回遊戲";
}

function modeBadge(game: Game) {
  if (game.gameMode === "team") return { icon: <Users className="w-3 h-3" />, label: "團隊" };
  if (game.gameMode === "competitive") return { icon: <Trophy className="w-3 h-3" />, label: "競賽" };
  return undefined;
}

function StatusBadge({ gameId, status }: { gameId: string; status?: UserGameStatus }) {
  if (status?.status === "playing") {
    return (
      <Badge
        className="absolute top-3 left-3 gap-1 bg-warning text-warning-foreground border-warning shadow-md"
        data-testid={`badge-status-playing-${gameId}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning-foreground/70 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-warning-foreground" />
        </span>
        進行中
      </Badge>
    );
  }
  if (status?.status === "completed") {
    return (
      <Badge
        className="absolute top-3 left-3 gap-1 bg-success text-white border-success shadow-md"
        data-testid={`badge-status-completed-${gameId}`}
      >
        <CheckCircle2 className="w-3 h-3" />
        已完成
      </Badge>
    );
  }
  return null;
}

function GameCover({ game, canEditField, onSaveCover }: Pick<LobbyGameCardProps, "game" | "canEditField" | "onSaveCover">) {
  const fallback = <GenericCoverFallback name={game.title} badge={modeBadge(game)} />;
  // admin 可拖拉調焦點 + 快速換封面（v2 2026-04-30）
  if (!game.coverImageUrl && !canEditField) return fallback;
  return (
    <EditableCoverImage
      src={game.coverImageUrl}
      alt={game.title}
      position={(game as { coverImagePosition?: string }).coverImagePosition || "50% 50%"}
      isAdmin={canEditField}
      uploadEndpoint={`/api/admin/games/${game.id}/cloudinary-cover`}
      onSave={(data) => onSaveCover(game.id, data)}
      preset="card"
      testId={`game-cover-${game.id}`}
      fallback={fallback}
    />
  );
}

function StatsRow({ gameId, stats }: { gameId: string; stats?: GameStats }) {
  // 累計遊玩次數 / 玩過人數（非即時）
  if (!stats || (stats.totalPlays === 0 && stats.uniquePlayers === 0)) return null;
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t">
      <div className="flex items-center gap-1" data-testid={`stats-plays-${gameId}`}>
        <TrendingUp className="w-3.5 h-3.5 text-primary/70" />
        <span>累計 <span className="font-number font-semibold text-foreground">{stats.totalPlays}</span> 場</span>
      </div>
      <div className="flex items-center gap-1" data-testid={`stats-players-${gameId}`}>
        <Star className="w-3.5 h-3.5 text-warning/80" />
        <span><span className="font-number font-semibold text-foreground">{stats.uniquePlayers}</span> 人玩過</span>
      </div>
    </div>
  );
}

function CardCta({ game, status, onReplay }: Pick<LobbyGameCardProps, "game" | "status" | "onReplay">) {
  if (status?.status === "completed") {
    return (
      <div className="w-full space-y-2">
        <div className="flex items-center justify-center gap-2 text-success py-2">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-medium">遊戲已完成 - {status.score} 分</span>
        </div>
        <Button
          variant="outline"
          className="w-full gap-2"
          data-testid={`button-replay-game-${game.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onReplay(game);
          }}
        >
          <RotateCcw className="w-4 h-4" />
          {getReplayLabel(game)}
        </Button>
      </div>
    );
  }
  if (status?.status === "playing") {
    return (
      <Button className="w-full gap-2 bg-warning text-warning-foreground hover:bg-warning/90" data-testid={`button-continue-game-${game.id}`}>
        <Play className="w-4 h-4" />
        {getContinueLabel(game)}
      </Button>
    );
  }
  return (
    <Button className="w-full gap-2" data-testid={`button-start-game-${game.id}`}>
      {game.gameMode === "team" ? <Users className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      {getStartLabel(game)}
    </Button>
  );
}

export default function LobbyGameCard(props: LobbyGameCardProps) {
  const { game, status, stats, onOpen } = props;
  const isCompletedCard = status?.status === "completed";
  const difficulty = difficultyStyle(game.difficulty || "medium");

  return (
    <Card
      className={isCompletedCard ? "overflow-hidden group" : "overflow-hidden group hover-elevate cursor-pointer"}
      onClick={isCompletedCard ? undefined : () => onOpen(game)}
      data-testid={`card-game-${game.id}`}
    >
      <div
        className="relative h-48 bg-card overflow-hidden"
        onClick={(e) => {
          // admin 點到「編輯封面」相關按鈕時不該觸發進入遊戲
          const target = e.target as HTMLElement;
          if (!target.closest('[data-testid^="game-cover-"]')) return;
          if (target.closest('[data-edit-mode="true"]') || target.closest("button")) e.stopPropagation();
        }}
      >
        <GameCover game={game} canEditField={props.canEditField} onSaveCover={props.onSaveCover} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
        <Badge className={`absolute top-3 right-3 ${difficulty.color}`}>{difficulty.label}</Badge>
        <StatusBadge gameId={game.id} status={status} />
      </div>

      <CardContent className="p-4">
        <h3 className="font-display font-bold text-lg mb-2 group-hover:text-primary transition-colors">
          {game.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4" title={game.description || ""}>
          {game.description || "無描述"}
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          {/* 沒設時長就不顯示，而不是預設 30 分鐘誤導玩家 */}
          {game.estimatedTime ? (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>約 {game.estimatedTime} 分鐘</span>
            </div>
          ) : null}
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {game.gameMode === "team" ? (
              <span>{game.minTeamPlayers || 2}-{game.maxTeamPlayers || 6} 人組隊</span>
            ) : (
              <span>最多 {game.maxPlayers || 6} 人</span>
            )}
          </div>
        </div>
        <StatsRow gameId={game.id} stats={stats} />
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <CardCta game={game} status={status} onReplay={props.onReplay} />
      </CardFooter>
    </Card>
  );
}
