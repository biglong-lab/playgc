import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import TastingNotes, {
  TastingNotesConfig,
  TastingNotesState,
  TastingEntry,
} from "./TastingNotes";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: TastingNotesConfig = {
  title: "品鑑筆記",
  prompt: "寫下你的品鑑感受",
  itemLabel: "品項名稱",
  showItemName: true,
  maxNotesLength: 100,
  showAuthor: true,
};

const DEFAULT_STATE: TastingNotesState = {
  entries: [],
  revealed: false,
};

export default function TastingNotesPage({
  gameId,
  sessionId,
  pageId,
  page,
}: Props) {
  const { user } = useAuth();

  const raw = page?.config;
  const config: TastingNotesConfig =
    raw && typeof raw === "object" && "maxNotesLength" in raw
      ? (raw as TastingNotesConfig)
      : raw && typeof raw === "object" && "config" in raw
      ? (raw as { config: TastingNotesConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } =
    useTeamPagePersistence<TastingNotesState>({
      gameId,
      sessionId,
      pageId,
      type: "tasting_notes",
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
    user?.firstName ?? user?.email?.split("@")[0] ?? "品鑑者";

  function handleSubmit(data: {
    itemName: string;
    rating: number;
    notes: string;
  }) {
    const newEntry: TastingEntry = {
      entryId: `te-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      userId: myUserId,
      userName: myUserName,
      itemName: data.itemName,
      rating: data.rating,
      notes: data.notes,
      hearts: [],
    };
    updateState({
      ...state,
      entries: [...state.entries, newEntry],
    });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function handleHeart(entryId: string) {
    const updated = state.entries.map((e: TastingEntry) => {
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
    <TastingNotes
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
      onHeart={handleHeart}
    />
  );
}
