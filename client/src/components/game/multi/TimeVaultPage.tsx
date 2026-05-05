import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import TimeVault, {
  TimeVaultConfig,
  TimeVaultState,
  VaultEntry,
} from "./TimeVault";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: TimeVaultConfig = {
  title: "時光膠囊",
  prompt: "寫下你想在未來開封時看到的話",
  revealLabel: "下次聚會開封",
  maxLength: 150,
  showAuthor: true,
};

const DEFAULT_STATE: TimeVaultState = {
  entries: [],
  phase: "submit",
};

export default function TimeVaultPage({
  gameId,
  sessionId,
  pageId,
  page,
}: Props) {
  const { user } = useAuth();

  const raw = page?.config;
  const config: TimeVaultConfig =
    raw && typeof raw === "object" && "revealLabel" in raw
      ? (raw as TimeVaultConfig)
      : raw && typeof raw === "object" && "config" in raw
      ? (raw as { config: TimeVaultConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } =
    useTeamPagePersistence<TimeVaultState>({
      gameId,
      sessionId,
      pageId,
      type: "time_vault",
      defaultState: DEFAULT_STATE,
    });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-slate-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName =
    user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmitEntry(text: string) {
    const newEntry: VaultEntry = {
      entryId: `ve-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      userId: myUserId,
      userName: myUserName,
      text,
      hearts: [],
    };
    updateState({
      ...state,
      entries: [...state.entries, newEntry],
    });
  }

  function handleAdvancePhase() {
    const next: TimeVaultState["phase"] =
      state.phase === "submit" ? "sealed" : "revealed";
    updateState({ ...state, phase: next });
  }

  function handleHeart(entryId: string) {
    const updated = state.entries.map((e: VaultEntry) => {
      if (e.entryId !== entryId) return e;
      const already = e.hearts.includes(myUserId);
      return {
        ...e,
        hearts: already
          ? e.hearts.filter((h: string) => h !== myUserId)
          : [...e.hearts, myUserId],
      };
    });
    updateState({ ...state, entries: updated });
  }

  return (
    <TimeVault
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmitEntry={handleSubmitEntry}
      onAdvancePhase={handleAdvancePhase}
      onHeart={handleHeart}
    />
  );
}
