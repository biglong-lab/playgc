// 📺 CrowdGather — HostScreen 簽到聚眾元件（W3 D3，S 級）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// pageType: host_crowd_gather
//
// 玩法：
//   - 大螢幕：達標進度條 + 已簽到名單（最近 N 位跑馬燈）+ 達標慶祝動畫
//   - 玩家：「我來了！」大按鈕 + 自訂暱稱
//   - 適用：開幕集合、社群打卡、活動破冰前奏、人數達標解鎖
//
// state 結構：
//   {
//     registered: { name: string; ts: number }[];   // 簽到名單（依時間）
//     totalCount: number;
//     isReached: boolean;                            // 達標旗標（host 廣播時設）
//   }
//
// pulse: { type: "checkin", payload: { name?: string } }

import { useEffect, useState, useCallback } from "react";

export interface CrowdGatherConfig {
  title?: string;
  subtitle?: string;
  /** 達標人數（必填，否則用預設 10）*/
  targetCount?: number;
  /** 達標時顯示的訊息 */
  celebrationText?: string;
}

interface CheckinEntry {
  name: string;
  ts: number;
}

interface CrowdGatherState {
  registered: CheckinEntry[];
  totalCount: number;
  isReached: boolean;
}

export interface CrowdGatherProps {
  config: CrowdGatherConfig;
  hostMode: boolean;
  state?: CrowdGatherState | null;
  onPulse?: (pulseType: string, payload: { name?: string }) => void;
  onBroadcastState?: (state: CrowdGatherState) => void;
}

const ANONYMOUS_NAMES = ["匿名玩家", "現場貴賓", "神秘客", "好朋友", "VIP"];

function pickAnonName(): string {
  return ANONYMOUS_NAMES[Math.floor(Math.random() * ANONYMOUS_NAMES.length)];
}

function buildInitialState(): CrowdGatherState {
  return { registered: [], totalCount: 0, isReached: false };
}

export default function CrowdGather({ config, hostMode, state, onPulse }: CrowdGatherProps) {
  const targetCount = Math.max(1, config.targetCount ?? 10);
  const effectiveState = state ?? buildInitialState();
  const [myName, setMyName] = useState("");
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

  const ratio = Math.min(100, (effectiveState.totalCount / targetCount) * 100);

  const handleCheckin = useCallback(() => {
    if (hasCheckedIn) return;
    const finalName = myName.trim() || pickAnonName();
    onPulse?.("checkin", { name: finalName });
    setHasCheckedIn(true);
  }, [myName, hasCheckedIn, onPulse]);

  // ─── 大螢幕版型 ───
  if (hostMode) {
    // 最近 8 位簽到（從最新到舊）
    const recent = [...effectiveState.registered].reverse().slice(0, 8);

    return (
      <div className="w-full h-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black text-white p-8">
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold text-center mb-3">
          {config.title ?? "歡迎加入"}
        </h1>
        {config.subtitle && (
          <p className="text-base md:text-xl text-zinc-400 text-center mb-8">{config.subtitle}</p>
        )}

        {/* 達標進度 */}
        <div className="w-full max-w-3xl my-8">
          <div className="text-center mb-4">
            <span className="text-7xl font-bold text-primary">{effectiveState.totalCount}</span>
            <span className="text-2xl text-zinc-400 mx-3">/</span>
            <span className="text-3xl text-zinc-300">{targetCount}</span>
          </div>
          <div className="h-8 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                effectiveState.isReached
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400 animate-pulse"
                  : "bg-gradient-to-r from-primary/70 to-primary"
              }`}
              style={{ width: `${ratio}%` }}
            />
          </div>
          <p className="text-center text-sm text-zinc-500 mt-3">
            {effectiveState.isReached ? "🎉 達標！" : `還差 ${Math.max(0, targetCount - effectiveState.totalCount)} 位`}
          </p>
        </div>

        {/* 達標慶祝 */}
        {effectiveState.isReached && (
          <div className="my-8 text-center">
            <div className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 bg-clip-text text-transparent animate-pulse">
              {config.celebrationText ?? "🎉 全員到齊！"}
            </div>
          </div>
        )}

        {/* 最近簽到 */}
        <div className="w-full max-w-3xl">
          <p className="text-xs text-zinc-500 text-center mb-3">最近簽到</p>
          <div className="flex flex-wrap gap-2 justify-center min-h-[40px]">
            {recent.length === 0 ? (
              <p className="text-sm text-zinc-600">等待第一位...</p>
            ) : (
              recent.map((entry) => (
                <span
                  key={entry.ts}
                  className="px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-sm"
                >
                  ✅ {entry.name}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── 玩家版型 ───
  if (hasCheckedIn) {
    return (
      <div className="w-full p-4 max-w-md mx-auto space-y-4">
        <div className="text-center space-y-3 py-8">
          <div className="text-7xl">✅</div>
          <h2 className="text-2xl font-bold">已簽到</h2>
          <p className="text-sm text-muted-foreground">
            {effectiveState.isReached
              ? "🎉 達標了！活動準備開始"
              : `現場已有 ${effectiveState.totalCount} 位，還差 ${Math.max(0, targetCount - effectiveState.totalCount)} 位`}
          </p>
          <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
            💡 看大螢幕的進度條
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 max-w-md mx-auto space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">{config.title ?? "我來了！"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">暱稱（選填）</label>
        <input
          type="text"
          value={myName}
          onChange={(e) => setMyName(e.target.value.slice(0, 20))}
          placeholder="留空 = 匿名"
          className="w-full px-3 py-2 rounded-lg border bg-background"
          maxLength={20}
          data-testid="input-checkin-name"
        />
      </div>

      <button
        type="button"
        onClick={handleCheckin}
        className="w-full py-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-2xl font-bold hover:from-emerald-400 hover:to-teal-400 active:scale-95 transition-all shadow-lg"
        data-testid="btn-checkin"
      >
        ✋ 我來了！
      </button>

      <div className="text-center text-sm text-muted-foreground">
        現場已有 <span className="font-bold text-primary">{effectiveState.totalCount}</span> 位 / 目標 {targetCount} 位
      </div>
    </div>
  );
}
