import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface ObstacleEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  obstacle: string;
}

interface ObstacleMapState extends Record<string, unknown> {
  entries: ObstacleEntry[];
  revealed: boolean;
}

interface ObstacleMapConfig {
  title?: string;
  prompt?: string;
  placeholder?: string;
}

function extractConfig(raw: Record<string, unknown>): ObstacleMapConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "🚧 障礙地圖",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "說出一件正在阻礙你或我們前進的事",
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : "我被...卡住了",
  };
}

const CARD_COLORS = [
  "bg-orange-50 border-orange-200",
  "bg-amber-50 border-amber-200",
  "bg-red-50 border-red-200",
  "bg-rose-50 border-rose-200",
  "bg-yellow-50 border-yellow-200",
];

export interface ObstacleMapProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ObstacleMap({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: ObstacleMapProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<ObstacleMapState>({
    gameId,
    sessionId,
    pageId,
    type: "obstacle_map",
    defaultState: { entries: [], revealed: false },
  });

  const [obstacle, setObstacle] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="om-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = obstacle.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: ObstacleEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      obstacle: obstacle.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setObstacle("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <AlertTriangle className="w-6 h-6 text-orange-500" />
        <h2 className="text-xl font-bold" data-testid="om-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="om-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="om-count">
        已提交：{state.entries.length} 個障礙
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder={cfg.placeholder}
            value={obstacle}
            onChange={(e) => setObstacle(e.target.value)}
            maxLength={80}
            data-testid="om-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            data-testid="om-submit-btn"
          >
            提交障礙
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl border border-orange-200 bg-orange-50 text-sm" data-testid="om-my-entry">
          <p className="font-bold text-orange-700">🚧 {myEntry.obstacle}</p>
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-2" data-testid="om-result">
          {state.entries.length === 0 ? (
            <p className="text-center text-muted-foreground" data-testid="om-empty">沒有障礙，太厲害了！</p>
          ) : (
            state.entries.map((entry, idx) => (
              <div
                key={entry.entryId}
                data-testid={`om-card-${entry.entryId}`}
                className={`rounded-xl border p-3 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
              >
                <p className="text-xs font-medium text-muted-foreground mb-1">{entry.userName}</p>
                <p className="font-semibold text-sm">🚧 {entry.obstacle}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="om-reveal-btn">
            揭曉所有障礙
          </Button>
        )
      )}
    </div>
  );
}

export default ObstacleMap;
