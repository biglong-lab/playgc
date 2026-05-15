// 🎯 CollectiveScore — 全隊合作累計分元件（W4 D3，S 級）
//
// 玩法：
//   - admin 設定目標分數（targetScore）
//   - 玩家各自加分（自報、按鈕、答題等）
//   - 全隊累計達標 → 慶祝畫面
//   - 達標後不再加分（防 spam）
//
// pageType: collective_score（multi 軸線）
// 適用：學校班際積分、企業合作任務、義賣達標

import { useState } from "react";
import { motion } from "framer-motion";

export interface CollectiveScoreConfig {
  title?: string;
  subtitle?: string;
  targetScore?: number;
  /** 每次加分的選項（玩家點按鈕加分）*/
  addOptions?: { label: string; delta: number }[];
  /** 達標慶祝訊息 */
  celebrationText?: string;
}

interface CollectiveScoreState {
  totalScore: number;
  contributors: { name: string; total: number }[];
  isReached: boolean;
}

export interface CollectiveScoreProps {
  config: CollectiveScoreConfig;
  state: CollectiveScoreState | null;
  myUserName: string;
  onContribute: (delta: number) => void;
}

const DEFAULT_OPTIONS = [
  { label: "+10", delta: 10 },
  { label: "+50", delta: 50 },
  { label: "+100", delta: 100 },
];

export default function CollectiveScore({
  config,
  state,
  myUserName,
  onContribute,
}: CollectiveScoreProps) {
  const targetScore = Math.max(1, config.targetScore ?? 1000);
  const options = config.addOptions ?? DEFAULT_OPTIONS;

  const totalScore = state?.totalScore ?? 0;
  const contributors = state?.contributors ?? [];
  const isReached = state?.isReached ?? totalScore >= targetScore;

  const ratio = Math.min(100, (totalScore / targetScore) * 100);

  // 達標
  if (isReached) {
    const sorted = [...contributors].sort((a, b) => b.total - a.total);
    return (
      <div className="w-full max-w-xl mx-auto p-4 space-y-4">
        <div className="text-center space-y-3 py-8">
          <div className="text-7xl">🎯</div>
          <h2 className="text-3xl font-display font-bold">達標！</h2>
          <p className="text-lg text-muted-foreground">
            {config.celebrationText ?? `全隊累積 ${totalScore} 分`}
          </p>
        </div>

        {sorted.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">隊員貢獻</p>
            {sorted.map((c, i) => (
              <div
                key={c.name}
                className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-card border"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-muted-foreground w-6">#{i + 1}</span>
                  <span className="font-medium">{c.name}</span>
                  {i === 0 && <span className="text-xl">🏅</span>}
                </div>
                <span className="font-mono font-bold text-primary">+{c.total}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-5">
      {/* 標題 */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-display font-bold">{config.title ?? "🎯 合作達標"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
      </div>

      {/* 進度 */}
      <div className="space-y-3">
        <div className="text-center">
          <span className="text-5xl font-bold text-primary">{totalScore}</span>
          <span className="text-2xl text-muted-foreground mx-2">/</span>
          <span className="text-2xl text-muted-foreground">{targetScore}</span>
        </div>
        <div className="h-6 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
            style={{ width: `${ratio}%` }}
          />
        </div>
        <p className="text-xs text-center text-muted-foreground">
          還差 <span className="font-bold text-primary">{Math.max(0, targetScore - totalScore)}</span> 分
        </p>
      </div>

      {/* 加分按鈕 */}
      <div>
        <p className="text-sm font-medium mb-2">點擊貢獻分數</p>
        <div className="grid grid-cols-3 gap-2">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => onContribute(opt.delta)}
              className="py-4 rounded-xl bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all text-lg font-bold text-primary"
              data-testid={`btn-contribute-${opt.delta}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 我的貢獻 */}
      {(() => {
        const myContrib = contributors.find((c) => c.name === myUserName);
        if (!myContrib) return null;
        return (
          <div className="bg-muted/40 rounded-lg p-3 text-center text-sm">
            我的貢獻：<span className="font-bold text-primary">+{myContrib.total}</span>
          </div>
        );
      })()}

      {/* Top 5 貢獻 */}
      {contributors.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">隊員貢獻排行</p>
          {[...contributors]
            .sort((a, b) => b.total - a.total)
            .slice(0, 5)
            .map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border text-sm"
              >
                <span className={c.name === myUserName ? "font-bold text-primary" : ""}>
                  {c.name === myUserName && "（我）"}
                  {c.name}
                </span>
                <span className="font-mono">+{c.total}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
