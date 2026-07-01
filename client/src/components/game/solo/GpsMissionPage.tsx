import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Navigation, Locate, CheckCircle, AlertCircle, QrCode, Volume2, VolumeX } from "lucide-react";
import type { GpsMissionConfig } from "@shared/schema";
import GpsMissionMap from "../gps-mission/GpsMissionMap";
import {
  useTeamGpsFusion,
  distanceMeters,
  bearingDegrees,
  bearingToCompass,
  type StablePosition,
} from "@/lib/geolocation";
import { GpsAccuracyIndicator } from "../GpsAccuracyIndicator";
import { MotionPermissionRequest } from "../MotionPermissionRequest";
import { useCompassHeading } from "@/hooks/useCompassHeading";
import { useAuth } from "@/hooks/useAuth";
import { useComponentTelemetry } from "@/hooks/useComponentTelemetry";
import { InlineCodeFallback } from "@/components/location/InlineCodeFallback";

interface GpsMissionPageProps {
  config: GpsMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: unknown) => void;
}

const PROXIMITY_SOUNDS = {
  far: 2000,
  medium: 1000,
  close: 500,
  veryClose: 200,
};

export default function GpsMissionPage({ config, onComplete, sessionId }: GpsMissionPageProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  // 📊 Phase 1 telemetry
  const tele = useComponentTelemetry({
    componentType: "gps_mission",
    sessionId, userId: user?.id,
  });

  // 🤝 取得當前 session 的 teamId（若有，啟用多人融合）
  const { data: sessionData } = useQuery<{ teamId: string | null; teamName: string | null }>({
    queryKey: ["/api/sessions", sessionId],
    enabled: !!sessionId,
    staleTime: 60_000, // 1 分鐘快取
  });
  const teamId = sessionData?.teamId ?? null;
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(config.proximitySound ?? false);
  // 🧭 修 bug（ProPlan CHITO #7）：原本指向標只用 GPS 方位角、沒納入手機朝向、
  // 玩家轉手機時箭頭相對真實世界反向偏移。改用羅盤 heading 做相對修正（同 GpsMissionMap）。
  const compass = useCompassHeading();
  // 若無有效座標，預設進入 QR fallback UI（元件自適應，不需資料預先補 placeholder）
  const [showQrFallback, setShowQrFallback] = useState(false);
  const [hotZoneMessage, setHotZoneMessage] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  // 到達鎖：避免 watchPosition 連發多次成功 toast + onComplete
  const hasArrivedRef = useRef(false);
  // ⚠️ watchId 由 useStableGeolocation 內部管理，這邊不需 state

  // 🎯 座標容錯：config 缺座標或填 0/null → 元件自動辨識為「未設定」
  // 不依賴資料預先填 placeholder；元件自己 graceful degradation
  const rawLat = config.targetLocation?.lat ?? config.targetLatitude;
  const rawLng = config.targetLocation?.lng ?? config.targetLongitude;
  const hasValidTarget =
    typeof rawLat === "number" && typeof rawLng === "number"
      && !Number.isNaN(rawLat) && !Number.isNaN(rawLng)
      && !(rawLat === 0 && rawLng === 0); // (0,0) 視為未設定
  const targetLat = hasValidTarget ? (rawLat as number) : 0;
  const targetLng = hasValidTarget ? (rawLng as number) : 0;
  const targetRadius = config.radius || 50;

  // 🌐 統一用 lib/geolocation 的 distanceMeters（避免三份 Haversine 各自實作）
  const calculateDistance = useCallback(distanceMeters, []);

  const getDirectionHint = useCallback((userLat: number, userLng: number): string => {
    const bearing = bearingDegrees(userLat, userLng, targetLat, targetLng);
    return `往${bearingToCompass(bearing)}走`;
  }, [targetLat, targetLng]);

  const playProximityBeep = useCallback((dist: number) => {
    if (!soundEnabled) return;
    
    const now = Date.now();
    let interval = PROXIMITY_SOUNDS.far;
    
    if (dist <= 20) interval = PROXIMITY_SOUNDS.veryClose;
    else if (dist <= 50) interval = PROXIMITY_SOUNDS.close;
    else if (dist <= 100) interval = PROXIMITY_SOUNDS.medium;
    
    if (now - lastBeepTimeRef.current < interval) return;
    lastBeepTimeRef.current = now;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      const frequency = Math.min(800, 400 + (1 - dist / 200) * 400);
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      
      gainNode.gain.value = 0.1;
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // 音效不支援，靜默忽略
    }
  }, [soundEnabled]);

  // 🛰️ 處理穩定後的 GPS 位置（從 useStableGeolocation 來）
  const handleStableLocation = useCallback((pos: StablePosition) => {
    setUserLocation({ lat: pos.lat, lng: pos.lng });

    const dist = calculateDistance(pos.lat, pos.lng, targetLat, targetLng);
    setDistance(dist);
    setIsLocating(false);
    setError(null);

    if (config.hotZoneHints) {
      if (dist <= targetRadius) {
        setHotZoneMessage("到達了！");
      } else if (dist <= targetRadius * 2) {
        setHotZoneMessage("非常接近了！");
      } else if (dist <= targetRadius * 5) {
        setHotZoneMessage(`快到了！${getDirectionHint(pos.lat, pos.lng)}`);
      } else if (dist <= 200) {
        setHotZoneMessage(getDirectionHint(pos.lat, pos.lng));
      } else {
        setHotZoneMessage(null);
      }
    }

    if (soundEnabled) {
      playProximityBeep(dist);
    }

    // 🎯 accuracy 加權：若 GPS 精度差，寬鬆判定（最多放寬 50m）
    // pos.accuracy 已經是經 Kalman 濾波後的等效精度（比單次採樣更穩）
    const effectiveRadius = targetRadius + Math.min(pos.accuracy * 0.5, 50);

    // 額外條件：採樣數 ≥ 2 才允許判定到達（避免暖機期誤判）
    //   2026-05-10: 從 ≥ 3 放寬到 ≥ 2、配合即時模式 sampleSize=3 + 玩家移動可能還沒填滿緩衝就到達
    //   locateOnce 模式（samplesUsed=1）仍允許直接到達
    const requireMultipleSamples = pos.samplesUsed > 1;
    if (
      (!requireMultipleSamples || pos.samplesUsed >= 2) &&
      dist <= effectiveRadius &&
      !hasArrivedRef.current
    ) {
      hasArrivedRef.current = true;
      toast({
        title: "到達目標位置!",
        description: config.onSuccess?.message || "任務完成!",
      });
      setIsWatching(false); // 觸發 hook cleanup
      setTimeout(() => {
        const rewardPoints = (config as unknown as { rewardPoints?: number }).rewardPoints;
        const rewardItems = (config as unknown as { rewardItems?: string[] }).rewardItems ?? [];
        const reward: { points?: number; items?: string[] } = {
          points: rewardPoints ?? config.onSuccess?.points ?? 0,
        };
        const allItems = [
          ...rewardItems.filter((x) => !!x),
          ...(config.onSuccess?.grantItem ? [config.onSuccess.grantItem] : []),
        ];
        if (allItems.length > 0) reward.items = allItems;
        tele.reportComplete("completed");
        onComplete(reward, config.nextPageId);
      }, 1500);
    }
  }, [calculateDistance, targetLat, targetLng, targetRadius, toast, onComplete, config, getDirectionHint, playProximityBeep, soundEnabled]);

  // ⚠️ 向後相容：保留 updateLocation 給 locateOnce 用
  const updateLocation = useCallback((position: GeolocationPosition) => {
    handleStableLocation({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy ?? 50,
      timestamp: position.timestamp,
      smoothed: false,
      samplesUsed: 1,
    });
  }, [handleStableLocation]);

  const handleLocationError = useCallback((err: GeolocationPositionError) => {
    setIsLocating(false);
    let message = "無法取得你的位置";
    switch (err.code) {
      case err.PERMISSION_DENIED:
        message = "請允許位置存取權限";
        break;
      case err.POSITION_UNAVAILABLE:
        message = "無法取得位置資訊";
        break;
      case err.TIMEOUT:
        message = "定位請求超時";
        break;
    }
    setError(message);
    // 所有錯誤分支都顯示 QR fallback（原本只有 POSITION_UNAVAILABLE 顯示）
    if (config.qrFallback) {
      setShowQrFallback(true);
    }
  }, [config.qrFallback]);

  // 🛰️ 整合 useTeamGpsFusion：個人 GPS 穩定化 + 隊伍多人融合
  // - 有 teamId → 自動廣播 GPS 給隊友 + 接收隊友 GPS 融合（誤差降 √N 倍）
  // - 無 teamId → 退化為個人 GPS（仍有多採樣 + Kalman）
  const {
    position: stablePosition,
    accuracy: gpsAccuracy,
    quality: gpsQuality,
    samples: gpsSamples,
    active: gpsActive,
    contributors: gpsContributors,
    scattered: gpsScattered,
    improvementRatio: gpsImprovementRatio,
    imuActive: gpsImuActive,
    imuSteps: gpsImuSteps,
    error: gpsError,
  } = useTeamGpsFusion({
    teamId,
    userId: user?.id ?? null,
    userName: user?.firstName || "玩家",
    enabled: isWatching && hasValidTarget,
    // 🚀 2026-05-10: 導航即時模式 — 距離隨速度變化（修「1m, 1m 慢慢減」bug）
    //   原預設 sampleSize=5 / smoothingFactor=0.3 / interval=1000 是給「站定打卡」設計
    //   導航中需要立即反映位移、不能保留舊值權重
    sampleSize: 3,             // 5 → 3（少 2 個樣本緩衝）
    smoothingFactor: 0,        // 0.3 → 0（不保留舊值、新樣本即生效）
    minSampleIntervalMs: 500,  // 1000 → 500（每秒 2 樣、距離更新更頻繁）
    imuFallback: true,         // 🧭 啟用 IMU fallback，GPS 失效時自動切換
  });

  // 把 stable position 的更新推給 handleStableLocation
  useEffect(() => {
    if (stablePosition && isWatching) {
      handleStableLocation(stablePosition);
    }
  }, [stablePosition, isWatching, handleStableLocation]);

  // 把 GPS error 推給 handler
  useEffect(() => {
    if (gpsError) {
      handleLocationError(gpsError);
    }
  }, [gpsError, handleLocationError]);

  const startWatching = () => {
    if (!hasValidTarget) {
      setError("此任務尚未設定目標位置，請使用下方代碼手動通關或聯絡管理員");
      setShowQrFallback(true);
      return;
    }
    if (!navigator.geolocation) {
      setError("你的瀏覽器不支援定位功能");
      if (config.qrFallback) setShowQrFallback(true);
      return;
    }

    setIsLocating(true);
    setError(null);
    hasArrivedRef.current = false;
    setIsWatching(true); // hook 會自動啟動 watchPosition
  };

  const stopWatching = () => {
    setIsWatching(false); // hook 會自動 clearWatch
  };

  const locateOnce = () => {
    if (!navigator.geolocation) {
      setError("你的瀏覽器不支援定位功能");
      return;
    }

    setIsLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      updateLocation,
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    return () => {
      // hook 自己會 clearWatch，這裡只清理音訊
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // 🧭 iOS 需 user gesture 觸發 compass.request()（同 GpsMissionMap）
  useEffect(() => {
    if (!compass.supported || compass.granted) return;
    const tryRequest = () => {
      void compass.request();
    };
    document.addEventListener("pointerdown", tryRequest, { once: true, passive: true });
    document.addEventListener("touchstart", tryRequest, { once: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", tryRequest);
      document.removeEventListener("touchstart", tryRequest);
    };
  }, [compass.supported, compass.granted, compass]);

  const getProgressPercent = () => {
    if (!distance) return 0;
    const maxDisplayDistance = 1000;
    if (distance <= targetRadius) return 100;
    const progress = Math.max(0, 100 - ((distance - targetRadius) / maxDisplayDistance) * 100);
    return Math.min(100, progress);
  };

  const getDistanceDisplay = () => {
    if (!distance) return "—";
    if (distance < 1000) {
      return `${Math.round(distance)} m`;
    }
    return `${(distance / 1000).toFixed(2)} km`;
  };

  const getDirectionArrow = () => {
    if (!userLocation) return null;

    // 🧭 修 bug（ProPlan CHITO #7）：地理方位角（0=北、順時針）用含緯度修正的 bearingDegrees、
    // 再減去手機羅盤朝向 → 相對角度。玩家轉手機時箭頭同步跟著轉、正確指向真實目標。
    // 無羅盤（桌機/未授權）時 fallback 用絕對方位角（維持原可用性）。
    const targetBearing = bearingDegrees(userLocation.lat, userLocation.lng, targetLat, targetLng);
    const angle = compass.heading === null
      ? targetBearing
      : (targetBearing - compass.heading + 360) % 360;

    return (
      <div 
        className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center transition-transform duration-300"
        style={{ transform: `rotate(${angle}deg)` }}
      >
        <Navigation className="w-8 h-8 text-primary" />
      </div>
    );
  };

  const isAtTarget = distance !== null && distance <= targetRadius;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="min-h-full flex flex-col items-center justify-center p-6"
    >
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            {isAtTarget ? (
              <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4 animate-scaleIn">
                <CheckCircle className="w-10 h-10 text-success" />
              </div>
            ) : (
              <div className="mb-4 flex justify-center">
                {userLocation ? getDirectionArrow() : (
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-primary" />
                  </div>
                )}
              </div>
            )}
            
            <h2 className="text-xl font-display font-bold mb-2">
              {isAtTarget ? "到達目標!" : (config.title || "GPS 導航任務")}
            </h2>
            <p className="text-muted-foreground">{config.instruction}</p>
          </div>

          {/* 🧭 iOS 14+ 動作感應器授權請求（GPS 失效備援）*/}
          {isWatching && (
            <div className="mb-4">
              <MotionPermissionRequest />
            </div>
          )}

          {/* 🛰️ GPS 精度即時顯示 + 多人融合徽章 + IMU fallback（玩家可見） */}
          {isWatching && (
            <div className="mb-4">
              <GpsAccuracyIndicator
                accuracy={gpsAccuracy}
                quality={gpsQuality}
                samples={gpsSamples}
                active={gpsActive}
                fusion={teamId ? {
                  contributors: gpsContributors,
                  scattered: gpsScattered,
                  improvementRatio: gpsImprovementRatio,
                } : undefined}
                imu={{
                  active: gpsImuActive,
                  steps: gpsImuSteps,
                }}
              />
            </div>
          )}

          {hotZoneMessage && (
            <div
              className={`text-center mb-4 p-3 rounded-lg animate-pulse ${
                distance && distance <= targetRadius * 2
                  ? "bg-success/20 text-success border border-success/30"
                  : "bg-primary/20 text-primary border border-primary/30"
              }`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="font-bold text-lg">{hotZoneMessage}</p>
            </div>
          )}

          {/* showMap 開啟時顯示地圖（目標點 + 觸發半徑 + 玩家位置） */}
          {config.showMap && (
            <div className="mb-4">
              <GpsMissionMap
                targetLat={targetLat}
                targetLng={targetLng}
                radius={targetRadius}
                userLat={userLocation?.lat ?? null}
                userLng={userLocation?.lng ?? null}
              />
            </div>
          )}

          {/* 🆕 進入範圍 → 整體變綠（border + bg），未到 → 中性 */}
          <div
            className={`border rounded-lg p-4 mb-6 transition-colors ${
              isAtTarget
                ? "bg-success/10 border-success/40"
                : "bg-accent/50 border-border"
            }`}
            data-at-target={isAtTarget}
            role="status"
            aria-live={isAtTarget ? "assertive" : "off"}
            aria-atomic="true"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">距離目標</span>
              <span
                className={`font-number text-2xl tabular-nums transition-colors ${isAtTarget ? "text-success" : "text-primary"}`}
                aria-label={`距離目標 ${getDistanceDisplay()}`}
              >
                {getDistanceDisplay()}
              </span>
            </div>
            <Progress
              value={getProgressPercent()}
              className="h-2 transition-all"
              aria-label={`抵達進度 ${Math.round(getProgressPercent())}%`}
            />
            <p className="text-xs text-muted-foreground mt-2 text-center tabular-nums">
              {isAtTarget ? "✨ 已進入範圍！" : `需要在 ${targetRadius}m 範圍內`}
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex gap-2">
              {isWatching ? (
                <Button
                  onClick={stopWatching}
                  variant="outline"
                  className="flex-1 gap-2 transition-transform active:scale-[0.97]"
                  data-testid="button-stop-watching"
                >
                  停止追蹤
                </Button>
              ) : (
                <Button
                  onClick={startWatching}
                  className="flex-1 gap-2 transition-transform active:scale-[0.97]"
                  disabled={isLocating}
                  data-testid="button-start-tracking"
                >
                  {isLocating ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Navigation className="w-4 h-4" />
                  )}
                  {isLocating ? "定位中..." : "開始導航"}
                </Button>
              )}

              {config.proximitySound && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="transition-transform active:scale-[0.92]"
                  data-testid="button-toggle-sound"
                  aria-label={soundEnabled ? "關閉音效" : "開啟音效"}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
              )}
            </div>
            
            <Button 
              variant="outline"
              onClick={locateOnce}
              disabled={isLocating}
              className="w-full gap-2"
              data-testid="button-locate-once"
            >
              <Locate className="w-4 h-4" />
              單次定位
            </Button>

            {/* 🆕 2026-05-22 多元定位備援 — 取代舊 prompt UX */}
            {(showQrFallback || config.qrFallback) && config.fallbackQrCode && (
              <InlineCodeFallback
                expectedCode={config.fallbackQrCode}
                onPass={() => {
                  stopWatching();
                  setTimeout(() => {
                    // 跟原流程一致：優先讀 RewardsSection 設定
                    const rewardPoints = (config as unknown as { rewardPoints?: number }).rewardPoints;
                    const rewardItems = (config as unknown as { rewardItems?: string[] }).rewardItems ?? [];
                    const reward: { points?: number; items?: string[] } = {
                      points: rewardPoints ?? config.onSuccess?.points ?? 0,
                    };
                    const allItems = [
                      ...rewardItems.filter((x) => !!x),
                      ...(config.onSuccess?.grantItem ? [config.onSuccess.grantItem] : []),
                    ];
                    if (allItems.length > 0) reward.items = allItems;
                    tele.reportComplete("completed");
                    onComplete(reward, config.nextPageId);
                  }, 800);
                }}
              />
            )}
            {(showQrFallback || config.qrFallback) && !config.fallbackQrCode && (
              <p className="text-xs text-amber-600 text-center" data-testid="text-no-fallback-code">
                ⚠ 管理員尚未設定備用代碼
              </p>
            )}
          </div>

          {userLocation && (
            <div className="mt-4 text-center text-xs text-muted-foreground">
              <p>你的位置: {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
