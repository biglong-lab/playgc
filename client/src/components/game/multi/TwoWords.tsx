import { useState } from "react";
import { Loader2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface TwoWordEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  wordA: string;
  wordB: string;
}

interface TwoWordsState extends Record<string, unknown> {
  entries: TwoWordEntry[];
  revealed: boolean;
}

interface TwoWordsConfig {
  title?: string;
  prompt?: string;
  wordALabel?: string;
  wordBLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): TwoWordsConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "兩個字",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "用兩個字描述這次活動/專案",
    wordALabel: typeof raw.wordALabel === "string" ? raw.wordALabel : "第一個字",
    wordBLabel: typeof raw.wordBLabel === "string" ? raw.wordBLabel : "第二個字",
  };
}

const CARD_COLORS = [
  "bg-gradient-to-br from-violet-100 to-purple-100 border-purple-300",
  "bg-gradient-to-br from-sky-100 to-blue-100 border-blue-300",
  "bg-gradient-to-br from-emerald-100 to-green-100 border-green-300",
  "bg-gradient-to-br from-amber-100 to-yellow-100 border-yellow-300",
  "bg-gradient-to-br from-rose-100 to-pink-100 border-pink-300",
];

export interface TwoWordsProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TwoWords({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: TwoWordsProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<TwoWordsState>({
    gameId,
    sessionId,
    pageId,
    type: "two_words",
    defaultState: { entries: [], revealed: false },
  });

  const [wordA, setWordA] = useState("");
  const [wordB, setWordB] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="tw-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    const trimA = wordA.trim();
    const trimB = wordB.trim();
    if (!trimA || !trimB || myEntry) return;
    const entry: TwoWordEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      wordA: trimA,
      wordB: trimB,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setWordA("");
    setWordB("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <Type className="w-6 h-6 text-violet-500" />
        <h2 className="text-xl font-bold" data-testid="tw-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="tw-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="tw-count">
        已提交：{state.entries.length} 份
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">{cfg.wordALabel}</p>
              <Input
                placeholder="第一個字"
                value={wordA}
                onChange={(e) => setWordA(e.target.value)}
                maxLength={10}
                data-testid="tw-word-a-input"
              />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">{cfg.wordBLabel}</p>
              <Input
                placeholder="第二個字"
                value={wordB}
                onChange={(e) => setWordB(e.target.value)}
                maxLength={10}
                data-testid="tw-word-b-input"
              />
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!wordA.trim() || !wordB.trim()}
            className="w-full"
            data-testid="tw-submit-btn"
          >
            提交
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-center" data-testid="tw-my-entry">
          <p className="text-lg font-bold text-violet-700">
            {myEntry.wordA} · {myEntry.wordB}
          </p>
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-3" data-testid="tw-result">
          {state.entries.length === 0 ? (
            <p className="text-center text-muted-foreground" data-testid="tw-empty">尚無回應</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {state.entries.map((entry, idx) => (
                <div
                  key={entry.entryId}
                  data-testid={`tw-entry-${entry.entryId}`}
                  className={`rounded-xl border p-3 text-center ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <p className="text-xs text-muted-foreground mb-1">{entry.userName}</p>
                  <p className="text-base font-bold leading-snug">
                    {entry.wordA}
                    <span className="text-muted-foreground mx-1">·</span>
                    {entry.wordB}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="tw-reveal-btn">
            揭曉所有回應
          </Button>
        )
      )}
    </div>
  );
}

export default TwoWords;
