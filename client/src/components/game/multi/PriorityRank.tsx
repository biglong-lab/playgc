import { CheckCircle2, ChevronUp, ChevronDown, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PriorityRankConfig {
  title: string;
  question: string;
  items: { id: string; label: string; emoji?: string }[];
  showConsensus: boolean;
}

export interface UserRanking {
  userId: string;
  userName: string;
  ranks: string[];
  submittedAt: number;
}

export interface PriorityRankState extends Record<string, unknown> {
  rankings: UserRanking[];
}

interface ConsensusItem {
  id: string;
  label: string;
  emoji?: string;
  avgPosition: number;
  score: number;
}

function calcConsensus(items: PriorityRankConfig["items"], rankings: UserRanking[]): ConsensusItem[] {
  const n = items.length;
  const scores: Record<string, number> = {};
  items.forEach((item) => { scores[item.id] = 0; });

  for (const r of rankings) {
    r.ranks.forEach((id, idx) => {
      scores[id] = (scores[id] ?? 0) + (n - idx);
    });
  }

  const total = rankings.length;
  return items
    .map((item) => ({
      ...item,
      score: scores[item.id] ?? 0,
      avgPosition: total > 0 ? n - (scores[item.id] ?? 0) / total : (items.indexOf(item) + 1),
    }))
    .sort((a, b) => b.score - a.score);
}

interface Props {
  config: PriorityRankConfig;
  state: PriorityRankState;
  myUserId: string;
  localRanks: string[];
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onSubmit: () => void;
}

export default function PriorityRank({
  config,
  state,
  myUserId,
  localRanks,
  onMoveUp,
  onMoveDown,
  onSubmit,
}: Props) {
  const { title, question, items, showConsensus } = config;
  const { rankings } = state;

  const myRanking = rankings.find((r) => r.userId === myUserId);
  const hasSubmitted = Boolean(myRanking);
  const respondentCount = rankings.length;

  const orderedItems = localRanks
    .map((id) => items.find((item) => item.id === id))
    .filter(Boolean) as PriorityRankConfig["items"];

  const consensus = showConsensus && respondentCount > 0 ? calcConsensus(items, rankings) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-50 flex flex-col px-4 py-6 gap-5" data-testid="priority-rank-root">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800" data-testid="pr-title">{title}</h1>
        <p className="text-gray-500 text-sm mt-1" data-testid="pr-question">{question}</p>
      </div>

      {!hasSubmitted ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-400 text-center">拖曳或點擊箭頭調整順序，1 = 最重要</p>
          {orderedItems.map((item, idx) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-sm border border-purple-100 flex items-center gap-3 px-4 py-3"
              data-testid={`pr-item-${item.id}`}
            >
              <span className="text-lg font-bold text-purple-400 w-6 text-center" data-testid={`pr-rank-${item.id}`}>
                {idx + 1}
              </span>
              {item.emoji && <span className="text-xl">{item.emoji}</span>}
              <span className="flex-1 text-gray-700 font-medium" data-testid={`pr-label-${item.id}`}>
                {item.label}
              </span>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => onMoveUp(idx)}
                  disabled={idx === 0}
                  className="p-1 text-gray-400 hover:text-purple-600 disabled:opacity-30"
                  data-testid={`pr-up-${item.id}`}
                  aria-label={`${item.label} 上移`}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onMoveDown(idx)}
                  disabled={idx === orderedItems.length - 1}
                  className="p-1 text-gray-400 hover:text-purple-600 disabled:opacity-30"
                  data-testid={`pr-down-${item.id}`}
                  aria-label={`${item.label} 下移`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <Button
            onClick={onSubmit}
            className="bg-violet-600 hover:bg-violet-700 text-white mt-2"
            data-testid="pr-submit-btn"
          >
            確認提交排名
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow p-5 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="font-medium text-gray-700" data-testid="pr-submitted-msg">已提交排名</p>
          <p className="text-sm text-gray-400 mt-1">等待其他人完成…</p>
        </div>
      )}

      <div className="bg-white rounded-xl p-3 text-center text-sm text-gray-500" data-testid="pr-count">
        已回應 <span className="font-semibold text-violet-600">{respondentCount}</span> 人
      </div>

      {consensus && (
        <div className="bg-white rounded-2xl shadow p-5" data-testid="pr-consensus">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h2 className="font-semibold text-gray-700">群體共識排名</h2>
          </div>
          {consensus.map((item, idx) => {
            const maxScore = consensus[0].score;
            const pct = maxScore > 0 ? Math.round((item.score / maxScore) * 100) : 0;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 mb-3"
                data-testid={`pr-consensus-${item.id}`}
              >
                <span className="w-6 text-center font-bold text-violet-500">{idx + 1}</span>
                {item.emoji && <span>{item.emoji}</span>}
                <span className="flex-1 text-sm text-gray-700">{item.label}</span>
                <div className="w-24 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-violet-500 h-2 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                    data-testid={`pr-bar-${item.id}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
