import { useState } from "react";
import { Loader2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface WonderEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  wonder: string;
}

interface WonderBoardState extends Record<string, unknown> {
  entries: WonderEntry[];
  revealed: boolean;
}

interface WonderBoardConfig {
  title?: string;
  prompt?: string;
  placeholder?: string;
}

function extractConfig(raw: Record<string, unknown>): WonderBoardConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "🤔 好奇探索板",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "說一件你好奇的事——用「我好奇...」開頭",
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : "我好奇...",
  };
}

const CARD_COLORS = [
  "from-sky-100 to-blue-50 border-sky-300",
  "from-violet-100 to-purple-50 border-violet-300",
  "from-teal-100 to-emerald-50 border-teal-300",
  "from-fuchsia-100 to-pink-50 border-fuchsia-300",
  "from-indigo-100 to-blue-50 border-indigo-300",
];

export interface WonderBoardProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function WonderBoard({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: WonderBoardProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<WonderBoardState>({
    gameId,
    sessionId,
    pageId,
    type: "wonder_board",
    defaultState: { entries: [], revealed: false },
  });

  const [wonder, setWonder] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="wo-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = wonder.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: WonderEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      wonder: wonder.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setWonder("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <HelpCircle className="w-6 h-6 text-sky-500" />
        <h2 className="text-xl font-bold" data-testid="wo-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="wo-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="wo-count">
        已提交：{state.entries.length} 則好奇
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder={cfg.placeholder}
            value={wonder}
            onChange={(e) => setWonder(e.target.value)}
            maxLength={80}
            data-testid="wo-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            data-testid="wo-submit-btn"
          >
            提交好奇心
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl border border-sky-200 bg-sky-50 text-sm" data-testid="wo-my-entry">
          <p className="text-sky-700 font-medium">🤔 {myEntry.wonder}</p>
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-3" data-testid="wo-result">
          {state.entries.length === 0 ? (
            <p className="text-center text-muted-foreground" data-testid="wo-empty">尚無好奇心</p>
          ) : (
            state.entries.map((entry, idx) => (
              <div
                key={entry.entryId}
                data-testid={`wo-card-${entry.entryId}`}
                className={`rounded-xl border p-4 bg-gradient-to-br ${CARD_COLORS[idx % CARD_COLORS.length]}`}
              >
                <p className="text-xs font-medium text-muted-foreground mb-1">{entry.userName}</p>
                <p className="font-semibold text-sm">🤔 {entry.wonder}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="wo-reveal-btn">
            揭曉所有好奇心
          </Button>
        )
      )}
    </div>
  );
}

export default WonderBoard;
