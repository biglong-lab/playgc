// 🗺️ GpsTeamMission — 隊伍 GPS 任務元件（多人協作版）
//
// 與個人版 GpsMissionPage 的差異：
//   - 同時追蹤所有隊員位置（透過 useTeamGpsFusion）
//   - 兩種觸發模式：
//       any  — 任一隊員到達即全隊完成（適合「找到地標就好」）
//       all  — 全員到達才完成（適合「集合點」）
//   - 顯示隊員清單 + 各自距離 + 到達狀態
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.4
//
// 測試友善：純 presentational + props 注入 teammates / target，
// 不直接連 geolocation API（由父層 useTeamGpsFusion 注入位置）

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, CheckCircle, Users } from "lucide-react";
import { distanceMeters } from "@/lib/geolocation";
import type { GpsMissionConfig } from "@shared/schema";

// ============================================================================
// 型別
// ============================================================================

/** 觸發模式 — 任一/全員到達 */
export type GpsTriggerMode = "any" | "all";

/** 隊員位置（來自 useTeamGpsFusion） */
export interface TeammateLocation {
  userId: string;
  displayName: string;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
}

export interface GpsTeamMissionProps {
  config: GpsMissionConfig;
  myUserId: string;
  /** 隊員清單 + 位置（含自己） */
  teammates: TeammateLocation[];
  /** 觸發模式（預設 any） */
  triggerMode?: GpsTriggerMode;
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
}

// ============================================================================
// 純函式 helpers（可單獨測試）
// ============================================================================

/** 從 config 取出目標座標（兩種命名格式都支援） */
export function getTargetLocation(
  config: GpsMissionConfig,
): { lat: number; lng: number } | null {
  if (config.targetLocation) return config.targetLocation;
  if (
    typeof config.targetLatitude === "number" &&
    typeof config.targetLongitude === "number"
  ) {
    return { lat: config.targetLatitude, lng: config.targetLongitude };
  }
  return null;
}

/** 找出已到達目標的隊員 userId 清單（半徑 radius 內） */
export function findReachedMembers(
  teammates: TeammateLocation[],
  target: { lat: number; lng: number },
  radiusMeters: number,
): string[] {
  return teammates
    .filter((t) => {
      const dist = distanceMeters(t.lat, t.lng, target.lat, target.lng);
      return dist <= radiusMeters;
    })
    .map((t) => t.userId);
}

/** 計算任務是否完成 */
export function isGpsTeamMissionComplete(
  reachedUserIds: string[],
  allUserIds: string[],
  mode: GpsTriggerMode,
): boolean {
  if (allUserIds.length === 0) return false;
  if (mode === "any") return reachedUserIds.length > 0;
  // all：全員都要在 reached 中
  return allUserIds.every((id) => reachedUserIds.includes(id));
}

/** 計算隊員到目標的距離（公尺） */
export function getTeammateDistance(
  teammate: TeammateLocation,
  target: { lat: number; lng: number },
): number {
  return distanceMeters(teammate.lat, teammate.lng, target.lat, target.lng);
}

/** 距離格式化 — 1500m → "1.5 km" / 50m → "50 公尺" */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} 公尺`;
  return `${(meters / 1000).toFixed(1)} 公里`;
}

// ============================================================================
// 主元件
// ============================================================================

export default function GpsTeamMission({
  config,
  myUserId,
  teammates,
  triggerMode = "any",
  onComplete,
}: GpsTeamMissionProps) {
  const [hasAdvanced, setHasAdvanced] = useState(false);

  const target = useMemo(() => getTargetLocation(config), [config]);
  const radius = config.radius ?? 50;

  // 已到達者
  const reachedUserIds = useMemo(() => {
    if (!target) return [];
    return findReachedMembers(teammates, target, radius);
  }, [teammates, target, radius]);

  // 全員 userId
  const allUserIds = useMemo(
    () => teammates.map((t) => t.userId),
    [teammates],
  );

  const isComplete = useMemo(
    () => isGpsTeamMissionComplete(reachedUserIds, allUserIds, triggerMode),
    [reachedUserIds, allUserIds, triggerMode],
  );

  // 達標 → 1 秒延遲後 onComplete
  useEffect(() => {
    if (!isComplete || hasAdvanced) return;
    const timer = setTimeout(() => {
      setHasAdvanced(true);
      onComplete();
    }, 1000);
    return () => clearTimeout(timer);
  }, [isComplete, hasAdvanced, onComplete]);

  // 沒目標 → 顯示錯誤
  if (!target) {
    return (
      <Card data-testid="gps-team-mission-no-target">
        <CardContent className="p-6 text-center text-muted-foreground">
          <MapPin className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">未設定目標位置</p>
        </CardContent>
      </Card>
    );
  }

  // 沒隊員 → 顯示提示
  if (teammates.length === 0) {
    return (
      <Card data-testid="gps-team-mission-no-teammates">
        <CardContent className="p-6 text-center text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">等待隊員加入...</p>
        </CardContent>
      </Card>
    );
  }

  const totalCount = teammates.length;
  const reachedCount = reachedUserIds.length;
  const progress =
    triggerMode === "any"
      ? reachedCount > 0
        ? 100
        : 0
      : (reachedCount / totalCount) * 100;

  return (
    <div className="space-y-4" data-testid="gps-team-mission">
      {/* 標題 + 目標 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">{config.title ?? "隊伍 GPS 任務"}</h2>
          </div>
          {config.locationName && (
            <p className="text-sm text-muted-foreground mb-1">
              目標：{config.locationName}
            </p>
          )}
          {config.instruction && (
            <p className="text-sm text-foreground">{config.instruction}</p>
          )}
        </CardContent>
      </Card>

      {/* 進度區 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Navigation className="w-4 h-4" />
              {triggerMode === "any" ? "任一隊員到達即完成" : "需全員到達"}
            </div>
            <Badge
              variant={isComplete ? "default" : "outline"}
              className="font-number tabular-nums"
              data-testid="gps-team-mission-progress-badge"
            >
              {reachedCount} / {totalCount} 已到達
            </Badge>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-3" />
        </CardContent>
      </Card>

      {/* 隊員清單 */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-primary" />
            隊員距離
          </div>
          <div
            className="space-y-1.5"
            data-testid="gps-team-mission-teammates-list"
          >
            {teammates.map((t) => {
              const isMe = t.userId === myUserId;
              const dist = getTeammateDistance(t, target);
              const reached = reachedUserIds.includes(t.userId);
              return (
                <div
                  key={t.userId}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                    isMe ? "bg-primary/10 border border-primary/30" : ""
                  } ${reached ? "text-success" : ""}`}
                  data-testid={`gps-teammate-${t.userId}`}
                >
                  {reached ? (
                    <CheckCircle
                      className="w-4 h-4 text-success shrink-0"
                      data-testid={`gps-reached-${t.userId}`}
                    />
                  ) : (
                    <Navigation className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 font-medium truncate">
                    {t.displayName}
                    {isMe && <span className="ml-1 text-xs text-primary">（你）</span>}
                  </span>
                  <span className="font-number tabular-nums text-muted-foreground text-xs">
                    {formatDistance(dist)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 完成提示 */}
      {isComplete && !hasAdvanced && (
        <div
          className="text-center text-sm text-success font-medium"
          data-testid="gps-team-mission-complete"
        >
          🎉 任務完成！
        </div>
      )}
    </div>
  );
}
