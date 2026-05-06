import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface HeroEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  hero: string;
  reason: string;
}

interface HeroTypeState extends Record<string, unknown> {
  entries: HeroEntry[];
  revealed: boolean;
}

interface HeroTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): HeroTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const HEROES = [
  { id: "warrior", label: "戰士", emoji: "⚔️", desc: "勇猛衝鋒不怕挑戰" },
  { id: "mage", label: "法師", emoji: "🧙", desc: "智謀策略洞悉全局" },
  { id: "healer", label: "治療師", emoji: "💚", desc: "支援團隊守護夥伴" },
  { id: "ranger", label: "遊俠", emoji: "🏹", desc: "靈活機動遠端掌控" },
  { id: "rogue", label: "盜賊", emoji: "🗡️", desc: "神出鬼沒出其不意" },
  { id: "paladin", label: "聖騎士", emoji: "🛡️", desc: "正義堅毅守護信念" },
  { id: "bard", label: "吟遊詩人", emoji: "🎵", desc: "鼓舞士氣創意無限" },
  { id: "druid", label: "德魯伊", emoji: "🌿", desc: "順應自然洞察本質" },
];

const CARD_COLORS = [
  "border-l-red-400 bg-red-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-green-400 bg-green-50",
  "border-l-emerald-400 bg-emerald-50",
  "border-l-gray-400 bg-gray-50",
  "border-l-yellow-400 bg-yellow-50",
  "border-l-purple-400 bg-purple-50",
  "border-l-teal-400 bg-teal-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function HeroType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<HeroTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "hero_type",
    defaultState: { entries: [], revealed: false },
  });

  const [hero, setHero] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="ht-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as HeroEntry[]).find((e) => e.userId === userId);
  const canSubmit = hero !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: HeroEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      hero,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as HeroEntry[]), entry] });
    setHero("");
    setReason("");
  };

  const entries = state.entries as HeroEntry[];
  const revealed = state.revealed as boolean;

  const heroCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.hero] = (acc[e.hero] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="ht-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我的英雄職業"}
      </div>
      <div data-testid="ht-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一位冒險者，你會選哪種職業？說說原因！"}
      </div>
      <div data-testid="ht-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="ht-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-2">
            {HEROES.map((h) => (
              <button
                key={h.id}
                data-testid={`ht-hero-${h.id}`}
                onClick={() => setHero(h.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${hero === h.id ? "border-amber-400 bg-amber-50 font-semibold" : "hover:border-amber-300"}`}
              >
                <span className="text-xl shrink-0">{h.emoji}</span>
                <div className="text-left">
                  <div className="font-medium">{h.label}</div>
                  <div className="text-muted-foreground text-[10px]">{h.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="ht-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這個職業最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="ht-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            入隊！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="ht-my-entry" className="bg-amber-50 rounded-xl p-3 border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{HEROES.find((h) => h.id === myEntry.hero)?.emoji}</span>
            <span className="text-sm font-semibold">{HEROES.find((h) => h.id === myEntry.hero)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已入隊</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="ht-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊冒險者名冊
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="ht-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇職業
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="ht-result" className="flex flex-col gap-3">
          <div data-testid="ht-hero-summary" className="flex flex-wrap gap-2">
            {HEROES.filter((h) => heroCounts[h.id] > 0).map((h) => (
              <div
                key={h.id}
                data-testid={`ht-badge-${h.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold"
              >
                {h.emoji} {h.label}
                <span className="ml-1 bg-amber-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {heroCounts[h.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="ht-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const h = HEROES.find((x) => x.id === e.hero);
              return (
                <div
                  key={e.entryId}
                  data-testid={`ht-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{h?.emoji}</span>
                    <span className="text-sm font-semibold">{h?.label}</span>
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
