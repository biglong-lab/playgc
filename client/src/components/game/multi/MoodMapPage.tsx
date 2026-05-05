import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import MoodMap, {
  MoodMapConfig,
  MoodMapState,
  MoodPosition,
} from "./MoodMap";

const DEFAULT_CONFIG: MoodMapConfig = {
  title: "心情地圖",
  prompt: "點擊地圖放置你的心情座標",
  xLow: "低能量",
  xHigh: "高能量",
  yLow: "負面",
  yHigh: "正面",
};

const DEFAULT_STATE: MoodMapState = {
  positions: [],
  revealed: false,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): MoodMapConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "xLow" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("xLow" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        prompt: (src.prompt as string) ?? DEFAULT_CONFIG.prompt,
        xLow: (src.xLow as string) ?? DEFAULT_CONFIG.xLow,
        xHigh: (src.xHigh as string) ?? DEFAULT_CONFIG.xHigh,
        yLow: (src.yLow as string) ?? DEFAULT_CONFIG.yLow,
        yHigh: (src.yHigh as string) ?? DEFAULT_CONFIG.yHigh,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function MoodMapPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<MoodMapState>({
    gameId,
    sessionId,
    pageId,
    type: "mood_map",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-violet-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handlePlace(x: number, y: number) {
    const already = state.positions.find((p) => p.userId === myUserId);
    if (already) return;
    const newPos: MoodPosition = {
      posId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      x,
      y,
    };
    updateState({ ...state, positions: [...state.positions, newPos] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <MoodMap
      config={config}
      state={state}
      myUserId={myUserId}
      onPlace={handlePlace}
      onReveal={handleReveal}
    />
  );
}
