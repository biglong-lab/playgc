// 隊伍大廳主頁面
import { useTeamLobby } from "./team-lobby/useTeamLobby";
import {
  LoadingView, GameNotFoundView, SoloModeView,
  JoinOrCreateView, TeamLobbyView,
} from "./team-lobby/LobbyViews";

export default function TeamLobby() {
  const ctx = useTeamLobby();

  if (ctx.gameLoading || ctx.teamLoading) {
    return <LoadingView />;
  }

  if (!ctx.game) {
    return <GameNotFoundView onBack={() => ctx.navigate("/home")} />;
  }

  if (ctx.game.gameMode !== "team") {
    return <SoloModeView onStart={() => ctx.navigate(`/game/${ctx.game!.id}`)} />;
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
