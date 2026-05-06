import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface TripEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  destination: string;
  destType: string;
}

interface DreamTripState extends Record<string, unknown> {
  entries: TripEntry[];
  revealed: boolean;
}

interface DreamTripConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): DreamTripConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const DEST_TYPES = [
  { id: "beach", label: "海島度假", emoji: "🏖️" },
  { id: "mountain", label: "山岳健行", emoji: "🏔️" },
  { id: "city", label: "城市探索", emoji: "🌆" },
  { id: "nature", label: "自然生態", emoji: "🌿" },
  { id: "culture", label: "文化歷史", emoji: "🏛️" },
  { id: "food", label: "美食之旅", emoji: "🍜" },
];

const CARD_COLORS = [
  "border-l-sky-400 bg-sky-50",
  "border-l-emerald-400 bg-emerald-50",
  "border-l-violet-400 bg-violet-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-cyan-400 bg-cyan-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function DreamTrip({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<DreamTripState>({
    gameId,
    sessionId,
    pageId,
    type: "dream_trip",
    defaultState: { entries: [], revealed: false },
  });

  const [destination, setDestination] = useState("");
  const [destType, setDestType] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="dt-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as TripEntry[]).find((e) => e.userId === userId);
  const canSubmit = destination.trim().length >= 2 && destType !== "";

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: TripEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      destination: destination.trim(),
      destType,
    };
    updateState({ ...state, entries: [...(state.entries as TripEntry[]), entry] });
    setDestination("");
    setDestType("");
  };

  const entries = state.entries as TripEntry[];
  const revealed = state.revealed as boolean;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="dt-title" className="text-xl font-bold text-center">
        {cfg.title ?? "夢想旅行"}
      </div>
      <div data-testid="dt-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果可以去任何地方，你的夢想旅遊目的地是哪裡？"}
      </div>
      <div data-testid="dt-count" className="text-xs text-center text-muted-foreground">
        已分享 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="dt-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {DEST_TYPES.map((d) => (
              <button
                key={d.id}
                data-testid={`dt-type-${d.id}`}
                onClick={() => setDestType(d.id)}
                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all ${destType === d.id ? "border-sky-400 bg-sky-50 font-semibold" : "hover:border-sky-300"}`}
              >
                <span className="text-xl mb-1">{d.emoji}</span>
                <span>{d.label}</span>
              </button>
            ))}
          </div>
          <input
            data-testid="dt-destination-input"
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="輸入目的地（至少2字，例如：京都、冰島...）"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <button
            data-testid="dt-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-sky-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            出發！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="dt-my-entry" className="bg-sky-50 rounded-xl p-3 border border-sky-200">
          <div className="text-xs text-sky-500 mb-1">
            {DEST_TYPES.find((d) => d.id === myEntry.destType)?.emoji}{" "}
            {DEST_TYPES.find((d) => d.id === myEntry.destType)?.label}
          </div>
          <div className="text-sm font-medium">{myEntry.destination}</div>
          <div className="text-xs text-muted-foreground mt-1">已提交</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="dt-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊旅遊夢想
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="dt-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人分享旅遊夢想
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="dt-result" className="flex flex-col gap-3">
          <div data-testid="dt-trip-wall" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const dtype = DEST_TYPES.find((d) => d.id === e.destType);
              return (
                <div
                  key={e.entryId}
                  data-testid={`dt-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 flex items-center gap-3 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <span className="text-2xl">{dtype?.emoji}</span>
                  <div>
                    <div className="text-sm font-semibold">{e.destination}</div>
                    <div className="text-xs text-muted-foreground">{dtype?.label} · {e.userName}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
