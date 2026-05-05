import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface McEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  rating: number;
  takeaway: string;
}

interface MeetingCheckState extends Record<string, unknown> {
  entries: McEntry[];
  revealed: boolean;
}

interface MeetingCheckConfig {
  title?: string;
  prompt?: string;
  takeawayLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): MeetingCheckConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "會議結束確認",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "這次會議如何？",
    takeawayLabel: typeof raw.takeawayLabel === "string" ? raw.takeawayLabel : "你最大的收穫是什麼？",
  };
}

export interface MeetingCheckProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MeetingCheck({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: MeetingCheckProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<MeetingCheckState>({
    gameId,
    sessionId,
    pageId,
    type: "meeting_check",
    defaultState: { entries: [], revealed: false },
  });

  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [takeaway, setTakeaway] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="mc-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const total = state.entries.length;
  const avgRating = total > 0 ? state.entries.reduce((sum, e) => sum + e.rating, 0) / total : 0;

  function handleSubmit() {
    if (!selected || myEntry) return;
    const entry: McEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      rating: selected,
      takeaway: takeaway.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setSelected(null);
    setTakeaway("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const displayScore = hovered ?? selected ?? 0;

  return (
    <div className="p-4 flex flex-col gap-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-center" data-testid="mc-title">
        {cfg.title ?? "會議結束確認"}
      </h2>
      <p className="text-center text-muted-foreground text-sm" data-testid="mc-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="mc-count">
        已回覆：{total} 人
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-center gap-1" data-testid="mc-stars">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                onMouseEnter={() => setHovered(score)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(score)}
                data-testid={`mc-star-${score}`}
                className="p-1 transition-transform hover:scale-125"
                aria-label={`${score} 星`}
              >
                <Star
                  className={`w-9 h-9 transition-colors ${score <= displayScore ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`}
                />
              </button>
            ))}
          </div>
          {selected !== null && (
            <p className="text-center text-sm text-muted-foreground" data-testid="mc-selected-label">
              已選 {selected} 星
            </p>
          )}
          <Input
            placeholder={cfg.takeawayLabel ?? "你最大的收穫是什麼？"}
            value={takeaway}
            onChange={(e) => setTakeaway(e.target.value)}
            maxLength={100}
            data-testid="mc-takeaway-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!selected}
            className="w-full"
            data-testid="mc-submit-btn"
          >
            提交
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm" data-testid="mc-my-entry">
          <p className="font-semibold">
            {Array.from({ length: myEntry.rating }, (_, i) => (
              <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400 inline" />
            ))}
          </p>
          {myEntry.takeaway && <p className="text-muted-foreground mt-1">💬 {myEntry.takeaway}</p>}
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-3" data-testid="mc-result">
          <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-3xl font-bold text-amber-500" data-testid="mc-avg">
              {avgRating.toFixed(1)} / 5
            </p>
            <p className="text-sm text-muted-foreground">平均評分</p>
          </div>
          {state.entries.filter((e) => e.takeaway).map((e) => (
            <div key={e.entryId} className="text-sm p-2 bg-gray-50 rounded-lg border" data-testid={`mc-entry-${e.entryId}`}>
              <p className="font-medium text-muted-foreground text-xs">{e.userName} ({e.rating}★)</p>
              <p>{e.takeaway as string}</p>
            </div>
          ))}
        </div>
      ) : (
        isTeamLead && myEntry && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="mc-reveal-btn">
            公布結果
          </Button>
        )
      )}
    </div>
  );
}

export default MeetingCheck;
