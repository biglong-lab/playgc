import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import ProgressCheck, {
  ProgressCheckConfig,
  ProgressCheckState,
  ProgressReport,
} from "./ProgressCheck";

const DEFAULT_CONFIG: ProgressCheckConfig = {
  title: "進度確認",
  prompt: "這項任務你完成了多少？",
  showNotes: true,
};

const DEFAULT_STATE: ProgressCheckState = { reports: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): ProgressCheckConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "showNotes" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("showNotes" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        prompt: (src.prompt as string) ?? DEFAULT_CONFIG.prompt,
        showNotes: (src.showNotes as boolean) ?? DEFAULT_CONFIG.showNotes,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function ProgressCheckPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<ProgressCheckState>({
    gameId,
    sessionId,
    pageId,
    type: "progress_check",
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

  function handleSubmit(percent: number, note: string) {
    const already = state.reports.find((r) => r.userId === myUserId);
    if (already) return;
    const newReport: ProgressReport = {
      reportId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      percent,
      note,
    };
    updateState({ ...state, reports: [...state.reports, newReport] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <ProgressCheck
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
