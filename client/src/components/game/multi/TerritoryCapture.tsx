// 🚩 TerritoryCapture — 地盤戰元件（純 UI）
//
// 玩法（依 docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.8）：
//   - 場域內多個 GPS 任務點，多隊同時爭奪
//   - 玩家到任務點 → 佔領（標自己隊伍顏色）
//   - 對手到已佔領點 → 奪回（cooldown 防快速搶）
//   - 時限到 → 佔領最多點的隊伍獲勝
//
// 角色：純 UI（presentation）— 不接 WebSocket、不打 API、不做 GPS 監聽
//   容器層 TerritoryCapturePage 負責 myPosition 監聽 + WebSocket + cooldown 計時
//
// MVP 設計：
//   - 文字版點清單（不渲染地圖，避免 Leaflet 複雜度）
//   - 排行榜按隊伍佔領數降序
//   - 玩家進入點半徑內 + 不在 cooldown → 顯示「佔領」按鈕

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Trophy, Flag, Clock, Crown } from "lucide-react";
import type { TerritoryCaptureConfig, TerritoryPoint } from "@shared/schema";

// ════════════════════════════════════════════════════════════════
// 純函式 helpers
// ════════════════════════════════════════════════════════════════

/**
 * Haversine 距離（公尺）— 純函式，給定座標永遠回相同值
 *
 * @internal export 給測試用
 */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // 地球半徑（公尺）
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export interface TerritoryCapture {
  pointId: string;
  /** 當前佔領者 teamId（null = 中立未佔領） */
  teamId: string | null;
  /** 佔領時 timestamp（用於 cooldown 計算） */
  capturedAt: number;
}

/**
 * 計算隊伍佔領排行
 *
 * @internal export 給測試用
 */
export function computeRanking(
  captures: TerritoryCapture[],
): Array<{ teamId: string; count: number }> {
  const counter = new Map<string, number>();
  for (const c of captures) {
    if (c.teamId) {
      counter.set(c.teamId, (counter.get(c.teamId) ?? 0) + 1);
    }
  }
  return Array.from(counter.entries())
    .map(([teamId, count]) => ({ teamId, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 判斷玩家是否能佔此點：
 *   - 距離 <= radius
 *   - 未被自己隊伍佔領（已是自己的不需重佔）
 *   - 不在冷卻期內（capturedAt + cooldownMs > now → 鎖定）
 *
 * @internal export 給測試用
 */
export function canCapturePoint(
  point: TerritoryPoint,
  myLat: number,
  myLng: number,
  capture: TerritoryCapture | undefined,
  myTeamId: string,
  cooldownMs: number,
  now: number,
): { capturable: boolean; reason?: string; distance: number } {
  const distance = distanceMeters(myLat, myLng, point.lat, point.lng);
  const radius = point.radius ?? 30;

  if (distance > radius) {
    return { capturable: false, reason: "out_of_range", distance };
  }
  if (capture && capture.teamId === myTeamId) {
    return { capturable: false, reason: "already_mine", distance };
  }
  if (capture && capture.capturedAt + cooldownMs > now) {
    return { capturable: false, reason: "cooldown", distance };
  }
  return { capturable: true, distance };
}

// ════════════════════════════════════════════════════════════════
// 元件
// ════════════════════════════════════════════════════════════════

export interface TerritoryCaptureProps {
  config: TerritoryCaptureConfig;
  /** 玩家當前隊伍 ID */
  myTeamId: string;
  /** 玩家當前 GPS 位置（null = 尚未取得） */
  myPosition: { lat: number; lng: number } | null;
  /** 隊伍佔領狀態（pointId → capture record） */
  captures: TerritoryCapture[];
  /** 倒數剩餘秒數（容器計算傳入；0 / null = 不倒數或已結束） */
  remainingSec: number | null;
  /** 是否時限已到 */
  isTimeUp: boolean;
  /** 玩家按佔領按鈕時呼叫 */
  onCapture: (pointId: string) => void;
  /** 全部結束後玩家按繼續 */
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

export default function TerritoryCapture({
  config,
  myTeamId,
  myPosition,
  captures,
  remainingSec,
  isTimeUp,
  onCapture,
  onComplete,
}: TerritoryCaptureProps) {
  const cooldownMs = (config.cooldownSec ?? 30) * 1000;

  // 排行榜
  const ranking = useMemo(() => computeRanking(captures), [captures]);

  // 我隊在排行榜的位置
  const myRanking = ranking.findIndex((r) => r.teamId === myTeamId);
  const isWinner = ranking.length > 0 && ranking[0].teamId === myTeamId;

  // 點清單 + 距離 + 可否佔領
  const pointStatus = useMemo(() => {
    const now = Date.now();
    return config.points.map((p) => {
      const capture = captures.find((c) => c.pointId === p.id);
      const status = myPosition
        ? canCapturePoint(p, myPosition.lat, myPosition.lng, capture, myTeamId, cooldownMs, now)
        : { capturable: false, reason: "no_gps", distance: 0 };
      return { point: p, capture, status };
    });
  }, [config.points, captures, myPosition, myTeamId, cooldownMs]);

  const handleContinue = () => {
    onComplete(
      config.rewardPoints ? { points: config.rewardPoints } : undefined,
      config.nextPageId,
    );
  };

  // ════════════════════════════════════════════════════════════════
  // 時限到 → 結算畫面
  // ════════════════════════════════════════════════════════════════

  if (isTimeUp) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" data-testid="territory-time-up">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Trophy className="w-10 h-10 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {isWinner ? "你們贏了！" : ranking.length > 0 ? "時限到" : "平手"}
              </h2>
              {ranking[0] && (
                <p className="text-sm text-muted-foreground mt-2">
                  獲勝隊伍佔領 {ranking[0].count} 個地盤
                </p>
              )}
            </div>

            {/* 完整排行榜 */}
            <div className="text-left space-y-1" data-testid="territory-final-ranking">
              {ranking.map((r, i) => (
                <div
                  key={r.teamId}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                    r.teamId === myTeamId ? "bg-primary/10 border border-primary/30" : "bg-muted/30"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {i === 0 && <Crown className="w-4 h-4 text-yellow-500" />}
                    <span className="font-medium">
                      第 {i + 1} 名 {r.teamId === myTeamId && "（你的隊伍）"}
                    </span>
                  </span>
                  <Badge variant="outline">{r.count} 個地盤</Badge>
                </div>
              ))}
            </div>

            <Button className="w-full" size="lg" onClick={handleContinue} data-testid="btn-territory-continue">
              繼續
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // 主畫面：倒數 + 排行榜 + 點清單
  // ════════════════════════════════════════════════════════════════

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="min-h-screen p-4 space-y-4 max-w-md mx-auto"
      data-testid="territory-capture"
      role="region"
      aria-label="多人領土爭奪"
    >
      {/* 標題 + 倒數 */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-center gap-2">
            <Flag className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">{config.title ?? "地盤戰"}</h2>
          </div>
          {config.instruction && (
            <p className="text-sm text-muted-foreground">{config.instruction}</p>
          )}
          {remainingSec !== null && remainingSec >= 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-number tabular-nums" data-testid="territory-remaining">
                剩 {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, "0")}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 排行榜 */}
      {ranking.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">即時排行</p>
            <div className="space-y-1" data-testid="territory-ranking">
              {ranking.map((r, i) => (
                <div
                  key={r.teamId}
                  className={`flex items-center justify-between px-2 py-1.5 rounded ${
                    r.teamId === myTeamId ? "bg-primary/10" : ""
                  }`}
                >
                  <span className="text-sm flex items-center gap-2">
                    {i === 0 && <Crown className="w-3 h-3 text-yellow-500" />}
                    <span>第 {i + 1} 名 {r.teamId === myTeamId && "（你）"}</span>
                  </span>
                  <Badge variant={r.teamId === myTeamId ? "default" : "outline"}>
                    {r.count}
                  </Badge>
                </div>
              ))}
            </div>
            {myRanking === -1 && (
              <p className="text-xs text-muted-foreground italic">
                你的隊伍尚未佔領任何地盤
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 點清單 */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            地盤點（{config.points.length} 個）
          </p>
          {pointStatus.length === 0 && (
            <p className="text-sm text-muted-foreground italic">尚未設定地盤點</p>
          )}
          <div className="space-y-2" data-testid="territory-points">
            {pointStatus.map(({ point, capture, status }) => {
              const isMine = capture?.teamId === myTeamId;
              const isEnemy = capture?.teamId && capture.teamId !== myTeamId;
              return (
                <div
                  key={point.id}
                  className={`p-3 rounded-lg border ${
                    isMine
                      ? "border-primary/40 bg-primary/5"
                      : isEnemy
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-muted/30"
                  }`}
                  data-testid={`territory-point-${point.id}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {point.title}
                    </span>
                    {isMine && <Badge>已佔領</Badge>}
                    {isEnemy && <Badge variant="destructive">敵方</Badge>}
                    {!capture && <Badge variant="outline">中立</Badge>}
                  </div>
                  {myPosition && (
                    <p className="text-xs text-muted-foreground">
                      距離 {Math.round(status.distance)} 公尺
                    </p>
                  )}
                  {status.capturable && (
                    <Button
                      size="sm"
                      className="w-full mt-2 gap-1"
                      onClick={() => onCapture(point.id)}
                      data-testid={`btn-territory-capture-${point.id}`}
                    >
                      <Flag className="w-3 h-3" />
                      {isEnemy ? "奪回" : "佔領"}
                    </Button>
                  )}
                  {status.reason === "cooldown" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      冷卻中（避免來回搶）
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {!myPosition && (
        <Card className="border-yellow-500/30">
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              📍 等待 GPS 定位中...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
