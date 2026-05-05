import { useMemo } from "react";
import { Button } from "@/components/ui/button";

export interface DebateVoteConfig {
  title: string;
  topic: string;
  proLabel: string;
  conLabel: string;
  proEmoji?: string;
  conEmoji?: string;
  showVoterCount: boolean;
  allowSwitch: boolean;
}

export interface DebateVoteEntry {
  userId: string;
  userName: string;
  side: "pro" | "con";
  votedAt: number;
  switchCount: number;
}

export interface DebateVoteState extends Record<string, unknown> {
  votes: DebateVoteEntry[];
}

interface Props {
  config: DebateVoteConfig;
  state: DebateVoteState;
  myUserId: string;
  onVote: (side: "pro" | "con") => void;
}

export default function DebateVote({ config, state, myUserId, onVote }: Props) {
  const {
    title,
    topic,
    proLabel,
    conLabel,
    proEmoji = "👍",
    conEmoji = "👎",
    showVoterCount,
    allowSwitch,
  } = config;

  const { votes } = state;

  const myVote = votes.find((v) => v.userId === myUserId);
  const mySide = myVote?.side;

  const proCount = useMemo(() => votes.filter((v) => v.side === "pro").length, [votes]);
  const conCount = useMemo(() => votes.filter((v) => v.side === "con").length, [votes]);
  const total = proCount + conCount;

  const proPct = total === 0 ? 50 : Math.round((proCount / total) * 100);
  const conPct = 100 - proPct;

  const canVotePro = !mySide || (allowSwitch && mySide !== "pro");
  const canVoteCon = !mySide || (allowSwitch && mySide !== "con");

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex flex-col items-center px-4 py-8 gap-6"
      data-testid="debate-vote-root"
    >
      {/* Header */}
      <div className="text-center max-w-lg">
        <h1 className="text-xl font-bold text-gray-300" data-testid="debate-title">{title}</h1>
        <p className="text-2xl font-bold mt-3 leading-snug" data-testid="debate-topic">
          {topic}
        </p>
      </div>

      {/* Live Bar */}
      <div className="w-full max-w-md">
        <div className="flex h-10 rounded-full overflow-hidden">
          <div
            className="bg-blue-500 transition-all duration-700 flex items-center justify-end pr-2"
            style={{ width: `${proPct}%` }}
            data-testid="pro-bar"
          >
            {proPct >= 20 && (
              <span className="text-sm font-bold" data-testid="pro-pct">{proPct}%</span>
            )}
          </div>
          <div
            className="bg-red-500 transition-all duration-700 flex items-center justify-start pl-2"
            style={{ width: `${conPct}%` }}
            data-testid="con-bar"
          >
            {conPct >= 20 && (
              <span className="text-sm font-bold" data-testid="con-pct">{conPct}%</span>
            )}
          </div>
        </div>
        {showVoterCount && (
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span data-testid="pro-count">{proCount} 人</span>
            <span className="text-gray-500" data-testid="total-count">{total} 位參與</span>
            <span data-testid="con-count">{conCount} 人</span>
          </div>
        )}
      </div>

      {/* Vote Buttons */}
      <div className="flex gap-4 w-full max-w-md">
        <Button
          onClick={() => onVote("pro")}
          disabled={!canVotePro}
          className={`flex-1 h-24 text-lg font-bold rounded-2xl flex flex-col items-center gap-1 transition-all
            ${mySide === "pro"
              ? "bg-blue-500 text-white ring-4 ring-blue-300 scale-105"
              : "bg-blue-900 hover:bg-blue-700 text-blue-200"
            }`}
          data-testid="pro-btn"
        >
          <span className="text-3xl">{proEmoji}</span>
          <span>{proLabel}</span>
        </Button>
        <Button
          onClick={() => onVote("con")}
          disabled={!canVoteCon}
          className={`flex-1 h-24 text-lg font-bold rounded-2xl flex flex-col items-center gap-1 transition-all
            ${mySide === "con"
              ? "bg-red-500 text-white ring-4 ring-red-300 scale-105"
              : "bg-red-900 hover:bg-red-700 text-red-200"
            }`}
          data-testid="con-btn"
        >
          <span className="text-3xl">{conEmoji}</span>
          <span>{conLabel}</span>
        </Button>
      </div>

      {/* My Status */}
      {mySide && (
        <div className="text-sm text-gray-300" data-testid="my-vote-status">
          你支持：
          <span className={`font-bold ml-1 ${mySide === "pro" ? "text-blue-400" : "text-red-400"}`}>
            {mySide === "pro" ? proLabel : conLabel}
          </span>
          {allowSwitch && (
            <span className="text-gray-500 ml-2">（可換邊）</span>
          )}
          {myVote && myVote.switchCount > 0 && (
            <span className="text-gray-500 ml-2" data-testid="switch-count">已換邊 {myVote.switchCount} 次</span>
          )}
        </div>
      )}

      {!mySide && (
        <p className="text-gray-400 text-sm" data-testid="no-vote-msg">選擇你支持的立場</p>
      )}

      {/* Recent Voters */}
      {votes.length > 0 && (
        <div className="w-full max-w-md">
          <p className="text-xs text-gray-500 mb-2">最新表態</p>
          <div className="flex flex-wrap gap-2" data-testid="voter-list">
            {[...votes]
              .sort((a, b) => b.votedAt - a.votedAt)
              .slice(0, 8)
              .map((v) => (
                <span
                  key={v.userId}
                  className={`text-xs px-2 py-1 rounded-full ${
                    v.side === "pro"
                      ? "bg-blue-900 text-blue-300"
                      : "bg-red-900 text-red-300"
                  }`}
                  data-testid={`voter-${v.userId}`}
                >
                  {v.userId === myUserId ? "我" : v.userName}
                  {" "}
                  {v.side === "pro" ? proEmoji : conEmoji}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
