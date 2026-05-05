import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import AhaBoard, { AhaBoardConfig, AhaBoardState, AhaMoment } from "./AhaBoard";

const DEFAULT_CONFIG: AhaBoardConfig = {
  title: "頓悟時刻",
  prompt: "你今天最大的「啊哈！」是什麼？",
  maxLength: 100,
};

const DEFAULT_STATE: AhaBoardState = { moments: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): AhaBoardConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "maxLength" in r && !("config" in r) && !("leftLabel" in r) && !("showNotes" in r) && !("phrase" in r)
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("maxLength" in src && "prompt" in src && !("minLabel" in src)) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        prompt: (src.prompt as string) ?? DEFAULT_CONFIG.prompt,
        maxLength: (src.maxLength as number) ?? DEFAULT_CONFIG.maxLength,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function AhaBoardPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<AhaBoardState>({
    gameId,
    sessionId,
    pageId,
    type: "aha_board",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-yellow-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(text: string) {
    const already = state.moments.find((m) => m.userId === myUserId);
    if (already) return;
    const newMoment: AhaMoment = {
      ahaId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text,
    };
    updateState({ ...state, moments: [...state.moments, newMoment] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <AhaBoard
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
