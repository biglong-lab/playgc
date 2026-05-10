// 🤝 多人同隊 GPS 融合 Hook
//
// 用法（GpsMissionPage / PhotoSpotFlow）：
//   const { position, accuracy, contributors, scattered } = useTeamGpsFusion({
//     teamId,        // 同隊識別（用 useTeamWebSocket 連線）
//     userId,        // 自己的 userId
//     userName,      // 顯示名稱
//     enabled: true, // 在 GPS 任務時啟用
//   });
//
// 原理：
//   1. 每個玩家自己跑 useStableGeolocation（多採樣 + Kalman）
//   2. 透過 useTeamWebSocket 廣播給隊友（每 2 秒一次）
//   3. 收到隊友 GPS → 加入 fusion 池
//   4. 用 fuseTeamGps 融合（反方差加權平均）
//   5. 隊友分散時自動退化為單機定位（不勉強融合）

import { useCallback, useEffect, useRef, useState } from "react";
import { useStableGeolocation, type StablePosition } from "./useStableGeolocation";
import { fuseTeamGps, GPS_BROADCAST_INTERVAL_MS, type FusionSample, type FusionResult } from "./fusion-utils";
import { classifyAccuracy, type GpsQuality } from "./geo-utils";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";

export interface UseTeamGpsFusionOptions {
  /** 隊伍 ID（沒有則退化為單機定位）*/
  teamId?: string | null;
  /** 自己的 userId */
  userId?: string | null;
  /** 顯示名稱（給隊友看）*/
  userName?: string | null;
  /** 是否啟用（預設 true；切換頁面時可關閉省電）*/
  enabled?: boolean;
  /** 採樣大小（傳給 useStableGeolocation）*/
  sampleSize?: number;
  /** 🧭 IMU PDR fallback（GPS 失效時用步數推算位置）*/
  imuFallback?: boolean;
  /**
   * 🆕 2026-05-10: 平滑強度（0-1、預設 0.3）
   * 0 = 完全不平滑（移動 / 導航時即時反映）
   * 0.3 = 預設（保留 30% 舊值權重、適合站定打卡）
   * 0.7+ = 重平滑（GPS 抖動嚴重時）
   */
  smoothingFactor?: number;
  /**
   * 🆕 2026-05-10: 採樣間隔毫秒（預設 1000、即每秒 1 個樣本）
   * 移動 / 導航場景建議 500（每秒 2 個樣本、距離更即時）
   */
  minSampleIntervalMs?: number;
}

export interface UseTeamGpsFusionResult {
  /** 融合後位置（自動退化為個人位置如果隊友分散）*/
  position: StablePosition | null;
  /** 個人 GPS 位置（不融合）*/
  personalPosition: StablePosition | null;
  /** 融合後 accuracy */
  accuracy: number | null;
  /** 精度等級 */
  quality: GpsQuality;
  /** 融合用了幾個玩家（含自己）*/
  contributors: number;
  /** 隊友是否分散（true = 沒做融合）*/
  scattered: boolean;
  /** 融合提升幅度（0-1）*/
  improvementRatio: number;
  /** 個人 GPS 採樣數 */
  samples: number;
  /** GPS 是否運作 */
  active: boolean;
  /** WebSocket 是否連線 */
  wsConnected: boolean;
  /** 錯誤訊息 */
  error: GeolocationPositionError | null;
  /** 🧭 IMU 是否正在補位（GPS 失效時 true）*/
  imuActive: boolean;
  /** IMU 累積步數 */
  imuSteps: number;
}

export function useTeamGpsFusion(
  options: UseTeamGpsFusionOptions,
): UseTeamGpsFusionResult {
  const {
    teamId,
    userId,
    userName,
    enabled = true,
    sampleSize = 5,
    imuFallback = false,
    smoothingFactor = 0.3,
    minSampleIntervalMs = 1000,
  } = options;

  // 1. 個人 GPS（多採樣 + Kalman + 可選 IMU fallback）
  const {
    position: personalPosition,
    accuracy: personalAccuracy,
    samples,
    active,
    error,
    imuActive,
    imuSteps,
  } = useStableGeolocation({
    mode: "watch",
    enabled,
    sampleSize,
    minSampleIntervalMs,
    smoothingFactor,
    imuFallback,
  });

  // 2. 隊伍 WebSocket（用既有 hook）
  const { isConnected: wsConnected, memberLocations, sendLocation } = useTeamWebSocket({
    teamId: teamId ?? undefined,
    userId: userId ?? undefined,
    userName: userName ?? undefined,
  });

  // 3. 融合結果
  const [fusionResult, setFusionResult] = useState<FusionResult | null>(null);

  // 4. 廣播自己 GPS（throttled）
  const lastBroadcastAtRef = useRef<number>(0);
  useEffect(() => {
    if (!enabled || !personalPosition || !wsConnected || !teamId || !userId) return;

    const now = Date.now();
    if (now - lastBroadcastAtRef.current < GPS_BROADCAST_INTERVAL_MS) return;
    lastBroadcastAtRef.current = now;

    sendLocation(personalPosition.lat, personalPosition.lng, personalPosition.accuracy);
  }, [enabled, personalPosition, wsConnected, teamId, userId, sendLocation]);

  // 5. 融合計算（自己 + 隊友）
  const calculateFusion = useCallback(() => {
    if (!personalPosition || !userId) return;

    const mySample: FusionSample = {
      userId,
      lat: personalPosition.lat,
      lng: personalPosition.lng,
      accuracy: personalPosition.accuracy,
      timestamp: personalPosition.timestamp,
    };

    // 把 memberLocations 轉成 FusionSample[]
    const teamSamples: FusionSample[] = [];
    memberLocations.forEach((loc, uid) => {
      if (uid === userId) return; // 跳過自己
      const ts = new Date(loc.timestamp).getTime();
      if (Number.isNaN(ts)) return;
      teamSamples.push({
        userId: uid,
        lat: loc.latitude,
        lng: loc.longitude,
        accuracy: loc.accuracy,
        timestamp: ts,
      });
    });

    const result = fuseTeamGps(mySample, teamSamples);
    setFusionResult(result);
  }, [personalPosition, userId, memberLocations]);

  // 重算融合（個人 GPS 更新 / 隊友更新時）
  useEffect(() => {
    calculateFusion();
  }, [calculateFusion]);

  // 6. 整合結果
  const fusedPosition: StablePosition | null = fusionResult && personalPosition
    ? {
        lat: fusionResult.lat,
        lng: fusionResult.lng,
        accuracy: fusionResult.accuracy,
        timestamp: personalPosition.timestamp,
        smoothed: true,
        samplesUsed: fusionResult.contributors,
      }
    : personalPosition;

  const finalAccuracy = fusionResult?.accuracy ?? personalAccuracy;
  const quality = classifyAccuracy(finalAccuracy);

  return {
    position: fusedPosition,
    personalPosition,
    accuracy: finalAccuracy,
    quality,
    contributors: fusionResult?.contributors ?? 1,
    scattered: fusionResult?.scattered ?? false,
    improvementRatio: fusionResult?.improvementRatio ?? 0,
    samples,
    active,
    wsConnected,
    error,
    imuActive,
    imuSteps,
  };
}
