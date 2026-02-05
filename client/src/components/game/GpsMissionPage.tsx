import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Navigation, Locate, CheckCircle, AlertCircle, QrCode, Volume2, VolumeX } from "lucide-react";
import type { GpsMissionConfig } from "@shared/schema";

interface GpsMissionPageProps {
  config: GpsMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: any) => void;
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
  const [showQrFallback, setShowQrFallback] = useState(false);
  const [hotZoneMessage, setHotZoneMessage] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBeepTimeRef = useRef<number>(0);

  const targetLat = config.targetLocation?.lat ?? config.targetLatitude ?? 0;
  const targetLng = config.targetLocation?.lng ?? config.targetLongitude ?? 0;
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

    if (config.proximitySound) {
      playProximityBeep(dist);
    }

    if (dist <= targetRadius) {
      toast({
        title: "到達目標位置!",
        description: config.onSuccess?.message || "任務完成!",
      });
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      setTimeout(() => {
        const reward: { points?: number; items?: string[] } = { 
          points: config.onSuccess?.points || 15 
        };
        if (config.onSuccess?.grantItem) {
          reward.items = [config.onSuccess.grantItem];
        }
        onComplete(reward);
      }, 1500);
    }
  }, [calculateDistance, targetLat, targetLng, targetRadius, watchId, toast, onComplete, config, getDirectionHint, playProximityBeep]);

  const handleLocationError = useCallback((err: GeolocationPositionError) => {
    setIsLocating(false);
    let message = "無法取得你的位置";
    switch (err.code) {
      case err.PERMISSION_DENIED:
        message = "請允許位置存取權限";
        break;
      case err.POSITION_UNAVAILABLE:
        message = "無法取得位置資訊";
        if (config.qrFallback) {
          setShowQrFallback(true);
        }
        break;
      case err.TIMEOUT:
        message = "定位請求超時";
        break;
    }
    setError(message);
  }, [config.qrFallback]);

  const startWatching = () => {
    if (!navigator.geolocation) {
      setError("你的瀏覽器不支援定位功能");
      if (config.qrFallback) setShowQrFallback(true);
      return;
    }

    setIsLocating(true);
    setError(null);
    setIsWatching(true);

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
  };

  const stopWatching = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
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
                  toast({
                    title: "QR 掃描確認",
                    description: "請掃描現場的 QR Code 來確認到達",
                  });
                }}
                className="w-full gap-2"
                data-testid="button-qr-fallback"
              >
                <QrCode className="w-4 h-4" />
                無法定位？掃描 QR 確認
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
