import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import TwoColumn, {
  TwoColumnConfig,
  TwoColumnState,
  ColumnItem,
} from "./TwoColumn";

const DEFAULT_CONFIG: TwoColumnConfig = {
  title: "雙欄分類",
  leftLabel: "優點",
  rightLabel: "缺點",
  maxLength: 60,
};

const DEFAULT_STATE: TwoColumnState = { items: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): TwoColumnConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "leftLabel" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("leftLabel" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        leftLabel: (src.leftLabel as string) ?? DEFAULT_CONFIG.leftLabel,
        rightLabel: (src.rightLabel as string) ?? DEFAULT_CONFIG.rightLabel,
        maxLength: (src.maxLength as number) ?? DEFAULT_CONFIG.maxLength,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function TwoColumnPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<TwoColumnState>({
    gameId,
    sessionId,
    pageId,
    type: "two_column",
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

  function handleSubmit(text: string, column: "left" | "right") {
    const newItem: ColumnItem = {
      itemId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text,
      column,
    };
    updateState({ ...state, items: [...state.items, newItem] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <TwoColumn
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
