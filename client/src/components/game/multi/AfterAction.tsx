import { useState } from "react";
import { Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface AarEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  wentWell: string;
  wentWrong: string;
  lessons: string;
}

interface AfterActionState extends Record<string, unknown> {
  entries: AarEntry[];
  revealed: boolean;
}

interface AfterActionConfig {
  title?: string;
  prompt?: string;
  wellLabel?: string;
  wrongLabel?: string;
  lessonsLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): AfterActionConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "事後覆盤",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "這次行動，哪些做對了？哪些出了問題？學到了什麼？",
    wellLabel: typeof raw.wellLabel === "string" ? raw.wellLabel : "✅ 做得好的",
    wrongLabel: typeof raw.wrongLabel === "string" ? raw.wrongLabel : "❌ 出了問題的",
    lessonsLabel: typeof raw.lessonsLabel === "string" ? raw.lessonsLabel : "💡 學到的教訓",
  };
}

const COLUMN_STYLE = {
  well: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", header: "✅ 做得好" },
  wrong: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", header: "❌ 出了問題" },
  lessons: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", header: "💡 學到的教訓" },
};

export interface AfterActionProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function AfterAction({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: AfterActionProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<AfterActionState>({
    gameId,
    sessionId,
    pageId,
    type: "after_action",
    defaultState: { entries: [], revealed: false },
  });

  const [wentWell, setWentWell] = useState("");
  const [wentWrong, setWentWrong] = useState("");
  const [lessons, setLessons] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="aa-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = wentWell.trim() || wentWrong.trim() || lessons.trim();

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: AarEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      wentWell: wentWell.trim(),
      wentWrong: wentWrong.trim(),
      lessons: lessons.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setWentWell("");
    setWentWrong("");
    setLessons("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const wellItems = state.entries.filter((e) => e.wentWell);
  const wrongItems = state.entries.filter((e) => e.wentWrong);
  const lessonItems = state.entries.filter((e) => e.lessons);

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <Target className="w-6 h-6 text-blue-500" />
        <h2 className="text-xl font-bold" data-testid="aa-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="aa-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="aa-count">
        已提交：{state.entries.length} 份
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder={cfg.wellLabel}
            value={wentWell}
            onChange={(e) => setWentWell(e.target.value)}
            maxLength={60}
            data-testid="aa-well-input"
          />
          <Input
            placeholder={cfg.wrongLabel}
            value={wentWrong}
            onChange={(e) => setWentWrong(e.target.value)}
            maxLength={60}
            data-testid="aa-wrong-input"
          />
          <Input
            placeholder={cfg.lessonsLabel}
            value={lessons}
            onChange={(e) => setLessons(e.target.value)}
            maxLength={60}
            data-testid="aa-lessons-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            data-testid="aa-submit-btn"
          >
            提交覆盤
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 text-sm" data-testid="aa-my-entry">
          {myEntry.wentWell && <p className="text-green-700 font-medium">✅ {myEntry.wentWell}</p>}
          {myEntry.wentWrong && <p className="text-red-700 font-medium mt-1">❌ {myEntry.wentWrong}</p>}
          {myEntry.lessons && <p className="text-blue-700 font-medium mt-1">💡 {myEntry.lessons}</p>}
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-4" data-testid="aa-result">
          {(["well", "wrong", "lessons"] as const).map((col) => {
            const c = COLUMN_STYLE[col];
            const items = col === "well" ? wellItems : col === "wrong" ? wrongItems : lessonItems;
            const key = col === "well" ? "wentWell" : col === "wrong" ? "wentWrong" : "lessons";
            return (
              <div key={col} data-testid={`aa-col-${col}`} className={`rounded-xl border ${c.border} ${c.bg} p-3`}>
                <p className={`text-sm font-bold mb-2 ${c.text}`}>
                  {c.header}（{items.length} 則）
                </p>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">無</p>
                ) : (
                  items.map((e) => (
                    <div key={`${e.entryId}-${col}`} data-testid={`aa-item-${e.entryId}-${col}`} className="text-xs bg-white rounded border p-2 mb-1">
                      <p className="text-muted-foreground font-medium">{e.userName}</p>
                      <p className="font-semibold">{e[key] as string}</p>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="aa-reveal-btn">
            展示事後覆盤
          </Button>
        )
      )}
    </div>
  );
}

export default AfterAction;
