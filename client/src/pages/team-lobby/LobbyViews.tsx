// 隊伍大廳 View 元件
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users, Copy, Check, Play, LogOut, Crown, Loader2,
  RefreshCw, ArrowLeft, UserPlus, Wifi, WifiOff,
} from "lucide-react";
import type { Game, TeamMember, User } from "@shared/schema";
import type { TeamWithDetails } from "./useTeamLobby";

// 載入畫面
export function LoadingView() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

// 遊戲不存在
export function GameNotFoundView({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">找不到此遊戲</p>
          <Button onClick={onBack} className="mt-4" data-testid="button-back-games">
            返回遊戲列表
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// 非團隊模式
export function SoloModeView({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">此遊戲為個人模式，不需要組隊</p>
          <Button onClick={onStart} className="mt-4" data-testid="button-start-solo">
            開始遊戲
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// 無隊伍 - 組隊表單
interface JoinOrCreateProps {
  game: Game;
  teamName: string;
  setTeamName: (v: string) => void;
  accessCode: string;
  setAccessCode: (v: string) => void;
  showJoinForm: boolean;
  setShowJoinForm: (v: boolean) => void;
  onCreateTeam: () => void;
  onJoinTeam: () => void;
  onBack: () => void;
  createPending: boolean;
  joinPending: boolean;
}

export function JoinOrCreateView({
  game, teamName, setTeamName, accessCode, setAccessCode,
  showJoinForm, setShowJoinForm, onCreateTeam, onJoinTeam,
  onBack, createPending, joinPending,
}: JoinOrCreateProps) {
  return (
    <div className="min-h-screen bg-background">
      <LobbyHeader
        title={game.title}
        subtitle="團隊模式 - 組隊大廳"
        onBack={onBack}
      />
      <main className="container max-w-md py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              加入或創建隊伍
            </CardTitle>
            <CardDescription>
              此遊戲需要 {game.minTeamPlayers || 2} 至 {game.maxTeamPlayers || 6} 位玩家一起進行
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {showJoinForm ? (
              <JoinTeamForm
                accessCode={accessCode}
                setAccessCode={setAccessCode}
                onJoin={onJoinTeam}
                onCancel={() => setShowJoinForm(false)}
                joinPending={joinPending}
              />
            ) : (
              <CreateTeamForm
                teamName={teamName}
                setTeamName={setTeamName}
                onCreate={onCreateTeam}
                onShowJoin={() => setShowJoinForm(true)}
                createPending={createPending}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// 隊伍大廳主畫面
interface TeamLobbyViewProps {
  game: Game;
  team: TeamWithDetails;
  wsConnected: boolean;
  copied: boolean;
  myMembership: (TeamMember & { user: User }) | undefined;
  allReady: boolean;
  hasEnoughPlayers: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onCopyCode: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeaveTeam: () => void;
  readyPending: boolean;
  startPending: boolean;
  leavePending: boolean;
}

export function TeamLobbyView({
  game, team, wsConnected, copied, myMembership,
  allReady, hasEnoughPlayers,
  onBack, onRefresh, onCopyCode, onToggleReady, onStartGame, onLeaveTeam,
  readyPending, startPending, leavePending,
}: TeamLobbyViewProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-lg">{team.name}</h1>
              <p className="text-sm text-muted-foreground">{game.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wsConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            )}
            <Button variant="ghost" size="icon" onClick={onRefresh} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-md py-6 space-y-6">
        <AccessCodeCard code={team.accessCode} status={team.status} copied={copied} onCopy={onCopyCode} />
        <MemberListCard team={team} />

        {!hasEnoughPlayers && (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription>
              需要再有 {(team.minPlayers || 2) - team.members.length} 位玩家加入才能開始遊戲
            </AlertDescription>
          </Alert>
        )}

        <LobbyActions
          myMembership={myMembership}
          hasLeader={!!team.leaderId}
          hasEnoughPlayers={hasEnoughPlayers}
          allReady={allReady}
          onToggleReady={onToggleReady}
          onStartGame={onStartGame}
          onLeaveTeam={onLeaveTeam}
          readyPending={readyPending}
          startPending={startPending}
          leavePending={leavePending}
        />
      </main>
    </div>
  );
}

// ===== 私有子元件 =====

function LobbyHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
      <div className="px-4 py-3 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-display font-bold text-lg">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}

function JoinTeamForm({
  accessCode, setAccessCode, onJoin, onCancel, joinPending,
}: {
  accessCode: string; setAccessCode: (v: string) => void;
  onJoin: () => void; onCancel: () => void; joinPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">輸入組隊碼</label>
        <Input
          placeholder="例如：ABC123"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="font-mono text-center text-lg tracking-widest"
          data-testid="input-access-code"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} data-testid="button-cancel-join">
          取消
        </Button>
        <Button
          className="flex-1 gap-2"
          onClick={onJoin}
          disabled={joinPending || accessCode.length < 6}
          data-testid="button-confirm-join"
        >
          {joinPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          加入隊伍
        </Button>
      </div>
    </div>
  );
}

function CreateTeamForm({
  teamName, setTeamName, onCreate, onShowJoin, createPending,
}: {
  teamName: string; setTeamName: (v: string) => void;
  onCreate: () => void; onShowJoin: () => void; createPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">隊伍名稱（選填）</label>
        <Input
          placeholder="例如：勇者小隊"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          maxLength={50}
          data-testid="input-team-name"
        />
      </div>
      <Button className="w-full gap-2" onClick={onCreate} disabled={createPending} data-testid="button-create-team">
        {createPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
        創建隊伍
      </Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">或</span>
        </div>
      </div>
      <Button variant="outline" className="w-full gap-2" onClick={onShowJoin} data-testid="button-show-join">
        <UserPlus className="w-4 h-4" />
        輸入組隊碼加入
      </Button>
    </div>
  );
}

function AccessCodeCard({
  code, status, copied, onCopy,
}: { code: string | null; status: string | null; copied: boolean; onCopy: () => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>組隊碼</span>
          <Badge variant={status === "ready" ? "default" : "secondary"}>
            {status === "forming" && "組隊中"}
            {status === "ready" && "準備完成"}
            {status === "playing" && "遊戲中"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-lg p-4 text-center">
            <span className="font-mono text-3xl font-bold tracking-[0.3em]" data-testid="text-access-code">
              {code}
            </span>
          </div>
          <Button variant="outline" size="icon" onClick={onCopy} data-testid="button-copy-code">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          分享此組隊碼給朋友，讓他們加入隊伍
        </p>
      </CardContent>
    </Card>
  );
}

function MemberListCard({ team }: { team: TeamWithDetails }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          隊伍成員 ({team.members.length}/{team.maxPlayers || 6})
        </CardTitle>
        <CardDescription>需要至少 {team.minPlayers || 2} 位玩家才能開始</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {team.members.map((member) => (
          <MemberRow key={member.id} member={member} />
        ))}
        {team.members.length < (team.maxPlayers || 6) && (
          <div className="flex items-center gap-3 p-2 rounded-lg border border-dashed opacity-50">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">等待更多玩家加入...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MemberRow({ member }: { member: TeamMember & { user: User } }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover-elevate" data-testid={`member-${member.userId}`}>
      <Avatar className="w-10 h-10">
        <AvatarImage src={member.user?.profileImageUrl || undefined} />
        <AvatarFallback>
          {member.user?.firstName?.[0] || member.user?.email?.[0] || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">
            {member.user?.firstName || member.user?.email?.split("@")[0] || "玩家"}
          </span>
          {member.role === "leader" && <Crown className="w-4 h-4 text-yellow-500" />}
        </div>
        <p className="text-xs text-muted-foreground">
          {member.role === "leader" ? "隊長" : "隊員"}
        </p>
      </div>
      <Badge variant={member.isReady ? "default" : "outline"}>
        {member.isReady ? "準備完成" : "未準備"}
      </Badge>
    </div>
  );
}

function LobbyActions({
  myMembership, hasLeader, hasEnoughPlayers, allReady,
  onToggleReady, onStartGame, onLeaveTeam,
  readyPending, startPending, leavePending,
}: {
  myMembership: (TeamMember & { user: User }) | undefined;
  hasLeader: boolean;
  hasEnoughPlayers: boolean;
  allReady: boolean;
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeaveTeam: () => void;
  readyPending: boolean;
  startPending: boolean;
  leavePending: boolean;
}) {
  const isReady = myMembership?.isReady;

  return (
    <div className="space-y-3">
      <Button
        className="w-full gap-2"
        variant={isReady ? "secondary" : "default"}
        onClick={onToggleReady}
        disabled={readyPending}
        data-testid="button-ready"
      >
        {readyPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isReady ? (
          <Check className="w-4 h-4" />
        ) : null}
        {isReady ? "取消準備" : "準備完成"}
      </Button>

      {hasLeader && (
        <Button
          className="w-full gap-2"
          onClick={onStartGame}
          disabled={!hasEnoughPlayers || !allReady || startPending}
          data-testid="button-start-game"
        >
          {startPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          開始遊戲
        </Button>
      )}

      <Button
        variant="ghost"
        className="w-full gap-2 text-muted-foreground"
        onClick={onLeaveTeam}
        disabled={leavePending}
        data-testid="button-leave-team"
      >
        {leavePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
        離開隊伍
      </Button>
    </div>
  );
}
