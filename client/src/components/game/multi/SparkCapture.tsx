import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SparkEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  spark: string;
}

interface SparkCaptureState extends Record<string, unknown> {
  sparks: SparkEntry[];
  revealed: boolean;
}

interface SparkCaptureConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): SparkCaptureConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const SPARK_COLORS = [
  "from-yellow-50 to-orange-50 border-yellow-200",
  "from-pink-50 to-rose-50 border-pink-200",
  "from-purple-50 to-indigo-50 border-purple-200",
  "from-cyan-50 to-blue-50 border-cyan-200",
  "from-green-50 to-teal-50 border-green-200",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SparkCapture({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SparkCaptureState>({
    gameId,
    sessionId,
    pageId,
    type: "spark_capture",
    defaultState: { sparks: [], revealed: false },
  });

  const [spark, setSpark] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="spc-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const sparks = state.sparks as SparkEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = sparks.find((s) => s.userId === userId);
  const canSubmit = spark.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entryId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      sparks: [...sparks, { entryId, userId, userName, spark: spark.trim() }],
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="spc-title" className="text-xl font-bold text-center">
        {cfg.title ?? "捕捉火花"}
      </div>
      <div data-testid="spc-prompt" className="text-sm text-center text-muted-foreground">
        {cfg.prompt ?? "這次活動中，讓你最有感觸的一刻是什麼？"}
      </div>
      <div data-testid="spc-count" className="text-xs text-center text-muted-foreground">
        已有 {sparks.length} 人分享
      </div>

      {!myEntry && (
        <div data-testid="spc-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <textarea
            data-testid="spc-spark-input"
            value={spark}
            onChange={(e) => setSpark(e.target.value)}
            placeholder="寫下你的火花瞬間（至少 5 字）"
            maxLength={100}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
          />
          <div className="text-xs text-right text-muted-foreground">{spark.length}/100</div>
          <button
            data-testid="spc-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-yellow-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            捕捉這個火花
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="spc-my-entry" className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-semibold text-yellow-700">你的火花已捕捉</span>
          </div>
          <p className="text-sm text-gray-700">{myEntry.spark}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="spc-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-yellow-500 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          點亮所有火花
        </button>
      )}

      {revealed && sparks.length === 0 && (
        <div data-testid="spc-empty" className="text-center text-muted-foreground p-8">
          還沒有人分享火花
        </div>
      )}

      {revealed && sparks.length > 0 && (
        <div data-testid="spc-result" className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-center text-yellow-700">
            ⚡ 全隊火花牆（{sparks.length} 個）
          </div>
          {sparks.map((s, idx) => (
            <div
              key={s.entryId}
              data-testid={`spc-card-${s.entryId}`}
              className={`bg-gradient-to-r ${SPARK_COLORS[idx % SPARK_COLORS.length]} rounded-xl p-3 border`}
            >
              <div className="text-xs font-medium text-muted-foreground mb-1">⚡ {s.userName}</div>
              <p className="text-sm text-gray-800">{s.spark}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
