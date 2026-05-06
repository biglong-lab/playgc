import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SeasonEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  season: string;
  reason: string;
}

interface SeasonPersonState extends Record<string, unknown> {
  entries: SeasonEntry[];
  revealed: boolean;
}

interface SeasonPersonConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): SeasonPersonConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const SEASONS = [
  {
    id: "spring",
    label: "春天",
    emoji: "🌸",
    desc: "充滿希望萌芽成長",
    color: "border-pink-400 bg-pink-50",
    badge: "bg-pink-100 text-pink-700",
    badgeCount: "bg-pink-400",
  },
  {
    id: "summer",
    label: "夏天",
    emoji: "☀️",
    desc: "熱情活力直接奔放",
    color: "border-yellow-400 bg-yellow-50",
    badge: "bg-yellow-100 text-yellow-700",
    badgeCount: "bg-yellow-400",
  },
  {
    id: "autumn",
    label: "秋天",
    emoji: "🍂",
    desc: "沉穩豐收深思熟慮",
    color: "border-orange-400 bg-orange-50",
    badge: "bg-orange-100 text-orange-700",
    badgeCount: "bg-orange-400",
  },
  {
    id: "winter",
    label: "冬天",
    emoji: "❄️",
    desc: "寧靜內斂精煉專注",
    color: "border-blue-400 bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
    badgeCount: "bg-blue-400",
  },
];

const CARD_COLORS = [
  "border-l-pink-400 bg-pink-50",
  "border-l-yellow-400 bg-yellow-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-blue-400 bg-blue-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SeasonPerson({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SeasonPersonState>({
    gameId,
    sessionId,
    pageId,
    type: "season_person",
    defaultState: { entries: [], revealed: false },
  });

  const [season, setSeason] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="sp-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as SeasonEntry[]).find((e) => e.userId === userId);
  const canSubmit = season !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: SeasonEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      season,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as SeasonEntry[]), entry] });
    setSeason("");
    setReason("");
  };

  const entries = state.entries as SeasonEntry[];
  const revealed = state.revealed as boolean;

  const seasonCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.season] = (acc[e.season] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="sp-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪個季節的人"}
      </div>
      <div data-testid="sp-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一個季節，你最像哪一個？說說原因！"}
      </div>
      <div data-testid="sp-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="sp-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-3">
            {SEASONS.map((s) => (
              <button
                key={s.id}
                data-testid={`sp-season-${s.id}`}
                onClick={() => setSeason(s.id)}
                className={`flex flex-col items-center p-3 rounded-xl border-2 text-sm transition-all ${season === s.id ? `${s.color} font-semibold` : "hover:border-gray-300"}`}
              >
                <span className="text-3xl mb-1">{s.emoji}</span>
                <span className="font-medium">{s.label}</span>
                <span className="text-muted-foreground text-xs mt-1">{s.desc}</span>
              </button>
            ))}
          </div>
          <textarea
            data-testid="sp-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼你是這個季節的人？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="sp-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-emerald-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            選定季節！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="sp-my-entry" className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{SEASONS.find((s) => s.id === myEntry.season)?.emoji}</span>
            <span className="text-sm font-semibold">{SEASONS.find((s) => s.id === myEntry.season)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已選定</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="sp-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-emerald-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊四季圖鑑
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="sp-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇季節
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="sp-result" className="flex flex-col gap-3">
          <div data-testid="sp-season-summary" className="flex flex-wrap gap-2">
            {SEASONS.filter((s) => seasonCounts[s.id] > 0).map((s) => (
              <div
                key={s.id}
                data-testid={`sp-badge-${s.id}`}
                className={`flex items-center gap-1 px-3 py-1 rounded-full ${s.badge} text-xs font-semibold`}
              >
                {s.emoji} {s.label}
                <span className={`ml-1 ${s.badgeCount} text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]`}>
                  {seasonCounts[s.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="sp-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const s = SEASONS.find((x) => x.id === e.season);
              return (
                <div
                  key={e.entryId}
                  data-testid={`sp-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[SEASONS.findIndex((x) => x.id === e.season) % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{s?.emoji}</span>
                    <span className="text-sm font-semibold">{s?.label}</span>
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
