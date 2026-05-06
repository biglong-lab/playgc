import { useState } from "react";
import { Loader2, CheckSquare } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface CommitEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  commitment: string;
}

interface MicroCommitState extends Record<string, unknown> {
  commits: CommitEntry[];
  revealed: boolean;
}

interface MicroCommitConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): MicroCommitConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MicroCommit({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<MicroCommitState>({
    gameId,
    sessionId,
    pageId,
    type: "micro_commit",
    defaultState: { commits: [], revealed: false },
  });

  const [commitment, setCommitment] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="mco-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const commits = state.commits as CommitEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = commits.find((c) => c.userId === userId);
  const canSubmit = commitment.trim().length >= 3;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entryId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      commits: [...commits, { entryId, userId, userName, commitment: commitment.trim() }],
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="mco-title" className="text-xl font-bold text-center">
        {cfg.title ?? "微型承諾"}
      </div>
      <div data-testid="mco-prompt" className="text-sm text-center text-muted-foreground">
        {cfg.prompt ?? "結束後，你要採取的一個最小行動是什麼？"}
      </div>
      <div data-testid="mco-count" className="text-xs text-center text-muted-foreground">
        已有 {commits.length} 人承諾
      </div>

      {!myEntry && (
        <div data-testid="mco-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <input
            data-testid="mco-commit-input"
            type="text"
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            placeholder="我承諾……（至少 3 字）"
            maxLength={60}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
          <div className="text-xs text-right text-muted-foreground">{commitment.length}/60</div>
          <button
            data-testid="mco-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-teal-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <CheckSquare className="w-4 h-4" />
            立下承諾
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="mco-my-entry" className="bg-teal-50 rounded-xl p-4 border border-teal-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckSquare className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-semibold text-teal-700">你的承諾已記錄</span>
          </div>
          <p className="text-sm text-gray-700 font-medium">{myEntry.commitment}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="mco-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-teal-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <CheckSquare className="w-4 h-4" />
          揭曉全隊承諾
        </button>
      )}

      {revealed && commits.length === 0 && (
        <div data-testid="mco-empty" className="text-center text-muted-foreground p-8">
          還沒有人立下承諾
        </div>
      )}

      {revealed && commits.length > 0 && (
        <div data-testid="mco-result" className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-center text-teal-700">
            ✅ 全隊承諾牆（{commits.length} 人）
          </div>
          {commits.map((c) => (
            <div
              key={c.entryId}
              data-testid={`mco-card-${c.entryId}`}
              className="flex items-start gap-3 bg-teal-50 rounded-xl p-3 border border-teal-100"
            >
              <CheckSquare className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">{c.commitment}</p>
                <div className="text-xs text-teal-600 mt-0.5">{c.userName}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
