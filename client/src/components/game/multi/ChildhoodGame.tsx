import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface GameEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  gameName: string;
  era: string;
  memory: string;
}

interface ChildhoodGameState extends Record<string, unknown> {
  entries: GameEntry[];
  revealed: boolean;
}

interface ChildhoodGameConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): ChildhoodGameConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const ERAS = [
  { id: "80s", label: "80 年代", emoji: "📺" },
  { id: "90s", label: "90 年代", emoji: "🕹️" },
  { id: "00s", label: "2000 年代", emoji: "💿" },
  { id: "10s", label: "2010 年代", emoji: "📱" },
  { id: "recent", label: "近幾年", emoji: "🎮" },
];

const CARD_COLORS = [
  "border-l-violet-400 bg-violet-50",
  "border-l-pink-400 bg-pink-50",
  "border-l-sky-400 bg-sky-50",
  "border-l-green-400 bg-green-50",
  "border-l-orange-400 bg-orange-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ChildhoodGame({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ChildhoodGameState>({
    gameId,
    sessionId,
    pageId,
    type: "childhood_game",
    defaultState: { entries: [], revealed: false },
  });

  const [gameName, setGameName] = useState("");
  const [era, setEra] = useState("");
  const [memory, setMemory] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="cg-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as GameEntry[]).find((e) => e.userId === userId);
  const canSubmit = gameName.trim().length >= 2 && era !== "" && memory.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: GameEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      gameName: gameName.trim(),
      era,
      memory: memory.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as GameEntry[]), entry] });
    setGameName("");
    setEra("");
    setMemory("");
  };

  const entries = state.entries as GameEntry[];
  const revealed = state.revealed as boolean;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="cg-title" className="text-xl font-bold text-center">
        {cfg.title ?? "童年遊戲記憶"}
      </div>
      <div data-testid="cg-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "說說你童年最喜歡的遊戲，勾起大家的美好回憶！"}
      </div>
      <div data-testid="cg-count" className="text-xs text-center text-muted-foreground">
        已分享 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="cg-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <input
            data-testid="cg-game-input"
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="遊戲名稱（至少2字，例如：大富翁、超級瑪利歐）"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
          />
          <div className="flex gap-2 overflow-x-auto">
            {ERAS.map((e) => (
              <button
                key={e.id}
                data-testid={`cg-era-${e.id}`}
                onClick={() => setEra(e.id)}
                className={`flex flex-col items-center px-3 py-2 rounded-xl border text-xs shrink-0 transition-all ${era === e.id ? "border-violet-400 bg-violet-50 font-semibold" : "hover:border-violet-300"}`}
              >
                <span className="text-lg">{e.emoji}</span>
                <span className="mt-1">{e.label}</span>
              </button>
            ))}
          </div>
          <textarea
            data-testid="cg-memory-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="分享一個跟這個遊戲有關的回憶（至少5字）"
            value={memory}
            onChange={(e) => setMemory(e.target.value)}
          />
          <button
            data-testid="cg-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-violet-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            分享回憶！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="cg-my-entry" className="bg-violet-50 rounded-xl p-3 border border-violet-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{ERAS.find((e) => e.id === myEntry.era)?.emoji}</span>
            <span className="text-sm font-semibold">{myEntry.gameName}</span>
            <span className="text-xs text-muted-foreground">· {ERAS.find((e) => e.id === myEntry.era)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground line-clamp-2">{myEntry.memory}</div>
          <div className="text-xs text-muted-foreground mt-1">已提交</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="cg-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-violet-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊童年遊戲
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="cg-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人分享遊戲回憶
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="cg-result" className="flex flex-col gap-3">
          <div data-testid="cg-game-wall" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const er = ERAS.find((era) => era.id === e.era);
              return (
                <div
                  key={e.entryId}
                  data-testid={`cg-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{er?.emoji}</span>
                    <span className="text-sm font-semibold">{e.gameName}</span>
                    <span className="text-xs text-muted-foreground">· {er?.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{e.memory}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
