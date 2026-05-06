import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface BoardGameEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  game: string;
  reason: string;
}

interface BoardGameState extends Record<string, unknown> {
  entries: BoardGameEntry[];
  revealed: boolean;
}

interface BoardGameConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): BoardGameConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const GAMES = [
  { id: "chess", label: "西洋棋", emoji: "♟️", desc: "深謀遠慮每步為計" },
  { id: "poker", label: "撲克牌", emoji: "🃏", desc: "察言觀色善讀人心" },
  { id: "mahjong", label: "麻將", emoji: "🀄", desc: "靈活應變隨機應變" },
  { id: "monopoly", label: "大富翁", emoji: "🏠", desc: "積極進取掌握資源" },
  { id: "uno", label: "烏諾", emoji: "🎴", desc: "充滿驚喜喜歡翻盤" },
  { id: "trivia", label: "益智問答", emoji: "🧠", desc: "博學多聞知識淵博" },
  { id: "roleplaying", label: "角色扮演", emoji: "🎭", desc: "創意豐富善於表達" },
  { id: "strategy", label: "戰略遊戲", emoji: "🗺️", desc: "全局思考系統規劃" },
  { id: "party", label: "派對遊戲", emoji: "🎉", desc: "活潑開朗帶動氣氛" },
];

const CARD_COLORS = [
  "border-l-slate-500 bg-slate-50",
  "border-l-red-400 bg-red-50",
  "border-l-green-500 bg-green-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-yellow-500 bg-yellow-50",
  "border-l-purple-400 bg-purple-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-teal-400 bg-teal-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function BoardGame({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<BoardGameState>({
    gameId,
    sessionId,
    pageId,
    type: "board_game",
    defaultState: { entries: [], revealed: false },
  });

  const [game, setGame] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="bg-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as BoardGameEntry[]).find((e) => e.userId === userId);
  const canSubmit = game !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: BoardGameEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      game,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as BoardGameEntry[]), entry] });
    setGame("");
    setReason("");
  };

  const entries = state.entries as BoardGameEntry[];
  const revealed = state.revealed as boolean;

  const gameCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.game] = (acc[e.game] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="bg-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種桌遊"}
      </div>
      <div data-testid="bg-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種桌遊，你最像哪種？說說你的遊戲個性！"}
      </div>
      <div data-testid="bg-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="bg-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {GAMES.map((g) => (
              <button
                key={g.id}
                data-testid={`bg-game-${g.id}`}
                onClick={() => setGame(g.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${game === g.id ? "border-slate-600 bg-slate-50 font-semibold" : "hover:border-slate-500"}`}
              >
                <span className="text-2xl">{g.emoji}</span>
                <div className="font-medium text-center">{g.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{g.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="bg-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種桌遊最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="bg-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-slate-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            開局！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="bg-my-entry" className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{GAMES.find((g) => g.id === myEntry.game)?.emoji}</span>
            <span className="text-sm font-semibold">{GAMES.find((g) => g.id === myEntry.game)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已入桌</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="bg-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-slate-700 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊遊戲室
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="bg-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇桌遊類型
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="bg-result" className="flex flex-col gap-3">
          <div data-testid="bg-game-summary" className="flex flex-wrap gap-2">
            {GAMES.filter((g) => gameCounts[g.id] > 0).map((g) => (
              <div
                key={g.id}
                data-testid={`bg-badge-${g.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                {g.emoji} {g.label}
                <span className="ml-1 bg-slate-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {gameCounts[g.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="bg-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const g = GAMES.find((x) => x.id === e.game);
              return (
                <div
                  key={e.entryId}
                  data-testid={`bg-card-${e.entryId}`}
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
