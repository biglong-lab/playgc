import { useState } from "react";
import { Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface MicroBioEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  superpower: string;
  funFact: string;
  goal: string;
}

interface MicroBioState extends Record<string, unknown> {
  entries: MicroBioEntry[];
  revealed: boolean;
}

interface MicroBioConfig {
  title?: string;
  prompt?: string;
  superpowerLabel?: string;
  funFactLabel?: string;
  goalLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): MicroBioConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "迷你履歷",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "用三個關鍵詞介紹自己！",
    superpowerLabel: typeof raw.superpowerLabel === "string" ? raw.superpowerLabel : "⚡ 我的超能力",
    funFactLabel: typeof raw.funFactLabel === "string" ? raw.funFactLabel : "🎲 冷知識",
    goalLabel: typeof raw.goalLabel === "string" ? raw.goalLabel : "🎯 我的目標",
  };
}

const CARD_COLORS = [
  "from-violet-100 to-purple-50 border-violet-300",
  "from-sky-100 to-blue-50 border-sky-300",
  "from-emerald-100 to-green-50 border-emerald-300",
  "from-amber-100 to-yellow-50 border-amber-300",
  "from-rose-100 to-pink-50 border-rose-300",
];

export interface MicroBioProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MicroBio({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: MicroBioProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<MicroBioState>({
    gameId,
    sessionId,
    pageId,
    type: "micro_bio",
    defaultState: { entries: [], revealed: false },
  });

  const [superpower, setSuperpower] = useState("");
  const [funFact, setFunFact] = useState("");
  const [goal, setGoal] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="mb-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = superpower.trim() && funFact.trim() && goal.trim();

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: MicroBioEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      superpower: superpower.trim(),
      funFact: funFact.trim(),
      goal: goal.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setSuperpower("");
    setFunFact("");
    setGoal("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <User className="w-6 h-6 text-violet-500" />
        <h2 className="text-xl font-bold" data-testid="mb-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="mb-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="mb-count">
        已建立：{state.entries.length} 張履歷
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder={cfg.superpowerLabel}
            value={superpower}
            onChange={(e) => setSuperpower(e.target.value)}
            maxLength={20}
            data-testid="mb-superpower-input"
          />
          <Input
            placeholder={cfg.funFactLabel}
            value={funFact}
            onChange={(e) => setFunFact(e.target.value)}
            maxLength={25}
            data-testid="mb-funfact-input"
          />
          <Input
            placeholder={cfg.goalLabel}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            maxLength={25}
            data-testid="mb-goal-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            data-testid="mb-submit-btn"
          >
            建立迷你履歷
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl border border-violet-200 bg-violet-50" data-testid="mb-my-card">
          <p className="font-bold text-violet-700 text-sm mb-1">{myEntry.userName}</p>
          <p className="text-sm">⚡ {myEntry.superpower}</p>
          <p className="text-sm text-muted-foreground">🎲 {myEntry.funFact}</p>
          <p className="text-sm text-muted-foreground">🎯 {myEntry.goal}</p>
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-3" data-testid="mb-result">
          {state.entries.length === 0 ? (
            <p className="text-center text-muted-foreground" data-testid="mb-empty">尚無履歷</p>
          ) : (
            state.entries.map((entry, idx) => (
              <div
                key={entry.entryId}
                data-testid={`mb-card-${entry.entryId}`}
                className={`rounded-xl border p-4 bg-gradient-to-br ${CARD_COLORS[idx % CARD_COLORS.length]}`}
              >
                <p className="font-bold text-sm mb-2">{entry.userName}</p>
                <p className="text-sm">⚡ {entry.superpower}</p>
                <p className="text-sm text-muted-foreground">🎲 {entry.funFact}</p>
                <p className="text-sm text-muted-foreground">🎯 {entry.goal}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="mb-reveal-btn">
            揭曉所有迷你履歷
          </Button>
        )
      )}
    </div>
  );
}

export default MicroBio;
