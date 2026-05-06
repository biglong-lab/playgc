import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MythicalEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  mythical: string;
  reason: string;
}

interface MythicalCreatureState extends Record<string, unknown> {
  entries: MythicalEntry[];
  revealed: boolean;
}

interface MythicalCreatureConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): MythicalCreatureConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const CREATURES = [
  { id: "dragon", label: "龍", emoji: "🐉", desc: "威嚴強大掌控天地" },
  { id: "phoenix", label: "鳳凰", emoji: "🔥", desc: "浴火重生永不消亡" },
  { id: "unicorn", label: "獨角獸", emoji: "🦄", desc: "純真神聖帶來奇蹟" },
  { id: "griffin", label: "獅鷲", emoji: "⚔️", desc: "勇猛守護雙重力量" },
  { id: "mermaid", label: "美人魚", emoji: "🧜", desc: "神秘優雅海洋之歌" },
  { id: "pegasus", label: "天馬", emoji: "🐎", desc: "自由翱翔衝破極限" },
  { id: "kraken", label: "海怪", emoji: "🌊", desc: "深邃龐大無法忽視" },
  { id: "werewolf", label: "狼人", emoji: "🐺", desc: "雙面個性本能直覺" },
  { id: "sphinx", label: "斯芬克斯", emoji: "🏛️", desc: "謎題智慧靜觀萬變" },
];

const CARD_COLORS = [
  "border-l-purple-600 bg-purple-50",
  "border-l-indigo-600 bg-indigo-50",
  "border-l-violet-600 bg-violet-50",
  "border-l-fuchsia-600 bg-fuchsia-50",
  "border-l-slate-600 bg-slate-50",
  "border-l-blue-700 bg-blue-50",
  "border-l-purple-500 bg-purple-50",
  "border-l-indigo-500 bg-indigo-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MythicalCreature({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<MythicalCreatureState>({
    gameId,
    sessionId,
    pageId,
    type: "mythical_creature",
    defaultState: { entries: [], revealed: false },
  });

  const [mythical, setMythical] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="mth-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as MythicalEntry[]).find((e) => e.userId === userId);
  const canSubmit = mythical !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: MythicalEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      mythical,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as MythicalEntry[]), entry] });
    setMythical("");
    setReason("");
  };

  const entries = state.entries as MythicalEntry[];
  const revealed = state.revealed as boolean;

  const creatureCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.mythical] = (acc[e.mythical] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="mth-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種神話生物"}
      </div>
      <div data-testid="mth-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種神話生物，你最像哪種？說說你的神話個性！"}
      </div>
      <div data-testid="mth-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="mth-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {CREATURES.map((c) => (
              <button
                key={c.id}
                data-testid={`mth-creature-${c.id}`}
                onClick={() => setMythical(c.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${mythical === c.id ? "border-purple-500 bg-purple-50 font-semibold" : "hover:border-purple-400"}`}
              >
                <span className="text-2xl">{c.emoji}</span>
                <div className="font-medium text-center">{c.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{c.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="mth-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種神話生物最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="mth-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-purple-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            顯靈！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="mth-my-entry" className="bg-purple-50 rounded-xl p-3 border border-purple-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{CREATURES.find((c) => c.id === myEntry.mythical)?.emoji}</span>
            <span className="text-sm font-semibold">{CREATURES.find((c) => c.id === myEntry.mythical)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已召喚</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="mth-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-purple-700 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊神話圖鑑
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="mth-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇神話生物
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="mth-result" className="flex flex-col gap-3">
          <div data-testid="mth-creature-summary" className="flex flex-wrap gap-2">
            {CREATURES.filter((c) => creatureCounts[c.id] > 0).map((c) => (
              <div
                key={c.id}
                data-testid={`mth-badge-${c.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold"
              >
                {c.emoji} {c.label}
                <span className="ml-1 bg-purple-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {creatureCounts[c.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="mth-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const c = CREATURES.find((x) => x.id === e.mythical);
              return (
                <div
                  key={e.entryId}
                  data-testid={`mth-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{c?.emoji}</span>
                    <span className="text-sm font-semibold">{c?.label}</span>
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
