import { useState } from "react";
import { Loader2, Shield } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SafetyEntry extends Record<string, unknown> {
  userId: string;
  userName: string;
  level: number;
  note: string;
}

interface SafetyLevelState extends Record<string, unknown> {
  entries: SafetyEntry[];
  revealed: boolean;
}

interface SafetyLevelConfig {
  title?: string;
  question?: string;
}

function extractConfig(raw: Record<string, unknown>): SafetyLevelConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    question: typeof raw.question === "string" ? raw.question : undefined,
  };
}

const LEVEL_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "非常不安全", color: "text-red-600", bg: "bg-red-100 border-red-300" },
  2: { label: "有些緊張", color: "text-orange-600", bg: "bg-orange-100 border-orange-300" },
  3: { label: "普通", color: "text-yellow-600", bg: "bg-yellow-100 border-yellow-300" },
  4: { label: "還算舒適", color: "text-lime-600", bg: "bg-lime-100 border-lime-300" },
  5: { label: "非常安全", color: "text-green-600", bg: "bg-green-100 border-green-300" },
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SafetyLevel({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SafetyLevelState>({
    gameId,
    sessionId,
    pageId,
    type: "safety_level",
    defaultState: { entries: [], revealed: false },
  });

  const [level, setLevel] = useState(0);
  const [note, setNote] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="sfl-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const entries = state.entries as SafetyEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === userId);
  const canSubmit = level > 0;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    updateState({
      ...state,
      entries: [...entries, { userId, userName, level, note: note.trim() }],
    });
  };

  const avgLevel = entries.length > 0
    ? (entries.reduce((s, e) => s + (e.level as number), 0) / entries.length).toFixed(1)
    : null;

  const levelCount = (l: number) => entries.filter((e) => e.level === l).length;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="sfl-title" className="text-xl font-bold text-center">
        {cfg.title ?? "安全感指數"}
      </div>
      <div data-testid="sfl-question" className="text-sm text-center text-muted-foreground">
        {cfg.question ?? "在這個環境中，你現在的安全感是幾分？"}
      </div>
      <div data-testid="sfl-count" className="text-xs text-center text-muted-foreground">
        已有 {entries.length} 人回應
      </div>

      {!myEntry && (
        <div data-testid="sfl-form" className="flex flex-col gap-4 bg-card rounded-xl p-4 border">
          <div data-testid="sfl-scale" className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((l) => {
              const info = LEVEL_LABELS[l];
              return (
                <button
                  key={l}
                  data-testid={`sfl-btn-${l}`}
                  onClick={() => setLevel(l)}
                  className={`flex-1 py-3 rounded-xl border-2 font-bold text-lg transition-all ${
                    level === l ? `${info.bg} border-current ${info.color}` : "bg-muted border-muted-foreground/20 hover:bg-muted/80"
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
          {level > 0 && (
            <div data-testid="sfl-level-label" className={`text-center text-sm font-medium ${LEVEL_LABELS[level].color}`}>
              {LEVEL_LABELS[level].label}
            </div>
          )}
          <textarea
            data-testid="sfl-note-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="備註（選填）"
            maxLength={60}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
          />
          <button
            data-testid="sfl-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-green-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            送出評分
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="sfl-my-entry" className={`rounded-xl p-4 border ${LEVEL_LABELS[myEntry.level as number].bg}`}>
          <div className="text-sm font-semibold mb-1">你的安全感評分</div>
          <div className={`text-2xl font-bold ${LEVEL_LABELS[myEntry.level as number].color}`}>
            {myEntry.level} 分 — {LEVEL_LABELS[myEntry.level as number].label}
          </div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="sfl-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-green-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Shield className="w-4 h-4" />
          揭曉全隊安全感
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="sfl-empty" className="text-center text-muted-foreground p-8">
          還沒有人回應
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="sfl-result" className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-center text-green-700">
            全隊安全感結果（{entries.length} 人）
          </div>
          {avgLevel && (
            <div data-testid="sfl-avg" className="text-center text-2xl font-bold text-green-600">
              平均 {avgLevel} 分
            </div>
          )}
          {[5, 4, 3, 2, 1].map((l) => {
            const cnt = levelCount(l);
            const info = LEVEL_LABELS[l];
            return (
              <div key={l} data-testid={`sfl-bar-${l}`} className="flex items-center gap-2">
                <div className="w-6 text-xs font-bold text-center">{l}</div>
                <div className="w-16 text-xs text-muted-foreground">{info.label}</div>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${info.bg.replace("border-", "bg-").split(" ")[0]}`}
                    style={{ width: entries.length > 0 ? `${(cnt / entries.length) * 100}%` : "0%" }}
                  />
                </div>
                <div className="w-6 text-xs font-bold">{cnt}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
