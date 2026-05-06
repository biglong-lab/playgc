import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface GenreEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  genre: string;
  reason: string;
}

interface MovieGenreState extends Record<string, unknown> {
  entries: GenreEntry[];
  revealed: boolean;
}

interface MovieGenreConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): MovieGenreConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const GENRES = [
  { id: "action", label: "動作冒險", emoji: "🎬", desc: "充滿能量勇往直前" },
  { id: "romance", label: "浪漫喜劇", emoji: "💕", desc: "溫馨甜蜜笑聲不斷" },
  { id: "thriller", label: "懸疑驚悚", emoji: "🔍", desc: "謎題重重步步為營" },
  { id: "scifi", label: "科幻奇幻", emoji: "🚀", desc: "充滿想像突破框架" },
  { id: "documentary", label: "紀錄片", emoji: "🎥", desc: "沉穩真實追求本質" },
  { id: "animation", label: "動畫", emoji: "✨", desc: "童趣創意天馬行空" },
  { id: "horror", label: "恐怖驚悚", emoji: "👻", desc: "提心吊膽高度警覺" },
  { id: "family", label: "家庭溫情", emoji: "🏠", desc: "溫暖踏實重視連結" },
  { id: "indie", label: "文藝獨立", emoji: "🎭", desc: "獨特細膩感受敏銳" },
];

const CARD_COLORS = [
  "border-l-purple-400 bg-purple-50",
  "border-l-pink-400 bg-pink-50",
  "border-l-indigo-400 bg-indigo-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-rose-400 bg-rose-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MovieGenre({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<MovieGenreState>({
    gameId,
    sessionId,
    pageId,
    type: "movie_genre",
    defaultState: { entries: [], revealed: false },
  });

  const [genre, setGenre] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="mg-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as GenreEntry[]).find((e) => e.userId === userId);
  const canSubmit = genre !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: GenreEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      genre,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as GenreEntry[]), entry] });
    setGenre("");
    setReason("");
  };

  const entries = state.entries as GenreEntry[];
  const revealed = state.revealed as boolean;

  const genreCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.genre] = (acc[e.genre] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="mg-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種電影"}
      </div>
      <div data-testid="mg-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果今天的你是一部電影，會是哪個類型？說說為什麼！"}
      </div>
      <div data-testid="mg-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="mg-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-1 gap-2">
            {GENRES.map((g) => (
              <button
                key={g.id}
                data-testid={`mg-genre-${g.id}`}
                onClick={() => setGenre(g.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-sm transition-all ${genre === g.id ? "border-purple-400 bg-purple-50 font-semibold" : "hover:border-purple-300"}`}
              >
                <span className="text-2xl shrink-0">{g.emoji}</span>
                <div className="text-left">
                  <div className="font-medium">{g.label}</div>
                  <div className="text-muted-foreground text-xs">{g.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="mg-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼今天的你是這個類型？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="mg-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-purple-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            登場！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="mg-my-entry" className="bg-purple-50 rounded-xl p-3 border border-purple-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{GENRES.find((g) => g.id === myEntry.genre)?.emoji}</span>
            <span className="text-sm font-semibold">{GENRES.find((g) => g.id === myEntry.genre)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已登場</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="mg-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-purple-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          上映！揭曉全隊電影院
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="mg-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇電影類型
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="mg-result" className="flex flex-col gap-3">
          <div data-testid="mg-genre-summary" className="flex flex-wrap gap-2">
            {GENRES.filter((g) => genreCounts[g.id] > 0).map((g) => (
              <div
                key={g.id}
                data-testid={`mg-badge-${g.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold"
              >
                {g.emoji} {g.label}
                <span className="ml-1 bg-purple-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {genreCounts[g.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="mg-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const g = GENRES.find((x) => x.id === e.genre);
              return (
                <div
                  key={e.entryId}
                  data-testid={`mg-card-${e.entryId}`}
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
