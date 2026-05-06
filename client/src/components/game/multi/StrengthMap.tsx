import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface StrengthEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  strength: string;
  example: string;
}

interface StrengthMapState extends Record<string, unknown> {
  entries: StrengthEntry[];
  revealed: boolean;
}

interface StrengthMapConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): StrengthMapConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const STRENGTHS = [
  { id: "leader", label: "領導力", emoji: "👑", desc: "帶領、激勵他人" },
  { id: "creative", label: "創造力", emoji: "🎨", desc: "創新、解決問題" },
  { id: "analytic", label: "分析力", emoji: "🔍", desc: "邏輯、數據思維" },
  { id: "empathy", label: "同理心", emoji: "💗", desc: "理解、關懷他人" },
  { id: "execute", label: "執行力", emoji: "⚡", desc: "行動、達成目標" },
  { id: "connect", label: "連結力", emoji: "🌐", desc: "建立關係網絡" },
  { id: "learn", label: "學習力", emoji: "🧠", desc: "快速吸收知識" },
  { id: "communicate", label: "溝通力", emoji: "🗣️", desc: "表達清晰有說服力" },
];

const CARD_COLORS = [
  "border-l-yellow-400 bg-yellow-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-indigo-400 bg-indigo-50",
  "border-l-pink-400 bg-pink-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-cyan-400 bg-cyan-50",
  "border-l-lime-400 bg-lime-50",
  "border-l-violet-400 bg-violet-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function StrengthMap({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<StrengthMapState>({
    gameId,
    sessionId,
    pageId,
    type: "strength_map",
    defaultState: { entries: [], revealed: false },
  });

  const [strength, setStrength] = useState("");
  const [example, setExample] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="sm-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as StrengthEntry[]).find((e) => e.userId === userId);
  const canSubmit = strength !== "" && example.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: StrengthEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      strength,
      example: example.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as StrengthEntry[]), entry] });
    setStrength("");
    setExample("");
  };

  const entries = state.entries as StrengthEntry[];
  const revealed = state.revealed as boolean;

  const strengthCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.strength] = (acc[e.strength] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="sm-title" className="text-xl font-bold text-center">
        {cfg.title ?? "強項地圖"}
      </div>
      <div data-testid="sm-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "選出你最核心的強項，並分享一個發揮它的真實故事！"}
      </div>
      <div data-testid="sm-count" className="text-xs text-center text-muted-foreground">
        已分享 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="sm-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-2">
            {STRENGTHS.map((s) => (
              <button
                key={s.id}
                data-testid={`sm-strength-${s.id}`}
                onClick={() => setStrength(s.id)}
                className={`flex items-center gap-2 p-2 rounded-xl border text-xs transition-all text-left ${strength === s.id ? "border-yellow-400 bg-yellow-50 font-semibold" : "hover:border-yellow-300"}`}
              >
                <span className="text-lg shrink-0">{s.emoji}</span>
                <div>
                  <div className="font-medium">{s.label}</div>
                  <div className="text-muted-foreground">{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="sm-example-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={3}
            placeholder="分享一個你運用這個強項的故事（至少5字）"
            value={example}
            onChange={(e) => setExample(e.target.value)}
          />
          <button
            data-testid="sm-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-yellow-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            展示強項！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="sm-my-entry" className="bg-yellow-50 rounded-xl p-3 border border-yellow-200">
          <div className="text-xs text-yellow-600 mb-1">
            {STRENGTHS.find((s) => s.id === myEntry.strength)?.emoji}{" "}
            {STRENGTHS.find((s) => s.id === myEntry.strength)?.label}
          </div>
          <div className="text-sm text-muted-foreground line-clamp-2">{myEntry.example}</div>
          <div className="text-xs text-muted-foreground mt-1">已提交</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="sm-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-yellow-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊強項地圖
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="sm-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人分享強項
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="sm-result" className="flex flex-col gap-3">
          <div data-testid="sm-strength-summary" className="flex flex-wrap gap-2">
            {STRENGTHS.filter((s) => strengthCounts[s.id] > 0).map((s) => (
              <div
                key={s.id}
                data-testid={`sm-badge-${s.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold"
              >
                {s.emoji} {s.label}
                <span className="ml-1 bg-yellow-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {strengthCounts[s.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="sm-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const str = STRENGTHS.find((s) => s.id === e.strength);
              return (
                <div
                  key={e.entryId}
                  data-testid={`sm-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{str?.emoji}</span>
                    <span className="text-xs font-semibold">{str?.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{e.example}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
