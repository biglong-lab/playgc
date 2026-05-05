import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import KudosWall, {
  KudosWallConfig,
  KudosWallState,
  KudosCard,
} from "./KudosWall";

const DEFAULT_CONFIG: KudosWallConfig = {
  title: "感謝牆",
  prompt: "向誰說一句謝謝？",
  maxLength: 80,
};

const DEFAULT_STATE: KudosWallState = { kudos: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): KudosWallConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "toName" in r || ("maxLength" in r && "prompt" in r && !("config" in r))
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("maxLength" in src && "prompt" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        prompt: (src.prompt as string) ?? DEFAULT_CONFIG.prompt,
        maxLength: (src.maxLength as number) ?? DEFAULT_CONFIG.maxLength,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function KudosWallPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<KudosWallState>({
    gameId,
    sessionId,
    pageId,
    type: "kudos_wall",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-pink-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(toName: string, message: string) {
    const newCard: KudosCard = {
      kudosId: `${myUserId}-${Date.now()}`,
      fromUserId: myUserId,
      fromUserName: myUserName,
      toName,
      message,
    };
    updateState({ ...state, kudos: [...state.kudos, newCard] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <KudosWall
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
