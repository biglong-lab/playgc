import { useState } from "react";
import { Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface GoalEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  goal: string;
}

interface TeamGoalState extends Record<string, unknown> {
  entries: GoalEntry[];
  revealed: boolean;
}

interface TeamGoalConfig {
  title?: string;
  prompt?: string;
  placeholder?: string;
}

function extractConfig(raw: Record<string, unknown>): TeamGoalConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "團隊目標",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "你認為這個季度最重要的一個團隊目標是什麼？",
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : "輸入你的目標...",
  };
}

const GOAL_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

export interface TeamGoalProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeamGoal({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: TeamGoalProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamGoalState>({
    gameId,
    sessionId,
    pageId,
    type: "team_goal",
    defaultState: { entries: [], revealed: false },
  });

  const [goal, setGoal] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="tg-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!goal.trim() || myEntry) return;
    const entry: GoalEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      goal: goal.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setGoal("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <Target className="w-6 h-6 text-violet-500" />
        <h2 className="text-xl font-bold text-center" data-testid="tg-title">
          {cfg.title ?? "團隊目標"}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="tg-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="tg-count">
        已提交：{state.entries.length} 人
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <Textarea
            placeholder={cfg.placeholder ?? "輸入你的目標..."}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            maxLength={150}
            data-testid="tg-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!goal.trim()}
            className="w-full"
            data-testid="tg-submit-btn"
          >
            提交目標
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-sm" data-testid="tg-my-entry">
          <p className="font-semibold text-violet-700">🎯 {myEntry.goal}</p>
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-3" data-testid="tg-result">
          {state.entries.length === 0 ? (
            <p className="text-center text-muted-foreground" data-testid="tg-empty">
              尚無提交
            </p>
          ) : (
            state.entries.map((entry, idx) => (
              <div
                key={entry.entryId}
                data-testid={`tg-entry-${entry.entryId}`}
                className={`rounded-xl p-4 text-white ${GOAL_COLORS[idx % GOAL_COLORS.length]}`}
              >
                <p className="text-xs font-medium opacity-80">{entry.userName}</p>
                <p className="font-bold mt-1">🎯 {entry.goal}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        isTeamLead && (
          <Button
            onClick={handleReveal}
            variant="default"
            className="w-full"
            data-testid="tg-reveal-btn"
          >
            展示所有目標
          </Button>
        )
      )}
    </div>
  );
}

export default TeamGoal;
