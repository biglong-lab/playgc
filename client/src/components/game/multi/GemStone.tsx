import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface GemEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  gem: string;
  reason: string;
}

interface GemStoneState extends Record<string, unknown> {
  entries: GemEntry[];
  revealed: boolean;
}

interface GemStoneConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): GemStoneConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const GEMS = [
  { id: "diamond", label: "鑽石", emoji: "💎", desc: "剛強堅毅光芒萬丈" },
  { id: "ruby", label: "紅寶石", emoji: "🔴", desc: "熱情奔放充滿生命力" },
  { id: "emerald", label: "祖母綠", emoji: "💚", desc: "沉穩優雅療癒人心" },
  { id: "sapphire", label: "藍寶石", emoji: "🔵", desc: "睿智深邃值得信賴" },
  { id: "amethyst", label: "紫水晶", emoji: "🔮", desc: "神秘直覺精神豐富" },
  { id: "topaz", label: "黃玉", emoji: "🌟", desc: "陽光開朗帶來歡笑" },
  { id: "opal", label: "蛋白石", emoji: "🌈", desc: "多彩多變難以捉摸" },
  { id: "pearl", label: "珍珠", emoji: "⚪", desc: "溫潤純粹歷經磨練" },
  { id: "obsidian", label: "黑曜石", emoji: "🖤", desc: "保護自我防禦力強" },
];

const CARD_COLORS = [
  "border-l-violet-400 bg-violet-50",
  "border-l-purple-400 bg-purple-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-sky-400 bg-sky-50",
  "border-l-emerald-400 bg-emerald-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-pink-400 bg-pink-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function GemStone({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<GemStoneState>({
    gameId,
    sessionId,
    pageId,
    type: "gem_stone",
    defaultState: { entries: [], revealed: false },
  });

  const [gem, setGem] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="gs-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as GemEntry[]).find((e) => e.userId === userId);
  const canSubmit = gem !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: GemEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      gem,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as GemEntry[]), entry] });
    setGem("");
    setReason("");
  };

  const entries = state.entries as GemEntry[];
  const revealed = state.revealed as boolean;

  const gemCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.gem] = (acc[e.gem] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="gs-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種寶石"}
      </div>
      <div data-testid="gs-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種寶石，你最像哪一種？說說你代表的特質！"}
      </div>
      <div data-testid="gs-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="gs-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {GEMS.map((g) => (
              <button
                key={g.id}
                data-testid={`gs-gem-${g.id}`}
                onClick={() => setGem(g.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${gem === g.id ? "border-violet-500 bg-violet-50 font-semibold" : "hover:border-violet-400"}`}
              >
                <span className="text-2xl">{g.emoji}</span>
                <div className="font-medium text-center">{g.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{g.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="gs-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種寶石最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="gs-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-violet-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            發光！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="gs-my-entry" className="bg-violet-50 rounded-xl p-3 border border-violet-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{GEMS.find((g) => g.id === myEntry.gem)?.emoji}</span>
            <span className="text-sm font-semibold">{GEMS.find((g) => g.id === myEntry.gem)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已鑲嵌</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="gs-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-violet-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊寶石圖鑑
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="gs-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇寶石
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="gs-result" className="flex flex-col gap-3">
          <div data-testid="gs-gem-summary" className="flex flex-wrap gap-2">
            {GEMS.filter((g) => gemCounts[g.id] > 0).map((g) => (
              <div
                key={g.id}
                data-testid={`gs-badge-${g.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold"
              >
                {g.emoji} {g.label}
                <span className="ml-1 bg-violet-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {gemCounts[g.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="gs-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const g = GEMS.find((x) => x.id === e.gem);
              return (
                <div
                  key={e.entryId}
                  data-testid={`gs-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
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
