import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Location, Game } from "@shared/schema";
import { 
  MapPin, Navigation, Target, Save, RefreshCw, 
  ChevronLeft, CheckCircle, Crosshair, Loader2,
  QrCode, ArrowLeft
} from "lucide-react";

interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export default function LocationEditor() {
  const { gameId } = useParams<{ gameId: string }>();
  const [, setPath] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [currentPosition, setCurrentPosition] = useState<GeoPosition | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  const { data: game } = useQuery<Game>({
    queryKey: ["/api/games", gameId],
    enabled: !!gameId,
  });

  const { data: locations, isLoading: locationsLoading } = useQuery<Location[]>({
    queryKey: ["/api/games", gameId, "locations"],
    enabled: !!gameId,
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({ locationId, data }: { locationId: number; data: Partial<Location> }) => {
      const response = await apiRequest("PATCH", `/api/locations/${locationId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "locations"] });
      toast({
        title: "位置已更新",
        description: "GPS 座標已成功儲存",
      });
      setSelectedLocationId(null);
    },
    onError: () => {
      toast({
        title: "更新失敗",
        description: "無法儲存座標，請重試",
        variant: "destructive",
      });
    },
  });

  const startWatchingPosition = () => {
    if (!navigator.geolocation) {
      toast({
        title: "不支援 GPS",
        description: "您的裝置不支援 GPS 定位",
        variant: "destructive",
      });
      return;
    }

    setIsWatching(true);
    const id = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        toast({
          title: "定位失敗",
          description: getGeolocationError(error),
          variant: "destructive",
        });
        setIsWatching(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
    setWatchId(id);
  };

  const stopWatchingPosition = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsWatching(false);
  };

  const getGeolocationError = (error: GeolocationPositionError) => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "請允許存取您的位置";
      case error.POSITION_UNAVAILABLE:
        return "無法取得位置資訊";
      case error.TIMEOUT:
        return "定位逾時，請重試";
      default:
        return "未知錯誤";
    }
  };

  const saveCurrentPosition = () => {
    if (!selectedLocationId || !currentPosition) return;

    updateLocationMutation.mutate({
      locationId: selectedLocationId,
      data: {
        latitude: String(currentPosition.latitude),
        longitude: String(currentPosition.longitude),
      },
    });
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy <= 5) return "text-success";
    if (accuracy <= 15) return "text-warning";
    return "text-destructive";
  };

  const getAccuracyLabel = (accuracy: number) => {
    if (accuracy <= 5) return "極佳";
    if (accuracy <= 15) return "良好";
    if (accuracy <= 30) return "普通";
    return "較差";
  };

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    window.location.href = "/";
    return null;
  }

  const selectedLocation = locations?.find(l => l.id === selectedLocationId);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setPath(`/admin`)}
                data-testid="button-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-display font-bold text-lg">現場定位設定</h1>
                <p className="text-xs text-muted-foreground">{game?.title || "載入中..."}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card className="bg-gradient-to-br from-card to-accent/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Navigation className="w-5 h-5 text-primary" />
              GPS 定位狀態
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentPosition ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-background rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">緯度</p>
                    <p className="font-mono text-sm font-medium">
                      {currentPosition.latitude.toFixed(8)}
                    </p>
                  </div>
                  <div className="p-3 bg-background rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">經度</p>
                    <p className="font-mono text-sm font-medium">
                      {currentPosition.longitude.toFixed(8)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">精準度</p>
                    <p className={`font-medium ${getAccuracyColor(currentPosition.accuracy)}`}>
                      ±{currentPosition.accuracy.toFixed(1)} 公尺 ({getAccuracyLabel(currentPosition.accuracy)})
                    </p>
                  </div>
                  {isWatching && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                      <span className="text-xs text-muted-foreground">追蹤中</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">尚未取得位置</p>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              {!isWatching ? (
                <Button 
                  onClick={startWatchingPosition} 
                  className="flex-1 gap-2"
                  data-testid="button-start-gps"
                >
                  <Crosshair className="w-4 h-4" />
                  開始定位
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={stopWatchingPosition} 
                  className="flex-1 gap-2"
                  data-testid="button-stop-gps"
                >
                  <RefreshCw className="w-4 h-4" />
                  停止追蹤
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold">關卡地點 ({locations?.length || 0})</h2>
          </div>

          {locationsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-5 bg-muted rounded w-1/3 mb-2" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : locations && locations.length > 0 ? (
            <div className="space-y-3">
              {locations.map((location, index) => {
                const hasCoords = location.latitude && location.longitude;
                const isSelected = selectedLocationId === location.id;

                return (
                  <Card 
                    key={location.id}
                    className={`transition-all ${isSelected ? "ring-2 ring-primary" : "hover-elevate cursor-pointer"}`}
                    onClick={() => !isSelected && setSelectedLocationId(location.id)}
                    data-testid={`location-card-${index}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-number">
                              #{index + 1}
                            </Badge>
                            <h3 className="font-medium">{location.name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                            {location.description || "無描述"}
                          </p>
                          
                          {hasCoords ? (
                            <div className="flex items-center gap-4 text-xs">
                              <span className="flex items-center gap-1 text-success">
                                <CheckCircle className="w-3 h-3" />
                                已設定座標
                              </span>
                              <span className="font-mono text-muted-foreground">
                                {location.latitude}, {location.longitude}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              尚未設定座標
                            </span>
                          )}
                          
                          {location.qrCodeData && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                              <QrCode className="w-3 h-3" />
                              QR: {location.qrCodeData}
                            </div>
                          )}
                        </div>

                        {isSelected && (
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              disabled={!currentPosition || updateLocationMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                saveCurrentPosition();
                              }}
                              className="gap-1"
                              data-testid="button-save-coords"
                            >
                              {updateLocationMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                              儲存
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLocationId(null);
                              }}
                              data-testid="button-cancel-edit"
                            >
                              取消
                            </Button>
                          </div>
                        )}
                      </div>

                      {isSelected && currentPosition && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">
                            將套用目前 GPS 座標:
                          </p>
                          <div className="flex gap-4 font-mono text-sm">
                            <span>緯度: {currentPosition.latitude.toFixed(8)}</span>
                            <span>經度: {currentPosition.longitude.toFixed(8)}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">此遊戲尚無地點</p>
                <p className="text-sm text-muted-foreground">請先在遊戲編輯器中新增地點</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
