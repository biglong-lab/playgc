import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

type KptCategory = "keep" | "problem" | "try";

interface KptEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  keep: string;
  problem: string;
  try: string;
}

interface KptRetroState extends Record<string, unknown> {
  entries: KptEntry[];
  revealed: boolean;
}

interface KptRetroConfig {
  title?: string;
  keepLabel?: string;
  problemLabel?: string;
  tryLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): KptRetroConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "KPT 回顧",
    keepLabel: typeof raw.keepLabel === "string" ? raw.keepLabel : "Keep（繼續）",
    problemLabel: typeof raw.problemLabel === "string" ? raw.problemLabel : "Problem（問題）",
    tryLabel: typeof raw.tryLabel === "string" ? raw.tryLabel : "Try（嘗試）",
  };
}

const COLUMN_STYLE: Record<KptCategory, { bg: string; border: string; badge: string; emoji: string }> = {
  keep: { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-500", emoji: "✅" },
  problem: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-500", emoji: "⚠️" },
  try: { bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-500", emoji: "💡" },
};

export interface KptRetroProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function KptRetro({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: KptRetroProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<KptRetroState>({
    gameId,
    sessionId,
    pageId,
    type: "kpt_retro",
    defaultState: { entries: [], revealed: false },
  });

  const [keep, setKeep] = useState("");
  const [problem, setProblem] = useState("");
  const [tryText, setTryText] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="kpt-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = keep.trim() || problem.trim() || tryText.trim();

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: KptEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      keep: keep.trim(),
      problem: problem.trim(),
      try: tryText.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setKeep("");
    setProblem("");
    setTryText("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-center" data-testid="kpt-title">
        {cfg.title ?? "KPT 回顧"}
      </h2>
      <p className="text-sm text-center text-muted-foreground" data-testid="kpt-count">
        已回覆：{state.entries.length} 人
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-3">
          {(["keep", "problem", "try"] as KptCategory[]).map((cat) => {
            const style = COLUMN_STYLE[cat];
            const value = cat === "keep" ? keep : cat === "problem" ? problem : tryText;
            const setter = cat === "keep" ? setKeep : cat === "problem" ? setProblem : setTryText;
            const label = cat === "keep" ? cfg.keepLabel : cat === "problem" ? cfg.problemLabel : cfg.tryLabel;
            return (
              <div key={cat} className={`rounded-xl border ${style.border} ${style.bg} p-3`}>
                <p className="text-sm font-semibold mb-2">
                  {style.emoji} {label}
                </p>
                <Textarea
                  placeholder={`輸入 ${label}...`}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  rows={2}
                  maxLength={150}
                  data-testid={`kpt-${cat}-input`}
                />
              </div>
            );
          })}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            data-testid="kpt-submit-btn"
          >
            提交回顧
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl bg-gray-50 border text-sm flex flex-col gap-1" data-testid="kpt-my-entry">
          {myEntry.keep && <p><span className="font-semibold text-emerald-600">✅ Keep：</span>{myEntry.keep}</p>}
          {myEntry.problem && <p><span className="font-semibold text-red-600">⚠️ Problem：</span>{myEntry.problem}</p>}
          {myEntry.try && <p><span className="font-semibold text-blue-600">💡 Try：</span>{myEntry.try}</p>}
        </div>
      )}

      {state.revealed ? (
        <div className="grid grid-cols-3 gap-3" data-testid="kpt-result">
          {(["keep", "problem", "try"] as KptCategory[]).map((cat) => {
            const style = COLUMN_STYLE[cat];
            const label = cat === "keep" ? cfg.keepLabel : cat === "problem" ? cfg.problemLabel : cfg.tryLabel;
            const items = state.entries.filter((e) => e[cat]);
            return (
              <div key={cat} className={`rounded-xl border ${style.border} ${style.bg} p-3 flex flex-col gap-2`} data-testid={`kpt-col-${cat}`}>
                <p className="text-xs font-bold text-center">{style.emoji} {label}</p>
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
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="kpt-reveal-btn">
            公布回顧結果
          </Button>
        )
      )}
    </div>
  );
}

export default KptRetro;
