import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import SongWall, { SongWallConfig, SongWallState, SongEntry } from "./SongWall";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: SongWallState = { entries: [], revealed: false };

export default function SongWallPage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SongWallState>({
    gameId,
    sessionId,
    pageId,
    type: "song_wall",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const r = raw as Record<string, unknown>;
  const config: SongWallConfig =
    "songPlaceholder" in r
      ? (r as unknown as SongWallConfig)
      : r.config && "songPlaceholder" in (r.config as Record<string, unknown>)
        ? (r.config as unknown as SongWallConfig)
        : { title: "🎵 歌曲牆", prompt: "選一首代表你現在心情的歌", maxLength: 50, songPlaceholder: "歌曲名稱", artistPlaceholder: "歌手 / 樂團" };

  const myUserId = user?.id ? String(user.id) : "";

  function handleSubmit(songTitle: string, artist: string, note: string) {
    const already = state.entries.some((e) => e.userId === myUserId);
    if (already) return;
    const entry: SongEntry = {
      entryId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: user?.firstName ?? user?.email?.split("@")[0] ?? "玩家",
      songTitle,
      artist,
      note,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <SongWall
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
