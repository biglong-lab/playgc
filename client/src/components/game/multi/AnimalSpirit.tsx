import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface AnimalEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  animal: string;
  reason: string;
}

interface AnimalSpiritState extends Record<string, unknown> {
  entries: AnimalEntry[];
  revealed: boolean;
}

interface AnimalSpiritConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): AnimalSpiritConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const ANIMALS = [
  { id: "lion", label: "獅子", emoji: "🦁", trait: "勇敢領導" },
  { id: "owl", label: "貓頭鷹", emoji: "🦉", trait: "智慧洞察" },
  { id: "dolphin", label: "海豚", emoji: "🐬", trait: "活潑友善" },
  { id: "eagle", label: "老鷹", emoji: "🦅", trait: "眼光遠大" },
  { id: "bear", label: "熊", emoji: "🐻", trait: "穩重可靠" },
  { id: "fox", label: "狐狸", emoji: "🦊", trait: "機智靈活" },
  { id: "wolf", label: "狼", emoji: "🐺", trait: "團隊協作" },
  { id: "turtle", label: "烏龜", emoji: "🐢", trait: "穩扎穩打" },
  { id: "butterfly", label: "蝴蝶", emoji: "🦋", trait: "優雅轉變" },
  { id: "panda", label: "貓熊", emoji: "🐼", trait: "溫和可愛" },
  { id: "tiger", label: "老虎", emoji: "🐯", trait: "熱情衝勁" },
  { id: "cat", label: "貓咪", emoji: "🐱", trait: "獨立自在" },
];

const CARD_COLORS = [
  "border-l-amber-400 bg-amber-50",
  "border-l-sky-400 bg-sky-50",
  "border-l-emerald-400 bg-emerald-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-violet-400 bg-violet-50",
  "border-l-orange-400 bg-orange-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function AnimalSpirit({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<AnimalSpiritState>({
    gameId,
    sessionId,
    pageId,
    type: "animal_spirit",
    defaultState: { entries: [], revealed: false },
  });

  const [animal, setAnimal] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="as-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as AnimalEntry[]).find((e) => e.userId === userId);
  const canSubmit = animal !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: AnimalEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      animal,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as AnimalEntry[]), entry] });
    setAnimal("");
    setReason("");
  };

  const entries = state.entries as AnimalEntry[];
  const revealed = state.revealed as boolean;

  const animalCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.animal] = (acc[e.animal] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="as-title" className="text-xl font-bold text-center">
        {cfg.title ?? "精神動物"}
      </div>
      <div data-testid="as-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你今天是一隻動物，你會是哪一隻？說說原因！"}
      </div>
      <div data-testid="as-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="as-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {ANIMALS.map((a) => (
              <button
                key={a.id}
                data-testid={`as-animal-${a.id}`}
                onClick={() => setAnimal(a.id)}
                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all ${animal === a.id ? "border-amber-400 bg-amber-50 font-semibold" : "hover:border-amber-300"}`}
              >
                <span className="text-2xl mb-1">{a.emoji}</span>
                <span className="font-medium">{a.label}</span>
                <span className="text-muted-foreground">{a.trait}</span>
              </button>
            ))}
          </div>
          <textarea
            data-testid="as-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼今天你是這隻動物？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="as-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            選定！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="as-my-entry" className="bg-amber-50 rounded-xl p-3 border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{ANIMALS.find((a) => a.id === myEntry.animal)?.emoji}</span>
            <span className="text-sm font-semibold">{ANIMALS.find((a) => a.id === myEntry.animal)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已選定</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="as-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊動物王國
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="as-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇精神動物
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="as-result" className="flex flex-col gap-3">
          <div data-testid="as-animal-summary" className="flex flex-wrap gap-2">
            {ANIMALS.filter((a) => animalCounts[a.id] > 0).map((a) => (
              <div
                key={a.id}
                data-testid={`as-badge-${a.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold"
              >
                {a.emoji} {a.label}
                <span className="ml-1 bg-amber-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {animalCounts[a.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="as-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const ani = ANIMALS.find((a) => a.id === e.animal);
              return (
                <div
                  key={e.entryId}
                  data-testid={`as-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{ani?.emoji}</span>
                    <span className="text-sm font-semibold">{ani?.label}</span>
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
