import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import CelebrationWall, { CelebrationWallConfig, CelebrationWallState, Celebration } from "./CelebrationWall";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: CelebrationWallConfig = {
  title: "勝利分享牆",
  prompt: "分享一件你想慶祝的事！大大小小都算，只要你覺得值得慶祝",
  maxLength: 100,
  showAuthor: true,
};

const DEFAULT_STATE: CelebrationWallState = {
  celebrations: [],
  revealed: false,
};

export default function CelebrationWallPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const rawConfig = page?.config;
  const config: CelebrationWallConfig =
    rawConfig && typeof rawConfig === "object" && "maxLength" in rawConfig
      ? (rawConfig as CelebrationWallConfig)
      : rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: CelebrationWallConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<CelebrationWallState>({
    gameId,
    sessionId,
    pageId,
    type: "celebration_wall",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-amber-500" />
      </div>
    );
  }

  function handleSubmit(text: string) {
    const newCel: Celebration = {
      celId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text,
      hearts: [],
    };
    updateState({ ...state, celebrations: [...state.celebrations, newCel] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function handleHeart(celId: string) {
    const updated = state.celebrations.map((c: Celebration) => {
      if (c.celId !== celId) return c;
      const already = c.hearts.includes(myUserId);
      return {
        ...c,
        hearts: already ? c.hearts.filter((h: string) => h !== myUserId) : [...c.hearts, myUserId],
      };
    });
    updateState({ ...state, celebrations: updated });
  }

  return (
    <CelebrationWall
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
      onHeart={handleHeart}
    />
  );
}
