import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface GemstoneEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  gemstone: string;
  reason: string;
}

interface GemstoneTypeState extends Record<string, unknown> {
  entries: GemstoneEntry[];
  revealed: boolean;
}

interface GemstoneTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): GemstoneTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const GEMSTONES = [
  { id: "diamond", label: "鑽石", emoji: "💎", desc: "璀璨奪目永恆純粹" },
  { id: "ruby", label: "紅寶石", emoji: "❤️", desc: "熱情深邃燃燒激情" },
  { id: "emerald", label: "祖母綠", emoji: "💚", desc: "生機盎然智慧深厚" },
  { id: "sapphire", label: "藍寶石", emoji: "💙", desc: "沉靜深邃廣闊視野" },
  { id: "amethyst", label: "紫水晶", emoji: "💜", desc: "神秘直覺靈感豐富" },
  { id: "topaz", label: "黃玉", emoji: "💛", desc: "溫暖陽光能量充沛" },
  { id: "opal", label: "蛋白石", emoji: "🌈", desc: "多彩變化難以捉摸" },
  { id: "pearl", label: "珍珠", emoji: "⚪", desc: "純淨優雅歲月磨礪" },
  { id: "jade", label: "翡翠", emoji: "🍀", desc: "沉穩圓潤文化底蘊" },
];

const CARD_COLORS = [
  "border-l-blue-500 bg-blue-50",
  "border-l-purple-500 bg-purple-50",
  "border-l-indigo-500 bg-indigo-50",
  "border-l-violet-500 bg-violet-50",
  "border-l-pink-500 bg-pink-50",
  "border-l-sky-400 bg-sky-50",
  "border-l-fuchsia-400 bg-fuchsia-50",
  "border-l-blue-400 bg-blue-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function GemstoneType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<GemstoneTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "gemstone_type",
    defaultState: { entries: [], revealed: false },
  });

  const [gemstone, setGemstone] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="gem-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as GemstoneEntry[]).find((e) => e.userId === userId);
  const canSubmit = gemstone !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: GemstoneEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      gemstone,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as GemstoneEntry[]), entry] });
    setGemstone("");
    setReason("");
  };

  const entries = state.entries as GemstoneEntry[];
  const revealed = state.revealed as boolean;

  const gemstoneCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.gemstone] = (acc[e.gemstone] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="gem-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種寶石"}
      </div>
      <div data-testid="gem-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種寶石，你最像哪種？說說你的珠寶個性！"}
      </div>
      <div data-testid="gem-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="gem-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {GEMSTONES.map((g) => (
              <button
                key={g.id}
                data-testid={`gem-gemstone-${g.id}`}
                onClick={() => setGemstone(g.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${gemstone === g.id ? "border-blue-500 bg-blue-50 font-semibold" : "hover:border-blue-400"}`}
              >
                <span className="text-2xl">{g.emoji}</span>
                <div className="font-medium text-center">{g.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{g.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="gem-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種寶石最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="gem-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            閃耀！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="gem-my-entry" className="bg-blue-50 rounded-xl p-3 border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{GEMSTONES.find((g) => g.id === myEntry.gemstone)?.emoji}</span>
            <span className="text-sm font-semibold">{GEMSTONES.find((g) => g.id === myEntry.gemstone)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已典藏</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="gem-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-blue-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊珠寶盒
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="gem-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇寶石
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="gem-result" className="flex flex-col gap-3">
          <div data-testid="gem-gemstone-summary" className="flex flex-wrap gap-2">
            {GEMSTONES.filter((g) => gemstoneCounts[g.id] > 0).map((g) => (
              <div
                key={g.id}
                data-testid={`gem-badge-${g.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold"
              >
                {g.emoji} {g.label}
                <span className="ml-1 bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {gemstoneCounts[g.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="gem-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const g = GEMSTONES.find((x) => x.id === e.gemstone);
              return (
                <div
                  key={e.entryId}
                  data-testid={`gem-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{g?.emoji}</span>
                    <span className="text-sm font-semibold">{g?.label}</span>
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
