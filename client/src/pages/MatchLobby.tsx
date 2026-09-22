// 對戰等候室主頁 — 根據狀態切換不同視圖（含轉場動畫）
import { motion, AnimatePresence } from "framer-motion";
import { isScoringEnabled } from "@shared/lib/scoring";
import { useMatchLobby } from "./match-lobby/useMatchLobby";
import { buildMatchInviteUrl } from "./match-lobby/lobby-status";
import {
  LoadingView,
  BrowseMatchesView,
  WaitingView,
  CountdownView,
  PlayingView,
  FinishedView,
  CancelledView,
} from "./match-lobby/MatchViews";
import { pageTransition } from "@/lib/animation-variants";

/** 根據 lobby 狀態渲染對應視圖（純函式，不含動畫） */
function renderView(lobby: ReturnType<typeof useMatchLobby>) {
  const match = lobby.currentMatch;
  const showScore = isScoringEnabled(lobby.game);
  switch (lobby.currentView) {
    case "loading":
      return <LoadingView />;
    case "browse":
      return (
        <BrowseMatchesView
          game={lobby.game}
          matches={lobby.matches}
          onCreateMatch={lobby.createMatch}
          onJoinMatch={lobby.joinMatch}
          onJoinByCode={lobby.joinByCode}
          onGoBack={lobby.handleGoBack}
          isCreating={lobby.isCreating}
          isJoining={lobby.isJoining}
        />
      );
  }
  if (!match) return <LoadingView />;
  switch (lobby.currentView) {
    case "waiting":
      return (
        <WaitingView
          match={match}
          isCreator={lobby.isCreator}
          userId={lobby.currentUserId}
          inviteUrl={buildMatchInviteUrl(window.location.origin, lobby.lobbyPath, match.accessCode ?? "")}
          onStart={lobby.startMatch}
          isStarting={lobby.isStarting}
          onLeave={lobby.leaveMatch}
          isLeaving={lobby.isLeaving}
          onKick={lobby.kickPlayer}
        />
      );
    case "countdown":
      return <CountdownView seconds={lobby.ws.countdown ?? match.countdownSeconds} />;
    case "playing":
      return (
        <PlayingView
          match={match}
          userId={lobby.currentUserId}
          isCreator={lobby.isCreator}
          showScore={showScore}
          onFinish={lobby.finishMatch}
        />
      );
    case "finished":
      return (
        <FinishedView
          match={match}
          userId={lobby.currentUserId}
          showScore={showScore}
          onPlayAnother={lobby.playAnother}
          onGoBack={lobby.handleGoBack}
        />
      );
    default:
      return <CancelledView onBack={lobby.playAnother} />;
  }
}

export default function MatchLobby() {
  const lobby = useMatchLobby();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={lobby.currentView}
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {renderView(lobby)}
      </motion.div>
    </AnimatePresence>
  );
}
