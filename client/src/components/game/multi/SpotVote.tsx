import { useState } from "react";
import { Loader2, MapPin, ThumbsUp } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SpotVoteEntry extends Record<string, unknown> {
  userId: string;
  userName: string;
  spotId: string;
}

interface SpotVoteState extends Record<string, unknown> {
  votes: SpotVoteEntry[];
  revealed: boolean;
}

interface SpotVoteConfig {
  title?: string;
  prompt?: string;
  spots?: SpotItem[];
}

interface SpotItem {
  id: string;
  name: string;
  emoji?: string;
  desc?: string;
}

const DEFAULT_SPOTS: SpotItem[] = [
  { id: "beach", name: "海灘", emoji: "🏖️", desc: "藍天碧海放鬆心情" },
  { id: "mountain", name: "山林", emoji: "⛰️", desc: "森林步道清新空氣" },
  { id: "city", name: "城市", emoji: "🏙️", desc: "繁華街頭文化體驗" },
  { id: "hot_spring", name: "溫泉", emoji: "♨️", desc: "泡湯放鬆舒緩壓力" },
  { id: "temple", name: "古廟", emoji: "⛩️", desc: "歷史文化深度之旅" },
  { id: "market", name: "夜市", emoji: "🏮", desc: "美食小吃熱鬧非凡" },
];

function extractConfig(raw: Record<string, unknown>): SpotVoteConfig {
  const spots = Array.isArray(raw.spots)
    ? (raw.spots as SpotItem[])
    : undefined;
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
    spots,
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SpotVote({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const spots = cfg.spots ?? DEFAULT_SPOTS;
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SpotVoteState>({
    gameId,
    sessionId,
    pageId,
    type: "spot_vote",
    defaultState: { votes: [], revealed: false },
  });

  const [selected, setSelected] = useState<string>("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="spv-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const votes = state.votes as SpotVoteEntry[];
  const revealed = state.revealed as boolean;
  const myVote = votes.find((v) => v.userId === userId);

  const handleVote = () => {
    if (!selected || myVote) return;
    const entry: SpotVoteEntry = { userId, userName, spotId: selected };
    updateState({ ...state, votes: [...votes, entry] });
    setSelected("");
  };

  const spotCounts = votes.reduce<Record<string, number>>((acc, v) => {
    acc[v.spotId] = (acc[v.spotId] ?? 0) + 1;
    return acc;
  }, {});

  const topSpot = revealed && votes.length > 0
    ? Object.entries(spotCounts).sort(([, a], [, b]) => b - a)[0]
    : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="spv-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我最想去的景點"}
      </div>
      <div data-testid="spv-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果隊伍要一起去一個地方，你選哪裡？"}
      </div>
      <div data-testid="spv-count" className="text-xs text-center text-muted-foreground">
        已投票 {votes.length} 人
      </div>

      {!myVote && (
        <div data-testid="spv-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-2">
            {spots.map((spot) => (
              <button
                key={spot.id}
                data-testid={`spv-spot-${spot.id}`}
                onClick={() => setSelected(spot.id)}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm transition-all ${
                  selected === spot.id
                    ? "border-blue-500 bg-blue-50 font-semibold"
                    : "hover:border-blue-400"
                }`}
              >
                {spot.emoji && <span className="text-2xl">{spot.emoji}</span>}
                <span className="font-medium">{spot.name}</span>
                {spot.desc && (
                  <span className="text-muted-foreground text-[10px] text-center">{spot.desc}</span>
                )}
              </button>
            ))}
          </div>
          <button
            data-testid="spv-submit-btn"
            disabled={!selected}
            onClick={handleVote}
            className="bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            投票！
          </button>
        </div>
      )}

      {myVote && (
        <div data-testid="spv-my-vote" className="bg-blue-50 rounded-xl p-3 border border-blue-200">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold">
              {spots.find((s) => s.id === myVote.spotId)?.emoji}{" "}
              {spots.find((s) => s.id === myVote.spotId)?.name}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">已投票</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="spv-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-blue-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉最受歡迎景點
        </button>
      )}

      {revealed && votes.length === 0 && (
        <div data-testid="spv-empty" className="text-center text-muted-foreground p-8">
          還沒有人投票
        </div>
      )}

      {revealed && votes.length > 0 && (
        <div data-testid="spv-result" className="flex flex-col gap-3">
          {topSpot && (
            <div data-testid="spv-winner" className="flex items-center gap-2 bg-amber-50 rounded-xl p-3 border border-amber-200">
              <ThumbsUp className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-bold text-amber-700">
                隊伍最愛：
                {spots.find((s) => s.id === topSpot[0])?.emoji}{" "}
                {spots.find((s) => s.id === topSpot[0])?.name}
                （{topSpot[1]} 票）
              </span>
            </div>
          )}
          <div data-testid="spv-bar-list" className="flex flex-col gap-2">
            {spots
              .filter((s) => spotCounts[s.id] > 0)
              .sort((a, b) => (spotCounts[b.id] ?? 0) - (spotCounts[a.id] ?? 0))
              .map((spot) => {
                const cnt = spotCounts[spot.id] ?? 0;
                const pct = Math.round((cnt / votes.length) * 100);
                return (
                  <div key={spot.id} data-testid={`spv-bar-${spot.id}`} className="flex items-center gap-2">
                    <span className="text-lg w-7">{spot.emoji}</span>
                    <span className="text-xs w-16 truncate">{spot.name}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                      {cnt}票
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
