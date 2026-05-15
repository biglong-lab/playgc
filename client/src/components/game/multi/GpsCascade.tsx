// 🗺 GpsCascade — 連鎖解鎖元件（W4 D2，S 級）
//
// 玩法：
//   - admin 設定 N 個地點（依序）
//   - 玩家依序前往：第 1 點到了 → 解鎖第 2 點 hint → ... → 終點
//   - 不能跳過（強制動線）
//
// pageType: gps_cascade（multi 軸線）
// 適用：景點故事化動線、城市闖關、企業參訪
//
// 簡化版：用「我到了」按鈕代替 GPS 自動驗證（admin 配置真實 GPS 是 P2 加強）

import { useState } from "react";
import { motion } from "framer-motion";

export interface GpsCascadePoint {
  id: string;
  name: string;        // 地點名（例：「莒光樓門口」）
  hint: string;        // 給玩家的提示（例：「面對主入口、看到金門兩字招牌」）
  story?: string;      // 到達後的故事文字（揭曉劇情）
  lat?: number;        // GPS 座標（P2 自動驗證用，目前手動）
  lng?: number;
}

export interface GpsCascadeConfig {
  title?: string;
  subtitle?: string;
  points?: GpsCascadePoint[];
}

interface GpsCascadeState {
  reachedPointIds: string[];
}

export interface GpsCascadeProps {
  config: GpsCascadeConfig;
  state: GpsCascadeState | null;
  onReachPoint: (pointId: string) => void;
}

export default function GpsCascade({ config, state, onReachPoint }: GpsCascadeProps) {
  const points = config.points ?? [];
  const reached = state?.reachedPointIds ?? [];

  // 找出當前應該前往的點（第一個未達點）
  const currentIdx = points.findIndex((p) => !reached.includes(p.id));
  const isComplete = currentIdx === -1 && points.length > 0;
  const currentPoint = currentIdx >= 0 ? points[currentIdx] : null;
  const lastReachedPoint = reached.length > 0 ? points.find((p) => p.id === reached[reached.length - 1]) : null;

  // 全部到達 → 完成
  if (isComplete) {
    return (
      <div className="w-full max-w-xl mx-auto p-4 space-y-4">
        <div className="text-center space-y-3 py-8">
          <div className="text-7xl">🏁</div>
          <h2 className="text-3xl font-display font-bold">旅程完成！</h2>
          <p className="text-sm text-muted-foreground">走遍 {points.length} 個地點</p>
        </div>
        <div className="space-y-2">
          {points.map((p, i) => (
            <div
              key={p.id}
              className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg"
            >
              <div className="text-2xl shrink-0">📍</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  <span className="text-xs text-muted-foreground mr-2">#{i + 1}</span>
                  {p.name}
                </p>
                {p.story && <p className="text-sm text-muted-foreground mt-1">{p.story}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-display font-bold">{config.title ?? "🗺 連鎖探索"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
        <div className="text-xs text-muted-foreground">
          進度：<span className="font-bold text-primary">{reached.length}</span> / {points.length} 點
        </div>
      </div>

      {/* 上一站故事（如果有 reached）*/}
      {lastReachedPoint && (
        <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
          <p className="text-xs text-muted-foreground">✅ 已到達</p>
          <p className="font-medium">{lastReachedPoint.name}</p>
          {lastReachedPoint.story && (
            <p className="text-sm text-muted-foreground mt-1">{lastReachedPoint.story}</p>
          )}
        </div>
      )}

      {/* 當前要去的點 */}
      {currentPoint && (
        <div className="border-2 border-primary rounded-2xl p-5 text-center space-y-3 bg-primary/5">
          <div className="text-xs text-primary font-medium">下一站</div>
          <div className="text-2xl font-bold">📍 {currentPoint.name}</div>
          <p className="text-sm text-muted-foreground">{currentPoint.hint}</p>
          <button
            type="button"
            onClick={() => onReachPoint(currentPoint.id)}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 active:scale-95 transition-all"
            data-testid={`btn-reach-${currentPoint.id}`}
          >
            ✋ 我到了！
          </button>
        </div>
      )}

      {/* 整體路線預覽 */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">完整路線</p>
        {points.map((p, i) => {
          const r = reached.includes(p.id);
          const isCurrent = currentPoint?.id === p.id;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                r
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                  : isCurrent
                    ? "bg-primary/10 text-primary font-medium"
                    : "bg-muted/40 text-muted-foreground"
              }`}
            >
              <span className="font-mono text-xs w-6">#{i + 1}</span>
              <span className="text-base">{r ? "✅" : isCurrent ? "📍" : "🔒"}</span>
              <span className="flex-1 truncate">{r || isCurrent ? p.name : "（解鎖後可見）"}</span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        💡 P2 加強：實際 GPS 自動偵測（目前用「我到了」按鈕代替）
      </p>
    </div>
  );
}
