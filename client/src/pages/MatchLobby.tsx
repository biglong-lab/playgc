// 對戰等候室主頁 — 根據狀態切換不同視圖（含轉場動畫）
import { motion, AnimatePresence } from "framer-motion";
import { useMatchLobby } from "./match-lobby/useMatchLobby";
import {
  LoadingView,
  BrowseMatchesView,
  WaitingView,
  CountdownView,
  PlayingView,
  FinishedView,
} from "./match-lobby/MatchViews";
import { pageTransition } from "@/lib/animation-variants";

/** 根據 lobby 狀態渲染對應視圖（純函式，不含動畫） */
function renderView(lobby: ReturnType<typeof useMatchLobby>) {
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
          onGoBack={lobby.handleGoBack}
          isCreating={lobby.isCreating}
          isJoining={lobby.isJoining}
        />
      );

    case "waiting":
      return (
        <WaitingView
          match={lobby.currentMatch}
          isCreator={lobby.isCreator}
          onStart={lobby.startMatch}
          isStarting={lobby.isStarting}
          ranking={lobby.ws.ranking}
          userId={lobby.currentUserId}
        />
      );

    case "countdown":
      return <CountdownView seconds={lobby.ws.countdown ?? 3} />;

    case "playing":
      return (
        <PlayingView
          match={lobby.currentMatch}
          ranking={lobby.ws.ranking}
          userId={lobby.currentUserId}
          isRelay={lobby.game?.gameMode === "relay"}
        />
      );

    case "finished":
      return (
        <FinishedView
          ranking={lobby.ws.ranking}
          userId={lobby.currentUserId}
          onGoBack={lobby.handleGoBack}
        />
      );
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
