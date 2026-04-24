import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Navigation, Locate, CheckCircle, AlertCircle, QrCode, Volume2, VolumeX } from "lucide-react";
import type { GpsMissionConfig } from "@shared/schema";
import GpsMissionMap from "./gps-mission/GpsMissionMap";

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

export default function GpsMissionPage({ config, onComplete }: GpsMissionPageProps) {
  const { toast } = useToast();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(config.proximitySound ?? false);
  // 若無有效座標，預設進入 QR fallback UI（元件自適應，不需資料預先補 placeholder）
  const [showQrFallback, setShowQrFallback] = useState(false);
  const [hotZoneMessage, setHotZoneMessage] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  // 到達鎖：避免 watchPosition 連發多次成功 toast + onComplete
  const hasArrivedRef = useRef(false);
  // watchId ref：updateLocation 初次註冊時 watchId 還是 null（stale closure），
  // 改透過 ref 取用最新值
  const watchIdRef = useRef<number | null>(null);

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

  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }, []);

  const getDirectionHint = useCallback((userLat: number, userLng: number): string => {
    const dLat = targetLat - userLat;
    const dLng = targetLng - userLng;
    const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
    
    if (angle >= -22.5 && angle < 22.5) return "往北走";
    if (angle >= 22.5 && angle < 67.5) return "往東北走";
    if (angle >= 67.5 && angle < 112.5) return "往東走";
    if (angle >= 112.5 && angle < 157.5) return "往東南走";
    if (angle >= 157.5 || angle < -157.5) return "往南走";
    if (angle >= -157.5 && angle < -112.5) return "往西南走";
    if (angle >= -112.5 && angle < -67.5) return "往西走";
    if (angle >= -67.5 && angle < -22.5) return "往西北走";
    return "繼續前進";
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

  const updateLocation = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude } = position.coords;
    setUserLocation({ lat: latitude, lng: longitude });
    
    const dist = calculateDistance(latitude, longitude, targetLat, targetLng);
    setDistance(dist);
    setIsLocating(false);
    setError(null);

    if (config.hotZoneHints) {
      if (dist <= targetRadius) {
        setHotZoneMessage("到達了！");
      } else if (dist <= targetRadius * 2) {
        setHotZoneMessage("非常接近了！");
      } else if (dist <= targetRadius * 5) {
        setHotZoneMessage(`快到了！${getDirectionHint(latitude, longitude)}`);
      } else if (dist <= 200) {
        setHotZoneMessage(getDirectionHint(latitude, longitude));
      } else {
        setHotZoneMessage(null);
      }
    }

    // 使用 soundEnabled state（玩家可切換），而非 config.proximitySound（一次性設定）
    if (soundEnabled) {
      playProximityBeep(dist);
    }

    // accuracy 加權：若 GPS 精度差（大於 30m），寬鬆判定到達
    const accuracy = position.coords.accuracy ?? 0;
    const effectiveRadius = targetRadius + Math.min(accuracy * 0.5, 50);

    if (dist <= effectiveRadius && !hasArrivedRef.current) {
      hasArrivedRef.current = true;
      toast({
        title: "到達目標位置!",
        description: config.onSuccess?.message || "任務完成!",
      });
      // 優先用 ref（避免 stale closure）
      const id = watchIdRef.current;
      if (id !== null) {
        navigator.geolocation.clearWatch(id);
        watchIdRef.current = null;
      }
      setTimeout(() => {
        // 🔧 RewardsSection 存 rewardPoints/rewardItems，舊 onSuccess.* 向後相容
        const rewardPoints = (config as unknown as { rewardPoints?: number }).rewardPoints;
        const rewardItems = (config as unknown as { rewardItems?: string[] }).rewardItems ?? [];
        const reward: { points?: number; items?: string[] } = {
          points: rewardPoints ?? config.onSuccess?.points ?? 15,
        };
        const allItems = [
          ...rewardItems.filter((x) => !!x),
          ...(config.onSuccess?.grantItem ? [config.onSuccess.grantItem] : []),
        ];
        if (allItems.length > 0) reward.items = allItems;
        onComplete(reward, config.nextPageId);
      }, 1500);
    }
  }, [calculateDistance, targetLat, targetLng, targetRadius, toast, onComplete, config, getDirectionHint, playProximityBeep, soundEnabled]);

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

  const startWatching = () => {
    // 🛡️ 元件級 graceful：config 沒設有效座標 → 不啟動 GPS，改提示 + 優先 QR fallback
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
    setIsWatching(true);

    // 每次重啟 watching 前重置到達鎖
    hasArrivedRef.current = false;
    const id = navigator.geolocation.watchPosition(
      updateLocation,
      handleLocationError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
    setWatchId(id);
    watchIdRef.current = id;
  };

  const stopWatching = () => {
    const id = watchIdRef.current ?? watchId;
    if (id !== null) {
      navigator.geolocation.clearWatch(id);
      setWatchId(null);
      watchIdRef.current = null;
    }
    setIsWatching(false);
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
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [watchId]);

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
    
    const dLat = targetLat - userLocation.lat;
    const dLng = targetLng - userLocation.lng;
    const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
    
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
    <div className="min-h-full flex flex-col items-center justify-center p-6">
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

          {hotZoneMessage && (
            <div className={`text-center mb-4 p-3 rounded-lg animate-pulse ${
              distance && distance <= targetRadius * 2
                ? "bg-success/20 text-success border border-success/30"
                : "bg-primary/20 text-primary border border-primary/30"
            }`}>
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

          <div className="bg-accent/50 border border-border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">距離目標</span>
              <span className={`font-number text-2xl ${isAtTarget ? "text-success" : "text-primary"}`}>
                {getDistanceDisplay()}
              </span>
            </div>
            <Progress value={getProgressPercent()} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              需要在 {targetRadius}m 範圍內
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
                  className="flex-1 gap-2"
                  data-testid="button-stop-watching"
                >
                  停止追蹤
                </Button>
              ) : (
                <Button 
                  onClick={startWatching}
                  className="flex-1 gap-2"
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
                  data-testid="button-toggle-sound"
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

            {(showQrFallback || config.qrFallback) && (
              <Button
                variant="secondary"
                onClick={() => {
                  // 真正的 QR fallback：要求玩家手動輸入 config.fallbackQrCode
                  const expected = (config.fallbackQrCode || "").trim();
                  if (!expected) {
                    toast({
                      title: "QR Fallback 未設定",
                      description: "管理員尚未設定備用 QR 代碼，請稍後再試",
                      variant: "destructive",
                    });
                    return;
                  }
                  const input = prompt("請輸入現場 QR Code 代碼：")?.trim();
                  if (!input) return;
                  if (input.toUpperCase() === expected.toUpperCase()) {
                    toast({
                      title: "QR 確認成功!",
                      description: "已通過備用驗證",
                    });
                    stopWatching();
                    setTimeout(() => {
                      // 🔧 同上：RewardsSection 的 rewardPoints/rewardItems 優先
                      const rewardPoints = (config as unknown as { rewardPoints?: number }).rewardPoints;
                      const rewardItems = (config as unknown as { rewardItems?: string[] }).rewardItems ?? [];
                      const reward: { points?: number; items?: string[] } = {
                        points: rewardPoints ?? config.onSuccess?.points ?? 15,
                      };
                      const allItems = [
                        ...rewardItems.filter((x) => !!x),
                        ...(config.onSuccess?.grantItem ? [config.onSuccess.grantItem] : []),
                      ];
                      if (allItems.length > 0) reward.items = allItems;
                      onComplete(reward, config.nextPageId);
                    }, 800);
                  } else {
                    toast({
                      title: "QR 代碼錯誤",
                      description: "請確認代碼是否正確",
                      variant: "destructive",
                    });
                  }
                }}
                className="w-full gap-2"
                data-testid="button-qr-fallback"
              >
                <QrCode className="w-4 h-4" />
                無法定位？輸入現場 QR 代碼
              </Button>
            )}
          </div>

          {userLocation && (
            <div className="mt-4 text-center text-xs text-muted-foreground">
              <p>你的位置: {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
