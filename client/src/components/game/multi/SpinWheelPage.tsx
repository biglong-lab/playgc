import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import SpinWheel, {
  SpinWheelConfig,
  SpinWheelState,
  SpinEntry,
} from "./SpinWheel";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: SpinWheelConfig = {
  title: "幸運轉盤",
  prompt: "把你的名字加入轉盤，看誰幸運被選中！",
  allowPlayerAdd: true,
};

const DEFAULT_STATE: SpinWheelState = {
  entries: [],
  results: [],
};

export default function SpinWheelPage({
  gameId,
  sessionId,
  pageId,
  page,
}: Props) {
  const { user } = useAuth();

  const raw = page?.config;
  const config: SpinWheelConfig =
    raw && typeof raw === "object" && "allowPlayerAdd" in raw
      ? (raw as SpinWheelConfig)
      : raw && typeof raw === "object" && "config" in raw
      ? (raw as { config: SpinWheelConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } =
    useTeamPagePersistence<SpinWheelState>({
      gameId,
      sessionId,
      pageId,
      type: "spin_wheel",
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

  function handleAddEntry(label: string) {
    const newEntry: SpinEntry = {
      entryId: `entry-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      userId: myUserId,
      label,
    };
    updateState({ ...state, entries: [...state.entries, newEntry] });
  }

  function handleSpin() {
    if (state.entries.length === 0) return;
    const idx = Math.floor(Math.random() * state.entries.length);
    const selected = state.entries[idx];
    updateState({ ...state, results: [...state.results, selected.label] });
  }

  function handleRemoveEntry(entryId: string) {
    updateState({
      ...state,
      entries: state.entries.filter(
        (e: SpinEntry) => e.entryId !== entryId
      ),
    });
  }

  return (
    <SpinWheel
      config={config}
      state={state}
      myUserId={myUserId}
      onAddEntry={handleAddEntry}
      onSpin={handleSpin}
      onRemoveEntry={handleRemoveEntry}
    />
  );
}
