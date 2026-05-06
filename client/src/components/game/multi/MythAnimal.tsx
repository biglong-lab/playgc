import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MythEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  animal: string;
  reason: string;
}

interface MythAnimalState extends Record<string, unknown> {
  entries: MythEntry[];
  revealed: boolean;
}

interface MythAnimalConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): MythAnimalConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const ANIMALS = [
  { id: "dragon", label: "龍", emoji: "🐉", desc: "霸氣威嚴統御四方" },
  { id: "phoenix", label: "鳳凰", emoji: "🦅", desc: "涅槃重生越挫越勇" },
  { id: "unicorn", label: "獨角獸", emoji: "🦄", desc: "純粹夢幻追求理想" },
  { id: "kirin", label: "麒麟", emoji: "🦌", desc: "吉祥仁慈德行高尚" },
  { id: "griffin", label: "獅鷲", emoji: "🦁", desc: "勇猛正義守護邊疆" },
  { id: "mermaid", label: "美人魚", emoji: "🧜", desc: "神秘自由跨越邊界" },
  { id: "nine_tail", label: "九尾狐", emoji: "🦊", desc: "聰明多變神出鬼沒" },
  { id: "pegasus", label: "飛馬", emoji: "🐎", desc: "自由翱翔突破限制" },
  { id: "thunderbird", label: "雷鳥", emoji: "⚡", desc: "力量迅猛傳遞訊息" },
];

const CARD_COLORS = [
  "border-l-amber-400 bg-amber-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-red-400 bg-red-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-purple-400 bg-purple-50",
  "border-l-violet-400 bg-violet-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-sky-400 bg-sky-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MythAnimal({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<MythAnimalState>({
    gameId,
    sessionId,
    pageId,
    type: "myth_animal",
    defaultState: { entries: [], revealed: false },
  });

  const [animal, setAnimal] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="mya-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as MythEntry[]).find((e) => e.userId === userId);
  const canSubmit = animal !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: MythEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      animal,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as MythEntry[]), entry] });
    setAnimal("");
    setReason("");
  };

  const entries = state.entries as MythEntry[];
  const revealed = state.revealed as boolean;

  const animalCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.animal] = (acc[e.animal] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="mya-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種神話神獸"}
      </div>
      <div data-testid="mya-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種神話神獸，你最像哪一種？說說你的神獸特質！"}
      </div>
      <div data-testid="mya-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="mya-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {ANIMALS.map((a) => (
              <button
                key={a.id}
                data-testid={`mya-animal-${a.id}`}
                onClick={() => setAnimal(a.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${animal === a.id ? "border-amber-500 bg-amber-50 font-semibold" : "hover:border-amber-400"}`}
              >
                <span className="text-2xl">{a.emoji}</span>
                <div className="font-medium text-center">{a.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{a.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="mya-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種神獸最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="mya-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-amber-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            顯靈！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="mya-my-entry" className="bg-amber-50 rounded-xl p-3 border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{ANIMALS.find((a) => a.id === myEntry.animal)?.emoji}</span>
            <span className="text-sm font-semibold">{ANIMALS.find((a) => a.id === myEntry.animal)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已顯靈</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="mya-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊神獸圖鑑
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="mya-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇神獸
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="mya-result" className="flex flex-col gap-3">
          <div data-testid="mya-animal-summary" className="flex flex-wrap gap-2">
            {ANIMALS.filter((a) => animalCounts[a.id] > 0).map((a) => (
              <div
                key={a.id}
                data-testid={`mya-badge-${a.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold"
              >
                {a.emoji} {a.label}
                <span className="ml-1 bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {animalCounts[a.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="mya-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const a = ANIMALS.find((x) => x.id === e.animal);
              return (
                <div
                  key={e.entryId}
                  data-testid={`mya-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{a?.emoji}</span>
                    <span className="text-sm font-semibold">{a?.label}</span>
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
