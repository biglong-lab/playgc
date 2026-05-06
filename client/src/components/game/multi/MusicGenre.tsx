import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MusicEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  genre: string;
  reason: string;
}

interface MusicGenreState extends Record<string, unknown> {
  entries: MusicEntry[];
  revealed: boolean;
}

interface MusicGenreConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): MusicGenreConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const GENRES = [
  { id: "pop", label: "流行", emoji: "🎤", desc: "輕鬆開朗廣受歡迎" },
  { id: "rock", label: "搖滾", emoji: "🎸", desc: "熱血奔放充滿能量" },
  { id: "jazz", label: "爵士", emoji: "🎷", desc: "隨性即興優雅沉穩" },
  { id: "classical", label: "古典", emoji: "🎻", desc: "細膩深刻追求完美" },
  { id: "hiphop", label: "嘻哈", emoji: "🎧", desc: "直接表達敢說真話" },
  { id: "rnb", label: "R&B", emoji: "🎼", desc: "感性豐富情感細膩" },
  { id: "electronic", label: "電子", emoji: "🎛️", desc: "前衛創新科技感強" },
  { id: "folk", label: "民謠", emoji: "🪕", desc: "真誠純粹貼近生活" },
  { id: "lofi", label: "Lo-Fi", emoji: "📻", desc: "放鬆專注安靜獨處" },
];

const CARD_COLORS = [
  "border-l-fuchsia-400 bg-fuchsia-50",
  "border-l-indigo-400 bg-indigo-50",
  "border-l-cyan-400 bg-cyan-50",
  "border-l-emerald-400 bg-emerald-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-sky-400 bg-sky-50",
  "border-l-violet-400 bg-violet-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MusicGenre({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<MusicGenreState>({
    gameId,
    sessionId,
    pageId,
    type: "music_genre",
    defaultState: { entries: [], revealed: false },
  });

  const [genre, setGenre] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="mg2-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as MusicEntry[]).find((e) => e.userId === userId);
  const canSubmit = genre !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: MusicEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      genre,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as MusicEntry[]), entry] });
    setGenre("");
    setReason("");
  };

  const entries = state.entries as MusicEntry[];
  const revealed = state.revealed as boolean;

  const genreCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.genre] = (acc[e.genre] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="mg2-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我今天的音樂風格"}
      </div>
      <div data-testid="mg2-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "哪種音樂風格最符合你今天的狀態？說說你的感受！"}
      </div>
      <div data-testid="mg2-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="mg2-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {GENRES.map((g) => (
              <button
                key={g.id}
                data-testid={`mg2-genre-${g.id}`}
                onClick={() => setGenre(g.id)}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs transition-all ${genre === g.id ? "border-fuchsia-400 bg-fuchsia-50 font-semibold" : "hover:border-fuchsia-300"}`}
              >
                <span className="text-2xl">{g.emoji}</span>
                <div className="font-medium">{g.label}</div>
                <div className="text-muted-foreground text-[9px] text-center leading-tight">{g.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="mg2-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這個風格最像你今天的狀態？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="mg2-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-fuchsia-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            送出！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="mg2-my-entry" className="bg-fuchsia-50 rounded-xl p-3 border border-fuchsia-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{GENRES.find((g) => g.id === myEntry.genre)?.emoji}</span>
            <span className="text-sm font-semibold">{GENRES.find((g) => g.id === myEntry.genre)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已送出</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="mg2-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-fuchsia-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊音樂排行榜
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="mg2-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇音樂風格
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="mg2-result" className="flex flex-col gap-3">
          <div data-testid="mg2-genre-summary" className="flex flex-wrap gap-2">
            {GENRES.filter((g) => genreCounts[g.id] > 0).map((g) => (
              <div
                key={g.id}
                data-testid={`mg2-badge-${g.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-fuchsia-100 text-fuchsia-700 text-xs font-semibold"
              >
                {g.emoji} {g.label}
                <span className="ml-1 bg-fuchsia-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {genreCounts[g.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="mg2-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const g = GENRES.find((x) => x.id === e.genre);
              return (
                <div
                  key={e.entryId}
                  data-testid={`mg2-card-${e.entryId}`}
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
