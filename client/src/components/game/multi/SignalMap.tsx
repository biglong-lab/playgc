import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface SignalVote extends Record<string, unknown> {
  voteId: string;
  userId: string;
  userName: string;
  signal: "green" | "yellow" | "red";
  comment: string;
}

export interface SignalMapConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  greenLabel: string;
  yellowLabel: string;
  redLabel: string;
}

export interface SignalMapState extends Record<string, unknown> {
  votes: SignalVote[];
  revealed: boolean;
}

function extractConfig(raw: Record<string, unknown>): SignalMapConfig {
  return {
    title: (raw.title as string) || "交通燈狀態確認",
    prompt: (raw.prompt as string) || "你對這件事的準備程度是？",
    greenLabel: (raw.greenLabel as string) || "準備好了 🟢",
    yellowLabel: (raw.yellowLabel as string) || "還需要確認 🟡",
    redLabel: (raw.redLabel as string) || "還沒準備好 🔴",
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SignalMap({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: SignalMapState = { votes: [], revealed: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<SignalMapState>({
    gameId,
    sessionId,
    pageId,
    type: "signal_map",
    defaultState,
  });

  const [selected, setSelected] = useState<"green" | "yellow" | "red" | null>(null);
  const [comment, setComment] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="sig-loading" />
      </div>
    );
  }

  const myVote = state.votes.find((v) => v.userId === userId);

  function handleSubmit() {
    if (!selected || myVote) return;
    const voteId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      votes: [...state.votes, { voteId, userId, userName, signal: selected, comment: comment.trim() }],
    });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const countFor = (sig: "green" | "yellow" | "red") =>
    state.votes.filter((v) => v.signal === sig).length;

  const signalConfig = [
    { key: "green" as const, label: cfg.greenLabel, bg: "bg-green-500", light: "bg-green-50 border-green-300", testId: "sig-green-btn" },
    { key: "yellow" as const, label: cfg.yellowLabel, bg: "bg-yellow-400", light: "bg-yellow-50 border-yellow-300", testId: "sig-yellow-btn" },
    { key: "red" as const, label: cfg.redLabel, bg: "bg-red-500", light: "bg-red-50 border-red-300", testId: "sig-red-btn" },
  ];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="sig-title">{cfg.title}</h2>
      <p className="text-gray-600" data-testid="sig-prompt">{cfg.prompt}</p>
      <p className="text-sm text-gray-500" data-testid="sig-count">已回應：{state.votes.length} 人</p>

      {!myVote && !state.revealed && (
        <div className="space-y-3">
          <div className="flex gap-3">
            {signalConfig.map(({ key, label, bg, testId }) => (
              <button
                key={key}
                className={`flex-1 py-3 rounded-xl text-white font-bold text-sm transition-all ${bg} ${selected === key ? "ring-4 ring-offset-2 ring-gray-400 scale-105" : "opacity-80 hover:opacity-100"}`}
                onClick={() => setSelected(key)}
                data-testid={testId}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="補充說明（選填）..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            data-testid="sig-comment-input"
            maxLength={100}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={!selected}
            onClick={handleSubmit}
            data-testid="sig-submit-btn"
          >
            提交
          </button>
        </div>
      )}

      {myVote && (
        <div
          className={`p-3 rounded border ${
            myVote.signal === "green"
              ? "bg-green-50 border-green-300"
              : myVote.signal === "yellow"
              ? "bg-yellow-50 border-yellow-300"
              : "bg-red-50 border-red-300"
          }`}
          data-testid="sig-my-vote"
        >
          <p className="text-sm font-medium">
            已選擇：{myVote.signal === "green" ? cfg.greenLabel : myVote.signal === "yellow" ? cfg.yellowLabel : cfg.redLabel}
          </p>
          {myVote.comment && <p className="text-xs text-gray-600 mt-1">{myVote.comment}</p>}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={handleReveal}
          data-testid="sig-reveal-btn"
        >
          公開結果
        </button>
      )}

      {state.revealed && (
        <div data-testid="sig-result">
          <h3 className="font-semibold mb-3">結果分佈</h3>
          <div className="flex gap-3 mb-4">
            {signalConfig.map(({ key, label, bg }) => (
              <div key={key} className={`flex-1 rounded-xl p-3 text-center text-white ${bg}`} data-testid={`sig-${key}-count`}>
                <p className="text-2xl font-bold">{countFor(key)}</p>
                <p className="text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>

          {signalConfig.map(({ key, label, light }) => {
            const votersOfType = state.votes.filter((v) => v.signal === key);
            if (votersOfType.length === 0) return null;
            return (
              <div key={key} className="mb-3" data-testid={`sig-votes-${key}`}>
                <p className="text-sm font-semibold mb-1">{label}：</p>
                {votersOfType.map((v) => (
                  <div key={v.voteId} className={`text-xs rounded px-2 py-1 mb-1 border ${light}`}>
                    <span className="font-medium">{v.userName}</span>
                    {v.comment && <span className="text-gray-600">：{v.comment}</span>}
                  </div>
                ))}
              </div>
            );
          })}

          {state.votes.length === 0 && (
            <p className="text-gray-400 text-center py-4" data-testid="sig-empty">尚無投票</p>
          )}
        </div>
      )}
    </div>
  );
}

export default SignalMap;
