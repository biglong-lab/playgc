import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SportEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  sport: string;
  reason: string;
}

interface SportVibesState extends Record<string, unknown> {
  entries: SportEntry[];
  revealed: boolean;
}

interface SportVibesConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): SportVibesConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const SPORTS = [
  { id: "running", label: "跑步", emoji: "🏃", desc: "清醒自律享受孤獨" },
  { id: "yoga", label: "瑜伽", emoji: "🧘", desc: "平靜專注身心合一" },
  { id: "gym", label: "健身房", emoji: "💪", desc: "自律有計劃逐步突破" },
  { id: "swimming", label: "游泳", emoji: "🏊", desc: "流暢沉浸清涼自在" },
  { id: "hiking", label: "登山健行", emoji: "🥾", desc: "喜歡挑戰欣賞遠景" },
  { id: "cycling", label: "騎車", emoji: "🚴", desc: "自由移動享受過程" },
  { id: "dance", label: "舞蹈", emoji: "💃", desc: "熱情表達創意律動" },
  { id: "teamsport", label: "球類運動", emoji: "⚽", desc: "重視團隊合作互動" },
  { id: "martialarts", label: "武術格鬥", emoji: "🥋", desc: "專注紀律磨練意志" },
];

const CARD_COLORS = [
  "border-l-red-400 bg-red-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-lime-400 bg-lime-50",
  "border-l-green-400 bg-green-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-violet-400 bg-violet-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SportVibes({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SportVibesState>({
    gameId,
    sessionId,
    pageId,
    type: "sport_vibes",
    defaultState: { entries: [], revealed: false },
  });

  const [sport, setSport] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="sv-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as SportEntry[]).find((e) => e.userId === userId);
  const canSubmit = sport !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: SportEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      sport,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as SportEntry[]), entry] });
    setSport("");
    setReason("");
  };

  const entries = state.entries as SportEntry[];
  const revealed = state.revealed as boolean;

  const sportCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.sport] = (acc[e.sport] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="sv-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我今天的運動感"}
      </div>
      <div data-testid="sv-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "哪種運動最符合你今天的狀態或個性？說說你的感受！"}
      </div>
      <div data-testid="sv-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="sv-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {SPORTS.map((s) => (
              <button
                key={s.id}
                data-testid={`sv-sport-${s.id}`}
                onClick={() => setSport(s.id)}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs transition-all ${sport === s.id ? "border-red-400 bg-red-50 font-semibold" : "hover:border-red-300"}`}
              >
                <span className="text-2xl">{s.emoji}</span>
                <div className="font-medium text-center">{s.label}</div>
                <div className="text-muted-foreground text-[9px] text-center leading-tight">{s.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="sv-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這個運動最像你今天的感覺？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="sv-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-red-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            動起來！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="sv-my-entry" className="bg-red-50 rounded-xl p-3 border border-red-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{SPORTS.find((s) => s.id === myEntry.sport)?.emoji}</span>
            <span className="text-sm font-semibold">{SPORTS.find((s) => s.id === myEntry.sport)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已送出</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="sv-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-red-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊運動賽場
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="sv-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇運動
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="sv-result" className="flex flex-col gap-3">
          <div data-testid="sv-sport-summary" className="flex flex-wrap gap-2">
            {SPORTS.filter((s) => sportCounts[s.id] > 0).map((s) => (
              <div
                key={s.id}
                data-testid={`sv-badge-${s.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold"
              >
                {s.emoji} {s.label}
                <span className="ml-1 bg-red-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {sportCounts[s.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="sv-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const s = SPORTS.find((x) => x.id === e.sport);
              return (
                <div
                  key={e.entryId}
                  data-testid={`sv-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
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
