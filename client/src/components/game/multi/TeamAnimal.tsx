import { useState } from "react";
import { Loader2, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface TeamAnimalEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  subject: string;
  reason: string;
}

interface TeamAnimalState extends Record<string, unknown> {
  entries: TeamAnimalEntry[];
  revealed: boolean;
}

interface TeamAnimalConfig {
  title?: string;
  prompt?: string;
  subjectLabel?: string;
  reasonLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): TeamAnimalConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "🦁 團隊隱喻",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "如果你的團隊是一種動物（電影/歌曲/食物），會是什麼？",
    subjectLabel: typeof raw.subjectLabel === "string" ? raw.subjectLabel : "🦁 你選的隱喻",
    reasonLabel: typeof raw.reasonLabel === "string" ? raw.reasonLabel : "💬 理由",
  };
}

const CARD_COLORS = [
  "from-amber-100 to-yellow-50 border-amber-300",
  "from-emerald-100 to-green-50 border-emerald-300",
  "from-sky-100 to-blue-50 border-sky-300",
  "from-rose-100 to-pink-50 border-rose-300",
  "from-violet-100 to-purple-50 border-violet-300",
];

export interface TeamAnimalProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeamAnimal({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: TeamAnimalProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamAnimalState>({
    gameId,
    sessionId,
    pageId,
    type: "team_animal",
    defaultState: { entries: [], revealed: false },
  });

  const [subject, setSubject] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="ta-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = subject.trim() && reason.trim();

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: TeamAnimalEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      subject: subject.trim(),
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setSubject("");
    setReason("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <Smile className="w-6 h-6 text-amber-500" />
        <h2 className="text-xl font-bold" data-testid="ta-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="ta-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="ta-count">
        已提交：{state.entries.length} 張
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder={cfg.subjectLabel}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={30}
            data-testid="ta-subject-input"
          />
          <Input
            placeholder={cfg.reasonLabel}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={60}
            data-testid="ta-reason-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            data-testid="ta-submit-btn"
          >
            提交隱喻
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm" data-testid="ta-my-entry">
          <p className="font-bold text-amber-700">{myEntry.subject}</p>
          <p className="text-muted-foreground mt-1">💬 {myEntry.reason}</p>
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-3" data-testid="ta-result">
          {state.entries.length === 0 ? (
            <p className="text-center text-muted-foreground" data-testid="ta-empty">尚無隱喻</p>
          ) : (
            state.entries.map((entry, idx) => (
              <div
                key={entry.entryId}
                data-testid={`ta-card-${entry.entryId}`}
                className={`rounded-xl border p-4 bg-gradient-to-br ${CARD_COLORS[idx % CARD_COLORS.length]}`}
              >
                <p className="font-bold text-sm">{entry.userName}</p>
                <p className="text-lg font-bold mt-1">{entry.subject}</p>
                <p className="text-sm text-muted-foreground mt-1">💬 {entry.reason}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="ta-reveal-btn">
            揭曉所有隱喻
          </Button>
        )
      )}
    </div>
  );
}

export default TeamAnimal;
