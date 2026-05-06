import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface BookEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  genre: string;
  reason: string;
}

interface BookGenreState extends Record<string, unknown> {
  entries: BookEntry[];
  revealed: boolean;
}

interface BookGenreConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): BookGenreConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const GENRES = [
  { id: "fantasy", label: "奇幻小說", emoji: "🧙", desc: "天馬行空創意無邊" },
  { id: "scifi", label: "科幻小說", emoji: "🚀", desc: "前瞻思維超越時代" },
  { id: "romance", label: "言情", emoji: "💕", desc: "重視情感渴望連結" },
  { id: "mystery", label: "推理", emoji: "🔍", desc: "邏輯縝密追根究底" },
  { id: "selfhelp", label: "勵志", emoji: "💪", desc: "積極成長不斷進化" },
  { id: "historical", label: "歷史", emoji: "📜", desc: "深厚底蘊長遠眼光" },
  { id: "thriller", label: "驚悚", emoji: "😱", desc: "敏銳感知掌握危機" },
  { id: "graphic", label: "漫畫/圖像", emoji: "🎨", desc: "視覺思考直觀表達" },
  { id: "poetry", label: "詩集", emoji: "✍️", desc: "細膩敏感文字靈魂" },
];

const CARD_COLORS = [
  "border-l-amber-400 bg-amber-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-yellow-400 bg-yellow-50",
  "border-l-lime-400 bg-lime-50",
  "border-l-emerald-400 bg-emerald-50",
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

export function BookGenre({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<BookGenreState>({
    gameId,
    sessionId,
    pageId,
    type: "book_genre",
    defaultState: { entries: [], revealed: false },
  });

  const [genre, setGenre] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="bk-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as BookEntry[]).find((e) => e.userId === userId);
  const canSubmit = genre !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: BookEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      genre,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as BookEntry[]), entry] });
    setGenre("");
    setReason("");
  };

  const entries = state.entries as BookEntry[];
  const revealed = state.revealed as boolean;

  const genreCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.genre] = (acc[e.genre] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="bk-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種書"}
      </div>
      <div data-testid="bk-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一本書，你最像哪種類型？說說你的閱讀個性！"}
      </div>
      <div data-testid="bk-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="bk-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {GENRES.map((g) => (
              <button
                key={g.id}
                data-testid={`bk-genre-${g.id}`}
                onClick={() => setGenre(g.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${genre === g.id ? "border-amber-500 bg-amber-50 font-semibold" : "hover:border-amber-400"}`}
              >
                <span className="text-2xl">{g.emoji}</span>
                <div className="font-medium text-center">{g.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{g.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="bk-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種書最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="bk-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-amber-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            翻開！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="bk-my-entry" className="bg-amber-50 rounded-xl p-3 border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{GENRES.find((g) => g.id === myEntry.genre)?.emoji}</span>
            <span className="text-sm font-semibold">{GENRES.find((g) => g.id === myEntry.genre)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已上架</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="bk-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊書架
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="bk-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇書籍類型
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="bk-result" className="flex flex-col gap-3">
          <div data-testid="bk-genre-summary" className="flex flex-wrap gap-2">
            {GENRES.filter((g) => genreCounts[g.id] > 0).map((g) => (
              <div
                key={g.id}
                data-testid={`bk-badge-${g.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold"
              >
                {g.emoji} {g.label}
                <span className="ml-1 bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {genreCounts[g.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="bk-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const g = GENRES.find((x) => x.id === e.genre);
              return (
                <div
                  key={e.entryId}
                  data-testid={`bk-card-${e.entryId}`}
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
