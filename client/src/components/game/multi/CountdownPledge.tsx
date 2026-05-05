import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface PledgeEntry extends Record<string, unknown> {
  pledgeId: string;
  userId: string;
  userName: string;
  commitment: string;
}

export interface CompletionEntry extends Record<string, unknown> {
  compId: string;
  userId: string;
  userName: string;
  completedAt: number;
}

export interface CountdownPledgeConfig extends Record<string, unknown> {
  title: string;
  challengeText: string;
  durationMinutes: number;
  pledgePrompt: string;
}

export interface CountdownPledgeState extends Record<string, unknown> {
  pledges: PledgeEntry[];
  startedAt: number | null;
  completions: CompletionEntry[];
}

function extractConfig(raw: Record<string, unknown>): CountdownPledgeConfig {
  return {
    title: (raw.title as string) || "倒數承諾挑戰",
    challengeText: (raw.challengeText as string) || "完成你的承諾！",
    durationMinutes: (raw.durationMinutes as number) ?? 5,
    pledgePrompt: (raw.pledgePrompt as string) || "我承諾...",
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function CountdownPledge({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: CountdownPledgeState = { pledges: [], startedAt: null, completions: [] };
  const { state, updateState, isLoaded } = useTeamPagePersistence<CountdownPledgeState>({
    gameId,
    sessionId,
    pageId,
    type: "countdown_pledge",
    defaultState,
  });

  const [commitment, setCommitment] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="cp-loading" />
      </div>
    );
  }

  const durationMs = cfg.durationMinutes * 60 * 1000;
  const isRunning = state.startedAt !== null;
  const elapsed = isRunning ? now - (state.startedAt as number) : 0;
  const remaining = Math.max(0, durationMs - elapsed);
  const isExpired = isRunning && remaining === 0;

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const timeLabel = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const myPledge = state.pledges.find((p) => p.userId === userId);
  const myCompletion = state.completions.find((c) => c.userId === userId);

  function handlePledge() {
    if (!commitment.trim() || myPledge) return;
    const pledgeId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      pledges: [...state.pledges, { pledgeId, userId, userName, commitment: commitment.trim() }],
    });
    setCommitment("");
  }

  function handleStart() {
    updateState({ ...state, startedAt: Date.now() });
  }

  function handleComplete() {
    if (myCompletion) return;
    const compId = `${userId}-comp-${Date.now()}`;
    updateState({
      ...state,
      completions: [...state.completions, { compId, userId, userName, completedAt: Date.now() }],
    });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="cp-title">{cfg.title}</h2>
      <p className="text-gray-700 font-medium" data-testid="cp-challenge">{cfg.challengeText}</p>

      {!myPledge && !isRunning && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{cfg.pledgePrompt}</p>
          <textarea
            className="w-full border rounded px-3 py-2 h-20"
            placeholder="寫下你的承諾..."
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            data-testid="cp-input"
            maxLength={200}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={!commitment.trim()}
            onClick={handlePledge}
            data-testid="cp-pledge-btn"
          >
            提交承諾
          </button>
        </div>
      )}

      {myPledge && (
        <div className="p-3 bg-blue-50 rounded" data-testid="cp-my-pledge">
          <p className="text-sm text-blue-800">我的承諾：{myPledge.commitment}</p>
        </div>
      )}

      <p className="text-sm text-gray-500" data-testid="cp-pledge-count">
        承諾數：{state.pledges.length}
      </p>

      {isTeamLead && !isRunning && (
        <button
          className="px-4 py-2 bg-orange-500 text-white rounded"
          onClick={handleStart}
          data-testid="cp-start-btn"
        >
          開始倒數 ({cfg.durationMinutes} 分鐘)
        </button>
      )}

      {isRunning && (
        <div className="text-center p-4 bg-gray-50 rounded" data-testid="cp-timer-section">
          <p className={`text-4xl font-mono font-bold ${isExpired ? "text-red-500" : "text-green-600"}`}
            data-testid="cp-timer">
            {isExpired ? "時間到！" : timeLabel}
          </p>
          {!myCompletion && !isExpired && (
            <button
              className="mt-3 px-6 py-2 bg-green-600 text-white rounded-full font-semibold"
              onClick={handleComplete}
              data-testid="cp-done-btn"
            >
              ✅ 完成！
            </button>
          )}
          {myCompletion && (
            <p className="mt-2 text-green-700 font-semibold" data-testid="cp-my-completion">
              你已完成！🎉
            </p>
          )}
        </div>
      )}

      {state.completions.length > 0 && (
        <div data-testid="cp-completions">
          <p className="font-semibold text-sm mb-1">完成名單（{state.completions.length}/{state.pledges.length}）：</p>
          {state.completions.map((c) => (
            <div key={c.compId} className="text-sm text-green-700" data-testid={`cp-comp-${c.compId}`}>
              ✅ {c.userName}
            </div>
          ))}
        </div>
      )}

      {state.pledges.length > 0 && (
        <div data-testid="cp-pledge-list">
          <p className="font-semibold text-sm mb-1">所有承諾：</p>
          {state.pledges.map((p) => (
            <div key={p.pledgeId} className="text-sm text-gray-700 py-1 border-b" data-testid={`cp-pledge-${p.pledgeId}`}>
              <span className="font-medium">{p.userName}</span>：{p.commitment}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CountdownPledge;
