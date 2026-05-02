// 📺 PollLive — HostScreen 即時民調元件（W2 首發業務元件）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// pageType: host_poll_live
//
// 玩法：
//   - 大螢幕端顯示題目 + 即時長條圖 + 投票數動畫
//   - 玩家端看到題目選項，點選即送 host_screen_pulse
//   - 投票後 UI 鎖定，顯示「已投票」+ 顯示自己選的（不顯示總票數，等大螢幕揭曉）
//   - 大螢幕端可選擇「揭曉」(reveal) 後玩家也能看到結果
//
// state 結構（透過 host_screen_state 廣播）：
//   {
//     question: string;
//     options: { id, label }[];
//     votes: Record<optionId, number>;
//     totalVotes: number;
//     status: "open" | "closed" | "revealed";
//     revealResults: boolean;
//     startedAt?: string;
//     endsAt?: string;
//   }

import { useEffect, useState, useMemo } from "react";

interface PollOption {
  id: string;
  label: string;
}

export interface PollLiveConfig {
  /** 題目（必填） */
  question: string;
  /** 選項（至少 2 個） */
  options: PollOption[];
  /** 倒數秒數（選填，沒設則 admin 手動關閉） */
  durationSec?: number;
  /** 副標題 / 提示 */
  subtitle?: string;
  /** 是否允許玩家更改投票（預設 false 一票定生死） */
  allowChangeVote?: boolean;
}

interface PollLiveState {
  question: string;
  options: PollOption[];
  votes: Record<string, number>;
  totalVotes: number;
  status: "open" | "closed" | "revealed";
  revealResults: boolean;
  startedAt?: string;
  endsAt?: string;
}

export interface PollLiveProps {
  config: PollLiveConfig;
  hostMode: boolean;
  state?: PollLiveState | null;
  /** 玩家端送投票 */
  onPulse?: (pulseType: string, payload: { optionId: string }) => void;
  /** 大螢幕端廣播狀態（揭曉、關閉投票、重設）*/
  onBroadcastState?: (state: PollLiveState) => void;
}

// 預設 state（state 未注入時用 config 的選項建初始）
function buildInitialState(config: PollLiveConfig): PollLiveState {
  return {
    question: config.question,
    options: config.options,
    votes: Object.fromEntries(config.options.map((o) => [o.id, 0])),
    totalVotes: 0,
    status: "open",
    revealResults: false,
  };
}

export default function PollLive({ config, hostMode, state, onPulse, onBroadcastState }: PollLiveProps) {
  const [myVote, setMyVote] = useState<string | null>(null);
  const effectiveState = state ?? buildInitialState(config);

  // 倒數計時（hostMode 才顯示）
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  useEffect(() => {
    if (!effectiveState.endsAt) return;
    const update = () => {
      const remain = Math.max(
        0,
        Math.floor((new Date(effectiveState.endsAt!).getTime() - Date.now()) / 1000),
      );
      setRemainingSec(remain);
      // 自動關閉投票（hostMode 才做）
      if (remain === 0 && hostMode && effectiveState.status === "open") {
        onBroadcastState?.({ ...effectiveState, status: "closed" });
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [effectiveState, hostMode, onBroadcastState]);

  const maxVotes = useMemo(() => {
    return Math.max(1, ...Object.values(effectiveState.votes));
  }, [effectiveState.votes]);

  // ─────────────────────────────────────────────────────
  // 大螢幕版型
  // ─────────────────────────────────────────────────────
  if (hostMode) {
    return (
      <div className="w-full h-full min-h-screen flex flex-col items-center justify-start bg-gradient-to-b from-zinc-900 to-black text-white p-8 md:p-12">
        {/* 倒數計時 */}
        {remainingSec !== null && (
          <div className="mb-6 text-center">
            <div className={`text-7xl font-bold ${remainingSec <= 5 ? "text-red-500 animate-pulse" : "text-emerald-400"}`}>
              {remainingSec}
            </div>
            <div className="text-sm text-zinc-400 mt-1">秒</div>
          </div>
        )}

        {/* 題目 */}
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold text-center mb-3 max-w-4xl">
          {effectiveState.question}
        </h1>
        {config.subtitle && (
          <p className="text-base md:text-xl text-zinc-400 text-center mb-8">
            {config.subtitle}
          </p>
        )}

        {/* 總票數 */}
        <div className="mb-6 text-center">
          <span className="text-5xl font-bold text-primary">{effectiveState.totalVotes}</span>
          <span className="text-lg text-zinc-400 ml-2">票</span>
        </div>

        {/* 選項長條圖 */}
        <div className="w-full max-w-3xl space-y-4">
          {effectiveState.options.map((opt) => {
            const count = effectiveState.votes[opt.id] ?? 0;
            const ratio = effectiveState.totalVotes > 0 ? (count / effectiveState.totalVotes) * 100 : 0;
            const widthRatio = (count / maxVotes) * 100;
            return (
              <div key={opt.id} className="space-y-2">
                <div className="flex items-center justify-between text-lg md:text-xl">
                  <span className="font-medium">{opt.label}</span>
                  <span className="font-mono">
                    <span className="text-2xl md:text-3xl text-primary font-bold">{count}</span>
                    <span className="text-sm text-zinc-500 ml-2">{Math.round(ratio)}%</span>
                  </span>
                </div>
                <div className="h-12 bg-zinc-800 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500 ease-out"
                    style={{ width: `${widthRatio}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 狀態 badge */}
        <div className="mt-8">
          {effectiveState.status === "open" && (
            <span className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
              🟢 投票進行中
            </span>
          )}
          {effectiveState.status === "closed" && (
            <span className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
              🟡 投票已結束
            </span>
          )}
          {effectiveState.status === "revealed" && (
            <span className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-full text-sm">
              🟣 結果已揭曉
            </span>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // 玩家手機版型
  // ─────────────────────────────────────────────────────
  const handleVote = (optionId: string) => {
    if (effectiveState.status !== "open") return;
    if (myVote && !config.allowChangeVote) return;
    setMyVote(optionId);
    onPulse?.("vote", { optionId });
  };

  const showResults = effectiveState.status === "revealed" || effectiveState.revealResults;

  return (
    <div className="w-full p-4 space-y-5 max-w-md mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold leading-snug">{effectiveState.question}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
      </div>

      {effectiveState.status === "closed" && !showResults && (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-center">
          ⏰ 投票已結束，等待大螢幕揭曉結果
        </div>
      )}

      <div className="space-y-3">
        {effectiveState.options.map((opt) => {
          const count = effectiveState.votes[opt.id] ?? 0;
          const ratio = effectiveState.totalVotes > 0 ? (count / effectiveState.totalVotes) * 100 : 0;
          const isMyVote = myVote === opt.id;
          const isClickable =
            effectiveState.status === "open" && (!myVote || config.allowChangeVote);

          return (
            <button
              key={opt.id}
              type="button"
              disabled={!isClickable}
              onClick={() => handleVote(opt.id)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden ${
                isMyVote
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : isClickable
                    ? "border-border hover:border-primary/40 active:scale-[0.98]"
                    : "border-border opacity-60 cursor-not-allowed"
              }`}
              data-testid={`btn-poll-option-${opt.id}`}
            >
              {/* 結果 fill bar（揭曉時顯示）*/}
              {showResults && (
                <div
                  className="absolute inset-y-0 left-0 bg-primary/15 transition-all duration-700"
                  style={{ width: `${ratio}%` }}
                />
              )}

              <div className="relative flex items-center justify-between gap-3">
                <span className={`font-medium ${isMyVote ? "text-primary" : ""}`}>
                  {opt.label}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {isMyVote && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      ✓ 我的選擇
                    </span>
                  )}
                  {showResults && (
                    <span className="font-mono text-sm">
                      <span className="font-bold">{count}</span>
                      <span className="text-muted-foreground ml-1">({Math.round(ratio)}%)</span>
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {myVote && (
        <p className="text-center text-sm text-muted-foreground">
          ✅ 已投票，{showResults ? "結果如上" : "等待結果揭曉"}
        </p>
      )}
    </div>
  );
}
