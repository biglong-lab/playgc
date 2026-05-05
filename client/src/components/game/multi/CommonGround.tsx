import { useState } from "react";
import { Loader2, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface CommonGroundEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  commonality: string;
}

interface CommonGroundState extends Record<string, unknown> {
  entries: CommonGroundEntry[];
  revealed: boolean;
}

interface CommonGroundConfig {
  title?: string;
  prompt?: string;
  placeholder?: string;
}

function extractConfig(raw: Record<string, unknown>): CommonGroundConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "🤝 共同點地圖",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "說一件你和這個團隊有共同點的事！",
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : "我和大家的共同點是...",
  };
}

const CARD_COLORS = [
  "from-teal-100 to-emerald-50 border-teal-300",
  "from-sky-100 to-blue-50 border-sky-300",
  "from-green-100 to-emerald-50 border-green-300",
  "from-cyan-100 to-sky-50 border-cyan-300",
  "from-indigo-100 to-blue-50 border-indigo-300",
];

export interface CommonGroundProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function CommonGround({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: CommonGroundProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<CommonGroundState>({
    gameId,
    sessionId,
    pageId,
    type: "common_ground",
    defaultState: { entries: [], revealed: false },
  });

  const [commonality, setCommonality] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="cg-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = commonality.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: CommonGroundEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      commonality: commonality.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setCommonality("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <Handshake className="w-6 h-6 text-teal-500" />
        <h2 className="text-xl font-bold" data-testid="cg-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="cg-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="cg-count">
        已提交：{state.entries.length} 個共同點
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder={cfg.placeholder}
            value={commonality}
            onChange={(e) => setCommonality(e.target.value)}
            maxLength={80}
            data-testid="cg-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            data-testid="cg-submit-btn"
          >
            提交共同點
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl border border-teal-200 bg-teal-50 text-sm" data-testid="cg-my-entry">
          <p className="font-bold text-teal-700">🤝 {myEntry.commonality}</p>
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-3" data-testid="cg-result">
          {state.entries.length === 0 ? (
            <p className="text-center text-muted-foreground" data-testid="cg-empty">尚無共同點</p>
          ) : (
            state.entries.map((entry, idx) => (
              <div
                key={entry.entryId}
                data-testid={`cg-card-${entry.entryId}`}
                className={`rounded-xl border p-4 bg-gradient-to-br ${CARD_COLORS[idx % CARD_COLORS.length]}`}
              >
                <p className="text-xs font-medium text-muted-foreground mb-1">{entry.userName}</p>
                <p className="font-semibold text-sm">🤝 {entry.commonality}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="cg-reveal-btn">
            揭曉所有共同點
          </Button>
        )
      )}
    </div>
  );
}

export default CommonGround;
