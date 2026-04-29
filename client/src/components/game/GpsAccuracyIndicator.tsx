// 📡 GPS 精度即時提示元件
//
// 目的：玩家「定位差很遠」時，知道是 GPS 訊號問題、不是遊戲壞掉
//
// 顯示：
//   - 即時精度（公尺）
//   - 品質等級（綠 / 黃 / 紅燈）
//   - 採樣進度（前 5 點才會穩定）
//   - 弱訊號改善建議（戶外 / 等暖機 / 開 WiFi）
//
// 用在 GpsMissionPage / PhotoSpotFlow 上方

import { useMemo } from "react";
import { describeQuality, type GpsQuality } from "@/lib/geolocation";

interface GpsAccuracyIndicatorProps {
  accuracy: number | null;
  quality: GpsQuality;
  samples: number;
  /** 是否正在運作 */
  active?: boolean;
  /** 是否正在採樣中（< 3 點時顯示「校準中」）*/
  calibrating?: boolean;
  /** compact 模式：只顯示一行小字（給其他頁的角落用）*/
  compact?: boolean;
  className?: string;
  /** 🤝 多人融合資訊（若提供 contributors > 1 → 顯示融合徽章）*/
  fusion?: {
    contributors: number;       // 融合用了幾人
    scattered: boolean;          // 隊友是否分散
    improvementRatio: number;    // 0-1，越接近 1 表示提升越多
  };
}

export function GpsAccuracyIndicator({
  accuracy,
  quality,
  samples,
  active = true,
  calibrating = false,
  compact = false,
  className = "",
  fusion,
}: GpsAccuracyIndicatorProps) {
  const desc = useMemo(() => describeQuality(quality), [quality]);
  const isCalibrating = calibrating || samples < 3;
  const isFused = !!fusion && fusion.contributors > 1 && !fusion.scattered;

  if (!active) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
        <span>📡</span>
        <span>GPS 未啟用</span>
      </div>
    );
  }

  if (accuracy == null) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
        <span className="animate-pulse">📡</span>
        <span>正在取得 GPS...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={`flex items-center gap-1 text-xs ${desc.color} ${className}`}
        title={`GPS 精度 ±${Math.round(accuracy)}m`}
      >
        <span>{desc.emoji}</span>
        <span>±{Math.round(accuracy)}m</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border bg-card/50 backdrop-blur-sm p-2.5 ${className}`}
      data-testid="gps-accuracy-indicator"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{desc.emoji}</span>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">GPS 精度</span>
            <span className={`text-sm font-semibold ${desc.color}`}>
              {desc.label} · ±{Math.round(accuracy)}m
            </span>
          </div>
        </div>
        {isCalibrating && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="animate-pulse">🛰️</span>
            <span>校準中 {samples}/5</span>
          </div>
        )}
      </div>

      {/* 🤝 多人融合徽章（contributors > 1 + 沒分散時）*/}
      {isFused && fusion && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-blue-500">
              <span>🤝</span>
              <span className="font-medium">隊伍融合</span>
              <span className="text-muted-foreground">
                ({fusion.contributors} 人)
              </span>
            </span>
            <span className="text-muted-foreground">
              精度提升 {Math.round(fusion.improvementRatio * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* 隊友分散時提示（已退化為單機）*/}
      {fusion?.scattered && (
        <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
          ⚠️ 隊友距離過遠，已切換為個人定位
        </div>
      )}

      {/* 弱訊號建議 */}
      {desc.hint && (
        <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground leading-relaxed">
          💡 {desc.hint}
        </div>
      )}
    </div>
  );
}
