// 📺 LiveLeaderboard — HostScreen 即時排行元件（W3 D4，M 級）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// pageType: host_live_leaderboard
//
// 玩法：
//   - 大螢幕：Top N 排行榜（金銀銅獎牌、漸進入場動畫、變動箭頭 ↑↓）
//   - 玩家：唯讀，看 Top 10 + 我的位置（highlight）
//   - 適用：園遊會搶答賽結算、企業競賽、課堂答題排行
//
// state 結構：
//   {
//     entries: { id, name, score }[];  // 由 broadcastState 設定（admin 從其他元件結算後廣播）
//     lastUpdated?: number;
//   }
//
// pulse:
//   - type: "score_add"  payload: { id, name, delta }   個別玩家加分（簡單模式）
//   - type: "score_set"  payload: { id, name, score }   設定絕對分
//
// 注意：玩家自報分數有作弊風險，正式競賽應由其他元件結算後 admin 廣播 state。
// 此元件預設 pulse 開放（給簡單嘉年華 / 課堂用），admin 可在 config 關閉。

import { useEffect, useState, useMemo, useRef } from "react";

export interface LiveLeaderboardConfig {
  title?: string;
  subtitle?: string;
  /** Top N（預設 10）*/
  topN?: number;
  /** 玩家 pulse 是否可加分（預設 false，純展示）*/
  acceptPlayerPulse?: boolean;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
}

interface LiveLeaderboardState {
  entries: LeaderboardEntry[];
  lastUpdated?: number;
}

export interface LiveLeaderboardProps {
  config: LiveLeaderboardConfig;
  hostMode: boolean;
  state?: LiveLeaderboardState | null;
  /** 玩家 ID（從 useAuth 之類來源；簡化版用 sessionStorage 隨機 id）*/
  myId?: string;
  onPulse?: (pulseType: string, payload: { id: string; name: string; delta?: number; score?: number }) => void;
  onBroadcastState?: (state: LiveLeaderboardState) => void;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function buildInitialState(): LiveLeaderboardState {
  return { entries: [] };
}

export default function LiveLeaderboard({ config, hostMode, state, myId }: LiveLeaderboardProps) {
  const topN = config.topN ?? 10;
  const effectiveState = state ?? buildInitialState();

  // 排序（依 score 倒排）
  const sorted = useMemo(() => {
    return [...effectiveState.entries].sort((a, b) => b.score - a.score);
  }, [effectiveState.entries]);

  // 排名變動偵測（client-side，比較上次渲染的 sorted 順序）
  const lastRanksRef = useRef<Record<string, number>>({});
  const [rankChange, setRankChange] = useState<Record<string, "up" | "down" | "same">>({});
  useEffect(() => {
    const newRanks: Record<string, number> = {};
    const newChange: Record<string, "up" | "down" | "same"> = {};
    sorted.forEach((entry, i) => {
      newRanks[entry.id] = i;
      const old = lastRanksRef.current[entry.id];
      if (old === undefined) newChange[entry.id] = "same";
      else if (i < old) newChange[entry.id] = "up";
      else if (i > old) newChange[entry.id] = "down";
      else newChange[entry.id] = "same";
    });
    lastRanksRef.current = newRanks;
    setRankChange(newChange);
  }, [sorted]);

  const topEntries = sorted.slice(0, topN);
  const myEntry = sorted.find((e) => e.id === myId);
  const myRank = myEntry ? sorted.findIndex((e) => e.id === myId) + 1 : null;

  // ─── 大螢幕版型 ───
  if (hostMode) {
    return (
      <div className="w-full h-full min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white p-8 md:p-12">
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold mb-3">
            {config.title ?? "🏆 即時排行榜"}
          </h1>
          {config.subtitle && (
            <p className="text-base md:text-xl text-zinc-400">{config.subtitle}</p>
          )}
        </div>

        {topEntries.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <p className="text-2xl">等待第一筆得分...</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {topEntries.map((entry, i) => {
              const change = rankChange[entry.id] ?? "same";
              const medalEmoji = i < 3 ? MEDALS[i] : null;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 px-5 py-4 rounded-xl border transition-all ${
                    i === 0
                      ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/10 border-yellow-500/40 shadow-lg shadow-yellow-500/10"
                      : i === 1
                        ? "bg-gradient-to-r from-zinc-400/15 to-zinc-300/5 border-zinc-400/40"
                        : i === 2
                          ? "bg-gradient-to-r from-orange-700/15 to-orange-600/5 border-orange-600/40"
                          : "bg-zinc-800/50 border-zinc-700"
                  }`}
                >
                  {/* 名次 */}
                  <div className="text-3xl md:text-4xl font-bold w-16 text-center">
                    {medalEmoji ?? <span className="text-zinc-500">#{i + 1}</span>}
                  </div>
                  {/* 名字 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xl md:text-2xl font-semibold truncate">{entry.name}</div>
                  </div>
                  {/* 變動箭頭 */}
                  {change === "up" && <span className="text-2xl text-emerald-400">↑</span>}
                  {change === "down" && <span className="text-2xl text-red-400">↓</span>}
                  {/* 分數 */}
                  <div className="text-3xl md:text-4xl font-bold font-mono text-primary">
                    {entry.score}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {effectiveState.lastUpdated && (
          <p className="text-xs text-zinc-600 text-center mt-6">
            最後更新：{new Date(effectiveState.lastUpdated).toLocaleTimeString("zh-TW")}
          </p>
        )}
      </div>
    );
  }

  // ─── 玩家版型 ───
  return (
    <div className="w-full p-4 max-w-md mx-auto space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">{config.title ?? "🏆 即時排行榜"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
      </div>

      {myRank && myEntry && (
        <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 text-center">
          <p className="text-xs text-muted-foreground">我的排名</p>
          <div className="text-3xl font-bold text-primary mt-1">#{myRank}</div>
          <p className="text-sm mt-1">{myEntry.name} · {myEntry.score} 分</p>
        </div>
      )}

      {topEntries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          等待第一筆得分...
        </div>
      ) : (
        <div className="space-y-1.5">
          {topEntries.map((entry, i) => {
            const isMe = entry.id === myId;
            const medal = i < 3 ? MEDALS[i] : null;
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                  isMe ? "bg-primary/10 border border-primary/30" : "bg-card border"
                }`}
              >
                <div className="w-8 text-center font-bold text-sm">
                  {medal ?? `#${i + 1}`}
                </div>
                <div className="flex-1 min-w-0 text-sm font-medium truncate">{entry.name}</div>
                <div className="font-mono font-bold text-primary">{entry.score}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
