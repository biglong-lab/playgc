// 隊伍大廳主頁面
import { useEffect } from "react";
import { useTeamLobby } from "./team-lobby/useTeamLobby";
import {
  LoadingView, GameNotFoundView, SoloModeView,
  JoinOrCreateView, TeamLobbyView, StartingCountdownView,
} from "./team-lobby/LobbyViews";

export default function TeamLobby() {
  const ctx = useTeamLobby();

  // 🆕 重連場景：myTeam.status='playing' + activeSessionId → 自動跳回遊戲
  //   斷線/關閉瀏覽器後再開啟，能繼續未完成的遊戲
  const myTeam = ctx.myTeam as { status?: string; activeSessionId?: string | null } | null | undefined;
  useEffect(() => {
    if (
      myTeam?.status === "playing" &&
      myTeam.activeSessionId &&
      ctx.game
    ) {
      ctx.navigate(`/game/${ctx.game.id}?session=${myTeam.activeSessionId}`);
    }
  }, [myTeam?.status, myTeam?.activeSessionId, ctx.game, ctx]);

  if (ctx.gameLoading || ctx.teamLoading) {
    return <LoadingView />;
  }

  if (!ctx.game) {
    return <GameNotFoundView onBack={() => ctx.navigate("/home")} />;
  }

  if (ctx.game.gameMode !== "team") {
    return <SoloModeView onStart={() => ctx.navigate(`/game/${ctx.game!.id}`)} />;
  }

  // 🆕 開始遊戲倒數中（隊長按開始 → 全員 5 秒緩衝）
  if (ctx.startingCountdown !== null && ctx.myTeam) {
    return (
      <StartingCountdownView
        game={ctx.game!}
        team={ctx.myTeam}
        remainingSeconds={ctx.startingCountdown}
      />
    );
  }

  if (!ctx.myTeam) {
    return (
      <JoinOrCreateView
        game={ctx.game}
        teamName={ctx.teamName}
        setTeamName={ctx.setTeamName}
        accessCode={ctx.accessCode}
        setAccessCode={ctx.setAccessCode}
        showJoinForm={ctx.showJoinForm}
        setShowJoinForm={ctx.setShowJoinForm}
        onCreateTeam={ctx.handleCreateTeam}
        onJoinTeam={ctx.handleJoinTeam}
        onBack={() => ctx.navigate("/home")}
        createPending={ctx.createPending}
        joinPending={ctx.joinPending}
      />
    );
  }

  return (
    <TeamLobbyView
      game={ctx.game}
      team={ctx.myTeam}
      wsConnected={ctx.wsConnected}
      copied={ctx.copied}
      myMembership={ctx.myMembership}
      allReady={ctx.allReady}
      hasEnoughPlayers={ctx.hasEnoughPlayers}
      onBack={() => ctx.navigate("/home")}
      onRefresh={ctx.refetchTeam}
      onCopyCode={ctx.handleCopyCode}
      onToggleReady={ctx.toggleReady}
      onStartGame={ctx.startGame}
      onLeaveTeam={ctx.leaveTeam}
      readyPending={ctx.readyPending}
      startPending={ctx.startPending}
      leavePending={ctx.leavePending}
    />
  );
}
