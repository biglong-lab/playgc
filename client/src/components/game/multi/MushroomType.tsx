import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MushroomEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  mushroom: string;
  reason: string;
}

interface MushroomTypeState extends Record<string, unknown> {
  entries: MushroomEntry[];
  revealed: boolean;
}

interface MushroomTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): MushroomTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const MUSHROOMS = [
  { id: "shiitake", label: "香菇", emoji: "🍄", desc: "樸實深邃香氣悠長" },
  { id: "truffle", label: "松露", emoji: "⚫", desc: "稀有奢華難以尋覓" },
  { id: "chanterelle", label: "雞油菌", emoji: "🟡", desc: "金黃活潑令人驚喜" },
  { id: "porcini", label: "牛肝菌", emoji: "🟤", desc: "厚實濃郁底蘊深厚" },
  { id: "oyster", label: "平菇", emoji: "🌸", desc: "柔嫩親和隨遇而安" },
  { id: "button", label: "洋菇", emoji: "⚪", desc: "平凡可靠百搭萬用" },
  { id: "portobello", label: "波特菇", emoji: "🔵", desc: "大方沉穩有份量感" },
  { id: "enoki", label: "金針菇", emoji: "🌾", desc: "細膩群聚抱團溫暖" },
  { id: "morel", label: "羊肚菌", emoji: "🌰", desc: "稀奇獨特充滿故事" },
];

const CARD_COLORS = [
  "border-l-amber-700 bg-amber-50",
  "border-l-stone-600 bg-stone-50",
  "border-l-yellow-600 bg-yellow-50",
  "border-l-orange-600 bg-orange-50",
  "border-l-amber-500 bg-amber-50",
  "border-l-stone-500 bg-stone-50",
  "border-l-brown-500 bg-stone-50",
  "border-l-yellow-500 bg-yellow-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MushroomType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<MushroomTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "mushroom_type",
    defaultState: { entries: [], revealed: false },
  });

  const [mushroom, setMushroom] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="msh-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as MushroomEntry[]).find((e) => e.userId === userId);
  const canSubmit = mushroom !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: MushroomEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      mushroom,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as MushroomEntry[]), entry] });
    setMushroom("");
    setReason("");
  };

  const entries = state.entries as MushroomEntry[];
  const revealed = state.revealed as boolean;

  const mushroomCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.mushroom] = (acc[e.mushroom] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="msh-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種菇類"}
      </div>
      <div data-testid="msh-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種菇類，你最像哪種？說說你的菇菇個性！"}
      </div>
      <div data-testid="msh-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="msh-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {MUSHROOMS.map((m) => (
              <button
                key={m.id}
                data-testid={`msh-mushroom-${m.id}`}
                onClick={() => setMushroom(m.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${mushroom === m.id ? "border-amber-600 bg-amber-50 font-semibold" : "hover:border-amber-500"}`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <div className="font-medium text-center">{m.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{m.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="msh-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種菇類最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="msh-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-amber-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            生長！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="msh-my-entry" className="bg-amber-50 rounded-xl p-3 border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{MUSHROOMS.find((m) => m.id === myEntry.mushroom)?.emoji}</span>
            <span className="text-sm font-semibold">{MUSHROOMS.find((m) => m.id === myEntry.mushroom)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已採收</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="msh-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-700 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊菇菇園
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="msh-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇菇類
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="msh-result" className="flex flex-col gap-3">
          <div data-testid="msh-mushroom-summary" className="flex flex-wrap gap-2">
            {MUSHROOMS.filter((m) => mushroomCounts[m.id] > 0).map((m) => (
              <div
                key={m.id}
                data-testid={`msh-badge-${m.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold"
              >
                {m.emoji} {m.label}
                <span className="ml-1 bg-amber-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {mushroomCounts[m.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="msh-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const m = MUSHROOMS.find((x) => x.id === e.mushroom);
              return (
                <div
                  key={e.entryId}
                  data-testid={`msh-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{m?.emoji}</span>
                    <span className="text-sm font-semibold">{m?.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{e.reason}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
