import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

type SscCategory = "start" | "stop" | "continue";

interface SscEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  start: string;
  stop: string;
  continue: string;
}

interface StartStopContinueState extends Record<string, unknown> {
  entries: SscEntry[];
  revealed: boolean;
}

interface StartStopContinueConfig {
  title?: string;
  startLabel?: string;
  stopLabel?: string;
  continueLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): StartStopContinueConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "Start / Stop / Continue",
    startLabel: typeof raw.startLabel === "string" ? raw.startLabel : "Start（開始做）",
    stopLabel: typeof raw.stopLabel === "string" ? raw.stopLabel : "Stop（停止做）",
    continueLabel: typeof raw.continueLabel === "string" ? raw.continueLabel : "Continue（繼續做）",
  };
}

const COLUMN_STYLE: Record<SscCategory, { bg: string; border: string; emoji: string; text: string }> = {
  start: { bg: "bg-green-50", border: "border-green-200", emoji: "🚀", text: "text-green-700" },
  stop: { bg: "bg-red-50", border: "border-red-200", emoji: "🛑", text: "text-red-700" },
  continue: { bg: "bg-blue-50", border: "border-blue-200", emoji: "🔄", text: "text-blue-700" },
};

export interface StartStopContinueProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function StartStopContinue({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: StartStopContinueProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<StartStopContinueState>({
    gameId,
    sessionId,
    pageId,
    type: "start_stop_continue",
    defaultState: { entries: [], revealed: false },
  });

  const [start, setStart] = useState("");
  const [stop, setStop] = useState("");
  const [cont, setCont] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="ssc-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = start.trim() || stop.trim() || cont.trim();

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: SscEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      start: start.trim(),
      stop: stop.trim(),
      continue: cont.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setStart("");
    setStop("");
    setCont("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-center" data-testid="ssc-title">
        {cfg.title ?? "Start / Stop / Continue"}
      </h2>
      <p className="text-sm text-center text-muted-foreground" data-testid="ssc-count">
        已回覆：{state.entries.length} 人
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-3">
          {(["start", "stop", "continue"] as SscCategory[]).map((cat) => {
            const style = COLUMN_STYLE[cat];
            const value = cat === "start" ? start : cat === "stop" ? stop : cont;
            const setter = cat === "start" ? setStart : cat === "stop" ? setStop : setCont;
            const label = cat === "start" ? cfg.startLabel : cat === "stop" ? cfg.stopLabel : cfg.continueLabel;
            return (
              <div key={cat} className={`rounded-xl border ${style.border} ${style.bg} p-3`}>
                <p className={`text-sm font-semibold mb-2 ${style.text}`}>
                  {style.emoji} {label}
                </p>
                <Textarea
                  placeholder={`輸入 ${label}...`}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  rows={2}
                  maxLength={150}
                  data-testid={`ssc-${cat}-input`}
                />
              </div>
            );
          })}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            data-testid="ssc-submit-btn"
          >
            提交回饋
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl bg-gray-50 border text-sm flex flex-col gap-1" data-testid="ssc-my-entry">
          {myEntry.start && (
            <p><span className="font-semibold text-green-700">🚀 Start：</span>{myEntry.start}</p>
          )}
          {myEntry.stop && (
            <p><span className="font-semibold text-red-700">🛑 Stop：</span>{myEntry.stop}</p>
          )}
          {myEntry.continue && (
            <p><span className="font-semibold text-blue-700">🔄 Continue：</span>{myEntry.continue}</p>
          )}
        </div>
      )}

      {state.revealed ? (
        <div className="grid grid-cols-3 gap-3" data-testid="ssc-result">
          {(["start", "stop", "continue"] as SscCategory[]).map((cat) => {
            const style = COLUMN_STYLE[cat];
            const label = cat === "start" ? cfg.startLabel : cat === "stop" ? cfg.stopLabel : cfg.continueLabel;
            const items = state.entries.filter((e) => e[cat]);
            return (
              <div key={cat} className={`rounded-xl border ${style.border} ${style.bg} p-3 flex flex-col gap-2`} data-testid={`ssc-col-${cat}`}>
                <p className={`text-xs font-bold text-center ${style.text}`}>{style.emoji} {label}</p>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">無</p>
                ) : (
                  items.map((e) => (
                    <div key={e.entryId} className="text-xs p-2 bg-white rounded border">
                      <p className="font-medium text-muted-foreground">{e.userName}</p>
                      <p>{e[cat] as string}</p>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="ssc-reveal-btn">
            公布回饋結果
          </Button>
        )
      )}
    </div>
  );
}

export default StartStopContinue;
