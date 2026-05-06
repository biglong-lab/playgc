import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface DanceEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  dance: string;
  reason: string;
}

interface DanceStyleState extends Record<string, unknown> {
  entries: DanceEntry[];
  revealed: boolean;
}

interface DanceStyleConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): DanceStyleConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const DANCES = [
  { id: "ballet", label: "芭蕾", emoji: "🩰", desc: "優雅精準追求完美" },
  { id: "hip_hop", label: "嘻哈", emoji: "🎤", desc: "自由奔放街頭活力" },
  { id: "waltz", label: "華爾滋", emoji: "💃", desc: "浪漫優雅輕盈旋轉" },
  { id: "tango", label: "探戈", emoji: "🌹", desc: "熱情激烈魅力十足" },
  { id: "flamenco", label: "佛朗明哥", emoji: "🌟", desc: "熱烈奔放靈魂燃燒" },
  { id: "breakdance", label: "霹靂舞", emoji: "🔄", desc: "挑戰極限突破框架" },
  { id: "contemporary", label: "現代舞", emoji: "🎭", desc: "情感表達詩意流動" },
  { id: "folk", label: "民俗舞", emoji: "🏮", desc: "根植傳統文化連結" },
  { id: "salsa", label: "莎莎", emoji: "🎵", desc: "節奏感強充滿笑聲" },
];

const CARD_COLORS = [
  "border-l-orange-500 bg-orange-50",
  "border-l-red-500 bg-red-50",
  "border-l-pink-500 bg-pink-50",
  "border-l-rose-500 bg-rose-50",
  "border-l-amber-500 bg-amber-50",
  "border-l-yellow-500 bg-yellow-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-red-400 bg-red-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function DanceStyle({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<DanceStyleState>({
    gameId,
    sessionId,
    pageId,
    type: "dance_style",
    defaultState: { entries: [], revealed: false },
  });

  const [dance, setDance] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="dns-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as DanceEntry[]).find((e) => e.userId === userId);
  const canSubmit = dance !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: DanceEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      dance,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as DanceEntry[]), entry] });
    setDance("");
    setReason("");
  };

  const entries = state.entries as DanceEntry[];
  const revealed = state.revealed as boolean;

  const danceCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.dance] = (acc[e.dance] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="dns-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種舞蹈"}
      </div>
      <div data-testid="dns-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種舞蹈，你最像哪種？說說你的舞蹈個性！"}
      </div>
      <div data-testid="dns-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="dns-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {DANCES.map((d) => (
              <button
                key={d.id}
                data-testid={`dns-dance-${d.id}`}
                onClick={() => setDance(d.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${dance === d.id ? "border-orange-500 bg-orange-50 font-semibold" : "hover:border-orange-400"}`}
              >
                <span className="text-2xl">{d.emoji}</span>
                <div className="font-medium text-center">{d.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{d.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="dns-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種舞蹈最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="dns-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-orange-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            起舞！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="dns-my-entry" className="bg-orange-50 rounded-xl p-3 border border-orange-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{DANCES.find((d) => d.id === myEntry.dance)?.emoji}</span>
            <span className="text-sm font-semibold">{DANCES.find((d) => d.id === myEntry.dance)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已謝幕</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="dns-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-orange-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊舞台
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="dns-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇舞蹈
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="dns-result" className="flex flex-col gap-3">
          <div data-testid="dns-dance-summary" className="flex flex-wrap gap-2">
            {DANCES.filter((d) => danceCounts[d.id] > 0).map((d) => (
              <div
                key={d.id}
                data-testid={`dns-badge-${d.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold"
              >
                {d.emoji} {d.label}
                <span className="ml-1 bg-orange-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {danceCounts[d.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="dns-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const d = DANCES.find((x) => x.id === e.dance);
              return (
                <div
                  key={e.entryId}
                  data-testid={`dns-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{d?.emoji}</span>
                    <span className="text-sm font-semibold">{d?.label}</span>
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
