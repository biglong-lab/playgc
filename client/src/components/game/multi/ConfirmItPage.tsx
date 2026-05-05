import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import ConfirmIt, {
  ConfirmItConfig,
  ConfirmItState,
  ConfirmResponse,
} from "./ConfirmIt";

const DEFAULT_CONFIG: ConfirmItConfig = {
  title: "信心投票",
  statement: "待確認的陳述",
  showConfidence: true,
};

const DEFAULT_STATE: ConfirmItState = {
  responses: [],
  revealed: false,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): ConfirmItConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "statement" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("statement" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        statement: (src.statement as string) ?? DEFAULT_CONFIG.statement,
        showConfidence: (src.showConfidence as boolean) ?? DEFAULT_CONFIG.showConfidence,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function ConfirmItPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<ConfirmItState>({
    gameId,
    sessionId,
    pageId,
    type: "confirm_it",
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

  function handleSubmit(answer: "true" | "false", confidence: number) {
    const already = state.responses.find((r) => r.userId === myUserId);
    if (already) return;
    const newResp: ConfirmResponse = {
      respId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      answer,
      confidence,
    };
    updateState({ ...state, responses: [...state.responses, newResp] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <ConfirmIt
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
