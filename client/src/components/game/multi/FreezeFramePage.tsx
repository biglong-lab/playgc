import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import FreezeFrame, {
  FreezeFrameConfig,
  FreezeFrameState,
  FrameEntry,
} from "./FreezeFrame";

const DEFAULT_CONFIG: FreezeFrameConfig = {
  title: "現況快照",
  prompt: "你現在在做什麼？進度如何？",
  maxLength: 80,
};

const DEFAULT_STATE: FreezeFrameState = { frames: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): FreezeFrameConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "maxLength" in r && "prompt" in r && !("config" in r)
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("maxLength" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        prompt: (src.prompt as string) ?? DEFAULT_CONFIG.prompt,
        maxLength: (src.maxLength as number) ?? DEFAULT_CONFIG.maxLength,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function FreezeFramePage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<FreezeFrameState>({
    gameId,
    sessionId,
    pageId,
    type: "freeze_frame",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-indigo-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(text: string, status: "green" | "yellow" | "red") {
    const already = state.frames.find((f) => f.userId === myUserId);
    if (already) return;
    const newFrame: FrameEntry = {
      frameId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text,
      status,
    };
    updateState({ ...state, frames: [...state.frames, newFrame] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <FreezeFrame
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
