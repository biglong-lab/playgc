import { useMemo } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LivePulseConfig {
  title: string;
  subtitle?: string;
  prompt?: string;
  maxLevel: number;
}

export interface TapEvent {
  userId: string;
  userName: string;
  count: number;
  lastAt: number;
}

export interface LivePulseState extends Record<string, unknown> {
  taps: TapEvent[];
  totalTaps: number;
}

interface Props {
  config: LivePulseConfig;
  state: LivePulseState;
  myUserId: string;
  onTap: () => void;
}

const MILESTONES = [50, 100, 200, 500, 1000];
const LEVEL_COLORS = [
  "from-blue-400 to-cyan-400",
  "from-green-400 to-emerald-400",
  "from-yellow-400 to-orange-400",
  "from-orange-400 to-red-400",
  "from-red-400 to-pink-500",
];
const LEVEL_EMOJIS = ["💧", "🌿", "⚡", "🔥", "🌋"];

export default function LivePulse({ config, state, myUserId, onTap }: Props) {
  const { title, subtitle, prompt = "點擊提升活力！", maxLevel } = config;
  const { taps, totalTaps } = state;

  const myTaps = taps.find((t) => t.userId === myUserId);
  const myCount = myTaps?.count ?? 0;

  const participantCount = taps.length;
  const levelPct = Math.min((totalTaps / Math.max(maxLevel, 1)) * 100, 100);

  const levelIdx = Math.min(
    Math.floor((levelPct / 100) * LEVEL_COLORS.length),
    LEVEL_COLORS.length - 1,
  );
  const gradient = LEVEL_COLORS[levelIdx];
  const emoji = LEVEL_EMOJIS[levelIdx];

  const nextMilestone = useMemo(
    () => MILESTONES.find((m) => m > totalTaps),
    [totalTaps],
  );

  const topTappers = useMemo(
    () => [...taps].sort((a, b) => b.count - a.count).slice(0, 5),
    [taps],
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-8 gap-6" data-testid="live-pulse-root">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold" data-testid="pulse-title">{title}</h1>
        {subtitle && <p className="text-gray-400 mt-1" data-testid="pulse-subtitle">{subtitle}</p>}
      </div>

      {/* Energy Gauge */}
      <div className="w-full max-w-sm">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>活力值</span>
          <span data-testid="total-taps">{totalTaps} 次</span>
        </div>
        <div className="h-8 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
            style={{ width: `${levelPct}%` }}
            data-testid="pulse-bar"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0</span>
          <span>{maxLevel}</span>
        </div>
      </div>

      {/* Level Emoji */}
      <div className="text-6xl" data-testid="pulse-emoji">{emoji}</div>

      {/* Stats Row */}
      <div className="flex gap-8 text-center">
        <div>
          <div className="text-2xl font-bold text-cyan-400" data-testid="participant-count">{participantCount}</div>
          <div className="text-xs text-gray-400">參與人數</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-yellow-400" data-testid="my-tap-count">{myCount}</div>
          <div className="text-xs text-gray-400">我的點擊</div>
        </div>
        {nextMilestone && (
          <div>
            <div className="text-2xl font-bold text-purple-400" data-testid="next-milestone">{nextMilestone - totalTaps}</div>
            <div className="text-xs text-gray-400">到里程碑</div>
          </div>
        )}
      </div>

      {/* Tap Button */}
      <Button
        onClick={onTap}
        className={`w-40 h-40 rounded-full bg-gradient-to-br ${gradient} text-white text-xl font-bold shadow-2xl active:scale-95 transition-transform`}
        data-testid="tap-btn"
      >
        <div className="flex flex-col items-center gap-1">
          <Zap className="w-8 h-8" />
          <span>{prompt}</span>
        </div>
      </Button>

      {/* Prompt */}
      <p className="text-gray-400 text-sm text-center">{prompt}</p>

      {/* Top Tappers */}
      {topTappers.length > 0 && (
        <div className="w-full max-w-sm">
          <h3 className="text-sm text-gray-400 mb-2">活力排行</h3>
          <div className="flex flex-col gap-1" data-testid="top-tappers">
            {topTappers.map((t, i) => (
              <div
                key={t.userId}
                className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2"
                data-testid={`tapper-${t.userId}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-4">{i + 1}</span>
                  <span className="font-medium" data-testid={`tapper-name-${t.userId}`}>{t.userName}</span>
                  {t.userId === myUserId && <span className="text-xs text-cyan-400">（我）</span>}
                </div>
                <span className="text-yellow-400 font-bold" data-testid={`tapper-count-${t.userId}`}>{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestone celebration */}
      {MILESTONES.includes(totalTaps) && (
        <div className="text-center animate-bounce" data-testid="milestone-celebration">
          <div className="text-4xl">🎉</div>
          <div className="text-yellow-400 font-bold">達成 {totalTaps} 次里程碑！</div>
        </div>
      )}
    </div>
  );
}
