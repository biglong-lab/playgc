import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface PetEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  pet: string;
  reason: string;
}

interface PetPersonalityState extends Record<string, unknown> {
  entries: PetEntry[];
  revealed: boolean;
}

interface PetPersonalityConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): PetPersonalityConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const PETS = [
  { id: "dog", label: "狗", emoji: "🐕", trait: "忠誠熱情愛陪伴" },
  { id: "cat", label: "貓", emoji: "🐈", trait: "獨立優雅有個性" },
  { id: "rabbit", label: "兔子", emoji: "🐰", trait: "溫柔可愛愛乾淨" },
  { id: "hamster", label: "倉鼠", emoji: "🐹", trait: "勤奮儲備精力充沛" },
  { id: "bird", label: "小鳥", emoji: "🐦", trait: "活潑好動愛唱歌" },
  { id: "fish", label: "魚", emoji: "🐟", trait: "悠然自在無拘無束" },
  { id: "turtle", label: "烏龜", emoji: "🐢", trait: "穩健踏實長線思考" },
  { id: "parrot", label: "鸚鵡", emoji: "🦜", trait: "聰明模仿善於溝通" },
  { id: "hedgehog", label: "刺蝟", emoji: "🦔", trait: "外冷內熱需要靠近" },
  { id: "penguin", label: "企鵝", emoji: "🐧", trait: "紳士優雅重視家庭" },
];

const CARD_COLORS = [
  "border-l-amber-400 bg-amber-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-lime-400 bg-lime-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-sky-400 bg-sky-50",
  "border-l-violet-400 bg-violet-50",
  "border-l-pink-400 bg-pink-50",
  "border-l-rose-400 bg-rose-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function PetPersonality({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<PetPersonalityState>({
    gameId,
    sessionId,
    pageId,
    type: "pet_personality",
    defaultState: { entries: [], revealed: false },
  });

  const [pet, setPet] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="pp-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as PetEntry[]).find((e) => e.userId === userId);
  const canSubmit = pet !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: PetEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      pet,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as PetEntry[]), entry] });
    setPet("");
    setReason("");
  };

  const entries = state.entries as PetEntry[];
  const revealed = state.revealed as boolean;

  const petCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.pet] = (acc[e.pet] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="pp-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種寵物"}
      </div>
      <div data-testid="pp-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一隻寵物，你最像哪一種？說說你的個性原因！"}
      </div>
      <div data-testid="pp-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="pp-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-2">
            {PETS.map((p) => (
              <button
                key={p.id}
                data-testid={`pp-pet-${p.id}`}
                onClick={() => setPet(p.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${pet === p.id ? "border-orange-400 bg-orange-50 font-semibold" : "hover:border-orange-300"}`}
              >
                <span className="text-xl shrink-0">{p.emoji}</span>
                <div className="text-left">
                  <div className="font-medium">{p.label}</div>
                  <div className="text-muted-foreground text-[10px]">{p.trait}</div>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="pp-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種寵物最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="pp-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-orange-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            送出！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="pp-my-entry" className="bg-orange-50 rounded-xl p-3 border border-orange-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{PETS.find((p) => p.id === myEntry.pet)?.emoji}</span>
            <span className="text-sm font-semibold">{PETS.find((p) => p.id === myEntry.pet)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已送出</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="pp-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-orange-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊寵物動物園
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="pp-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇寵物
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="pp-result" className="flex flex-col gap-3">
          <div data-testid="pp-pet-summary" className="flex flex-wrap gap-2">
            {PETS.filter((p) => petCounts[p.id] > 0).map((p) => (
              <div
                key={p.id}
                data-testid={`pp-badge-${p.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold"
              >
                {p.emoji} {p.label}
                <span className="ml-1 bg-orange-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {petCounts[p.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="pp-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const p = PETS.find((x) => x.id === e.pet);
              return (
                <div
                  key={e.entryId}
                  data-testid={`pp-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{p?.emoji}</span>
                    <span className="text-sm font-semibold">{p?.label}</span>
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
