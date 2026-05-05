import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface PebEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  plus: string;
  evenBetter: string;
}

interface PlusEvenBetterState extends Record<string, unknown> {
  entries: PebEntry[];
  revealed: boolean;
}

interface PlusEvenBetterConfig {
  title?: string;
  plusLabel?: string;
  evenBetterLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): PlusEvenBetterConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "Plus / Even Better",
    plusLabel: typeof raw.plusLabel === "string" ? raw.plusLabel : "➕ Plus（做得好的地方）",
    evenBetterLabel: typeof raw.evenBetterLabel === "string" ? raw.evenBetterLabel : "💡 Even Better（可以更好的地方）",
  };
}

export interface PlusEvenBetterProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function PlusEvenBetter({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: PlusEvenBetterProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<PlusEvenBetterState>({
    gameId,
    sessionId,
    pageId,
    type: "plus_even_better",
    defaultState: { entries: [], revealed: false },
  });

  const [plus, setPlus] = useState("");
  const [evenBetter, setEvenBetter] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="peb-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = plus.trim() || evenBetter.trim();

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: PebEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      plus: plus.trim(),
      evenBetter: evenBetter.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setPlus("");
    setEvenBetter("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-center" data-testid="peb-title">
        {cfg.title ?? "Plus / Even Better"}
      </h2>
      <p className="text-sm text-center text-muted-foreground" data-testid="peb-count">
        已回覆：{state.entries.length} 人
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-green-200 bg-green-50 p-3">
            <p className="text-sm font-semibold text-green-700 mb-2">{cfg.plusLabel}</p>
            <Textarea
              placeholder="填寫做得好的地方..."
              value={plus}
              onChange={(e) => setPlus(e.target.value)}
              rows={3}
              maxLength={200}
              data-testid="peb-plus-input"
            />
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-700 mb-2">{cfg.evenBetterLabel}</p>
            <Textarea
              placeholder="填寫可以改善的地方..."
              value={evenBetter}
              onChange={(e) => setEvenBetter(e.target.value)}
              rows={3}
              maxLength={200}
              data-testid="peb-even-better-input"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            data-testid="peb-submit-btn"
          >
            提交回饋
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl bg-gray-50 border text-sm flex flex-col gap-2" data-testid="peb-my-entry">
          {myEntry.plus && (
            <p><span className="font-semibold text-green-700">➕</span> {myEntry.plus}</p>
          )}
          {myEntry.evenBetter && (
            <p><span className="font-semibold text-amber-700">💡</span> {myEntry.evenBetter}</p>
          )}
        </div>
      )}

      {state.revealed ? (
        <div className="grid grid-cols-2 gap-3" data-testid="peb-result">
          {(["plus", "evenBetter"] as const).map((col) => {
            const isPlus = col === "plus";
            const items = state.entries.filter((e) => e[col]);
            return (
              <div
                key={col}
                data-testid={`peb-col-${col}`}
                className={`rounded-xl border p-3 flex flex-col gap-2 ${isPlus ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}
              >
                <p className={`text-xs font-bold text-center ${isPlus ? "text-green-700" : "text-amber-700"}`}>
                  {isPlus ? cfg.plusLabel : cfg.evenBetterLabel}
                </p>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">無</p>
                ) : (
                  items.map((e) => (
                    <div key={e.entryId} className="text-xs p-2 bg-white rounded border">
                      <p className="font-medium text-muted-foreground">{e.userName}</p>
                      <p>{e[col] as string}</p>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="peb-reveal-btn">
            公布回饋
          </Button>
        )
      )}
    </div>
  );
}

export default PlusEvenBetter;
