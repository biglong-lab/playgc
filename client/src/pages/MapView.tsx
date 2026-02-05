import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ChevronLeft, 
  Locate, 
  Navigation2, 
  MapPin, 
  Target, 
  AlertCircle,
  Users,
  Compass,
  Timer,
  ExternalLink,
  Lock
} from "lucide-react";
import type { Location, LocationVisit, Page } from "@shared/schema";

declare const L: any;

interface PageLocationSettings {
  enabled?: boolean;
  showOnMap?: boolean;
  markerIcon?: string;
  markerLabel?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

interface PageWithLocation {
  page: Page;
  locationSettings: PageLocationSettings;
}

interface NavigationInfo {
  distance: number;
  bearing: number;
  direction: string;
  estimatedTime: number;
}

interface TeamMemberLocation {
  playerId: string;
  latitude: string;
  longitude: string;
  timestamp: string;
}

export default function MapView() {
  const { gameId, sessionId } = useParams<{ gameId: string; sessionId?: string }>();
  const [, setLocationPath] = useLocation();
  const { toast } = useToast();
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const teamMarkersRef = useRef<Map<string, any>>(new Map());
  const locationMarkersRef = useRef<Map<number, any>>(new Map());
  const pageMarkersRef = useRef<Map<number, any>>(new Map());
  
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [navigationInfo, setNavigationInfo] = useState<NavigationInfo | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  const { data: locations = [], isLoading: locationsLoading } = useQuery<Location[]>({
    queryKey: [`/api/games/${gameId}/locations`],
    enabled: !!gameId,
  });

  const { data: pages = [] } = useQuery<Page[]>({
    queryKey: [`/api/games/${gameId}/pages`],
    enabled: !!gameId,
  });

  const pagesWithLocations: PageWithLocation[] = useMemo(() => {
    return pages
      .filter((page) => {
        const config = page.config as any;
        const ls = config?.locationSettings;
        return ls?.enabled && ls?.showOnMap && ls?.latitude && ls?.longitude;
      })
      .map((page) => {
        const config = page.config as any;
        return {
          page,
          locationSettings: config.locationSettings as PageLocationSettings,
        };
      });
  }, [pages]);

  const { data: visits = [] } = useQuery<LocationVisit[]>({
    queryKey: [`/api/sessions/${sessionId}/visits`],
    enabled: !!sessionId,
    refetchInterval: 10000,
  });

  const { data: teamLocations = [] } = useQuery<TeamMemberLocation[]>({
    queryKey: [`/api/sessions/${sessionId}/team-locations`],
    enabled: !!sessionId,
    refetchInterval: 5000,
  });

  const updateLocationMutation = useMutation({
    mutationFn: async (location: { latitude: number; longitude: number; accuracy?: number; speed?: number; heading?: number }) => {
      if (!sessionId) return;
      return apiRequest('POST', `/api/sessions/${sessionId}/player-location`, location);
    },
  });

  const visitLocationMutation = useMutation({
    mutationFn: async (locationId: number) => {
      if (!sessionId) return;
      return apiRequest('POST', `/api/sessions/${sessionId}/locations/${locationId}/visit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/visits`] });
      queryClient.invalidateQueries({ queryKey: [`/api/games/${gameId}/locations`] });
      toast({
        title: "到達任務點!",
        description: `恭喜你完成了這個位置!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "打卡失敗",
        description: error.message || "無法完成打卡",
        variant: "destructive",
      });
    },
  });

  const visitedLocationIds = new Set(visits.map(v => v.locationId));

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Default to Kinmen/Jiachun area for the reality game
    const defaultCenter: [number, number] = [24.4399, 118.3471];
    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView(defaultCenter, 15);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !locations.length) return;

    locationMarkersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    locationMarkersRef.current.clear();

    // Filter locations with valid coordinates
    const locationsWithCoords = locations.filter(l => l.latitude && l.longitude);
    
    // Auto-center map on first location with coordinates
    if (locationsWithCoords.length > 0 && !userLocation) {
      const firstLoc = locationsWithCoords[0];
      const lat = parseFloat(firstLoc.latitude!);
      const lng = parseFloat(firstLoc.longitude!);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        mapInstanceRef.current.setView([lat, lng], 16);
      }
    }

    locations.forEach((location) => {
      if (!location.latitude || !location.longitude) return;
      const isVisited = visitedLocationIds.has(location.id);
      const lat = parseFloat(location.latitude);
      const lng = parseFloat(location.longitude);
      
      const iconHtml = isVisited ? `
        <div class="w-10 h-10 rounded-full bg-success/80 border-2 border-success flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      ` : `
        <div class="w-10 h-10 rounded-full bg-primary/80 border-2 border-primary flex items-center justify-center marker-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
        </div>
      `;

      const icon = L.divIcon({
        className: "custom-marker",
        html: iconHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
      marker.bindPopup(`
        <div class="font-chinese p-2">
          <strong class="text-lg">${location.name}</strong>
          ${location.description ? `<p class="text-sm text-muted-foreground mt-1">${location.description}</p>` : ''}
          <div class="flex items-center gap-2 mt-2">
            <span class="text-sm">獎勵: +${location.points || 0} 分</span>
            ${isVisited ? '<span class="text-success text-sm">✓ 已完成</span>' : ''}
          </div>
        </div>
      `);
      
      marker.on('click', () => {
        setSelectedLocation(location);
      });

      if (location.radius && location.radius > 0) {
        L.circle([lat, lng], {
          radius: location.radius,
          color: isVisited ? '#22c55e' : '#d97706',
          fillColor: isVisited ? '#22c55e' : '#d97706',
          fillOpacity: 0.1,
          weight: 1,
        }).addTo(mapInstanceRef.current);
      }

      locationMarkersRef.current.set(location.id, marker);
    });
  }, [locations, visits]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    pageMarkersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    pageMarkersRef.current.clear();

    pagesWithLocations.forEach(({ page, locationSettings }) => {
      const lat = typeof locationSettings.latitude === 'string' 
        ? parseFloat(locationSettings.latitude) 
        : locationSettings.latitude!;
      const lng = typeof locationSettings.longitude === 'string' 
        ? parseFloat(locationSettings.longitude) 
        : locationSettings.longitude!;
      
      if (isNaN(lat) || isNaN(lng)) return;
      
      const getPageTypeIcon = (type: string) => {
        switch (type) {
          case 'qr_scan': return '📱';
          case 'shooting_mission': return '🎯';
          case 'photo_mission': return '📷';
          case 'gps_mission': return '📍';
          case 'time_bomb': return '💣';
          case 'lock': return '🔒';
          case 'conditional_verify': return '🧩';
          default: return '📌';
        }
      };

      const iconEmoji = locationSettings.markerIcon || getPageTypeIcon(page.type);
      
      const iconHtml = `
        <div class="w-8 h-8 rounded-full bg-amber-500/80 border-2 border-amber-400 flex items-center justify-center shadow-lg">
          <span class="text-sm">${iconEmoji}</span>
        </div>
      `;

      const icon = L.divIcon({
        className: "page-marker",
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
      
      const label = locationSettings.markerLabel || page.title || `任務 ${page.order}`;
      marker.bindPopup(`
        <div class="font-chinese p-2">
          <strong class="text-lg">${label}</strong>
          <p class="text-sm text-muted-foreground mt-1">頁面: ${page.title || page.type}</p>
          ${locationSettings.radius ? `<p class="text-xs mt-1">範圍: ${locationSettings.radius}m</p>` : ''}
        </div>
      `);

      if (locationSettings.radius && locationSettings.radius > 0) {
        L.circle([lat, lng], {
          radius: locationSettings.radius,
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.1,
          weight: 1,
        }).addTo(mapInstanceRef.current);
      }

      pageMarkersRef.current.set(page.id, marker);
    });
  }, [pagesWithLocations]);

  useEffect(() => {
    if (!mapInstanceRef.current || !teamLocations.length) return;

    teamMarkersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    teamMarkersRef.current.clear();

    teamLocations.forEach((member) => {
      const lat = parseFloat(member.latitude);
      const lng = parseFloat(member.longitude);
      
      const icon = L.divIcon({
        className: "team-marker",
        html: `
          <div class="relative">
            <div class="w-5 h-5 rounded-full bg-green-500 border-2 border-white flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
      marker.bindPopup(`<strong>隊友</strong>`);
      teamMarkersRef.current.set(member.playerId, marker);
    });
  }, [teamLocations]);

  const updateUserMarker = useCallback((lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;

    const icon = L.divIcon({
      className: "user-marker",
      html: `
        <div class="relative">
          <div class="w-6 h-6 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center shadow-lg">
            <div class="w-2 h-2 rounded-full bg-white"></div>
          </div>
          <div class="absolute -inset-2 rounded-full bg-blue-500/30 animate-ping"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([lat, lng]);
    } else {
      userMarkerRef.current = L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
      userMarkerRef.current.bindPopup("<strong>你的位置</strong>");
    }
  }, []);

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
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
  };

  const checkProximityToLocations = useCallback((lat: number, lng: number) => {
    locations.forEach((location) => {
      if (!location.latitude || !location.longitude) return;
      const locLat = parseFloat(location.latitude);
      const locLng = parseFloat(location.longitude);
      const distance = calculateDistance(lat, lng, locLat, locLng);
      const radius = location.radius || 50;

      if (distance <= radius && !visitedLocationIds.has(location.id)) {
        toast({
          title: "接近任務點!",
          description: `你已進入 ${location.name} 的範圍`,
        });
      }
    });
  }, [locations, visitedLocationIds, toast]);

  const handleLocationUpdate = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    setUserLocation({ lat: latitude, lng: longitude, accuracy });
    updateUserMarker(latitude, longitude);
    
    if (sessionId) {
      updateLocationMutation.mutate({
        latitude,
        longitude,
        accuracy: accuracy || undefined,
        speed: speed || undefined,
        heading: heading || undefined,
      });
    }

    checkProximityToLocations(latitude, longitude);

    if (selectedLocation && selectedLocation.latitude && selectedLocation.longitude) {
      const locLat = parseFloat(selectedLocation.latitude);
      const locLng = parseFloat(selectedLocation.longitude);
      const distance = calculateDistance(latitude, longitude, locLat, locLng);
      
      const y = Math.sin((locLng - longitude) * Math.PI / 180) * Math.cos(locLat * Math.PI / 180);
      const x = Math.cos(latitude * Math.PI / 180) * Math.sin(locLat * Math.PI / 180) -
                Math.sin(latitude * Math.PI / 180) * Math.cos(locLat * Math.PI / 180) * 
                Math.cos((locLng - longitude) * Math.PI / 180);
      const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      
      const directions = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];
      const directionIndex = Math.round(bearing / 45) % 8;
      
      setNavigationInfo({
        distance: Math.round(distance),
        bearing: Math.round(bearing),
        direction: directions[directionIndex],
        estimatedTime: Math.ceil(distance / 83.33),
      });
    }
  }, [selectedLocation, sessionId, updateLocationMutation, updateUserMarker, checkProximityToLocations]);

  const locateUser = () => {
    if (!navigator.geolocation) {
      setLocationError("你的瀏覽器不支援定位功能");
      toast({
        title: "定位失敗",
        description: "你的瀏覽器不支援定位功能",
        variant: "destructive",
      });
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleLocationUpdate(position);
        
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([position.coords.latitude, position.coords.longitude], 17);
        }

        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        let message = "無法取得你的位置";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "請允許位置存取權限";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "無法取得位置資訊";
            break;
          case error.TIMEOUT:
            message = "定位請求超時";
            break;
        }
        setLocationError(message);
        toast({
          title: "定位失敗",
          description: message,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const startContinuousTracking = () => {
    if (!navigator.geolocation) return;
    
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }

    const id = navigator.geolocation.watchPosition(
      handleLocationUpdate,
      () => {
        // 定位錯誤由 UI 處理
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
    
    setWatchId(id);
    toast({
      title: "持續追蹤已開啟",
      description: "你的位置會自動更新",
    });
  };

  const stopContinuousTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      toast({
        title: "持續追蹤已關閉",
      });
    }
  };

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const openExternalNavigation = useCallback(() => {
    if (!selectedLocation || !selectedLocation.latitude || !selectedLocation.longitude) return;
    
    const lat = parseFloat(selectedLocation.latitude);
    const lng = parseFloat(selectedLocation.longitude);
    const label = encodeURIComponent(selectedLocation.name);
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS 
      ? `maps://maps.apple.com/?q=${label}&ll=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    
    window.open(url, '_blank');
  }, [selectedLocation]);

  const handleVisitLocation = async () => {
    if (!selectedLocation || !userLocation || !sessionId) return;
    
    try {
      const response = await apiRequest('POST', '/api/navigation/check-proximity', {
        locationId: selectedLocation.id,
        playerLat: userLocation.lat,
        playerLng: userLocation.lng,
      });
      const proximityData = await response.json();
      
      if (!proximityData.isWithinRange) {
        toast({
          title: "距離太遠",
          description: `你需要更接近才能打卡 (距離: ${proximityData.distance}m, 需要: ${proximityData.radius}m內)`,
          variant: "destructive",
        });
        return;
      }

      visitLocationMutation.mutate(selectedLocation.id);
      setSelectedLocation(null);
    } catch (error: any) {
      toast({
        title: "檢查失敗",
        description: error.message || "無法驗證位置",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocationPath(sessionId ? `/game/${gameId}/play?session=${sessionId}` : `/game/${gameId}`)}
            className="gap-1"
            data-testid="button-back-to-game"
          >
            <ChevronLeft className="w-4 h-4" />
            返回遊戲
          </Button>
          <h1 className="font-display font-bold">地圖導航</h1>
          <div className="flex items-center gap-2">
            {sessionId && (
              <Badge variant="outline" className="gap-1">
                <Users className="w-3 h-3" />
                {teamLocations.length}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />

        <div className="absolute top-4 left-4 right-4 z-[1000]">
          <Card className="bg-card/95 backdrop-blur">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">任務點</span>
                <Badge variant="outline" className="font-number">
                  {visitedLocationIds.size} / {locations.length}
                </Badge>
              </div>
              {locationsLoading ? (
                <div className="text-sm text-muted-foreground">載入中...</div>
              ) : locations.filter(l => l.latitude && l.longitude).length === 0 ? (
                <div className="text-sm text-muted-foreground py-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  此遊戲目前沒有設定 GPS 任務點
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {locations.filter(l => l.latitude && l.longitude).map((location) => {
                    const isVisited = visitedLocationIds.has(location.id);
                    const isSelected = selectedLocation?.id === location.id;
                    const locLat = parseFloat(location.latitude!);
                    const locLng = parseFloat(location.longitude!);
                    
                    return (
                      <Badge
                        key={location.id}
                        variant={isVisited ? "default" : isSelected ? "secondary" : "outline"}
                        className={`gap-1 cursor-pointer transition-colors ${
                          isVisited ? "bg-success text-success-foreground" : ""
                        } ${isSelected && !isVisited ? "ring-2 ring-primary" : ""}`}
                        onClick={() => {
                          setSelectedLocation(location);
                          if (mapInstanceRef.current) {
                            mapInstanceRef.current.setView([locLat, locLng], 17);
                          }
                        }}
                        data-testid={`badge-location-${location.id}`}
                      >
                        {isVisited ? (
                          <Target className="w-3 h-3" />
                        ) : (
                          <MapPin className="w-3 h-3" />
                        )}
                        {location.name}
                        {userLocation && !isVisited && (
                          <span className="text-xs opacity-70">
                            {Math.round(calculateDistance(
                              userLocation.lat,
                              userLocation.lng,
                              locLat,
                              locLng
                            ))}m
                          </span>
                        )}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedLocation && navigationInfo && (
          <div className="absolute top-28 left-4 right-4 z-[1000]">
            <Card className="bg-primary/10 border-primary/30">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Compass className="w-4 h-4" />
                  導航至: {selectedLocation.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-2xl font-number font-bold">{navigationInfo.distance}</div>
                    <div className="text-xs text-muted-foreground">公尺</div>
                  </div>
                  <div>
                    <div className="text-2xl font-display font-bold">{navigationInfo.direction}</div>
                    <div className="text-xs text-muted-foreground">方向</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1">
                      <Timer className="w-4 h-4" />
                      <span className="text-lg font-number font-bold">{navigationInfo.estimatedTime}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">分鐘</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={openExternalNavigation}
                    data-testid="button-external-nav"
                  >
                    <ExternalLink className="w-4 h-4" />
                    導航 App
                  </Button>
                  {sessionId && !visitedLocationIds.has(selectedLocation.id) && (
                    <Button
                      className="flex-1"
                      onClick={handleVisitLocation}
                      disabled={visitLocationMutation.isPending}
                      data-testid="button-checkin"
                    >
                      {visitLocationMutation.isPending ? "打卡中..." : "打卡"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {locationError && (
          <div className="absolute bottom-24 left-4 right-4 z-[1000]">
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive">{locationError}</span>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <nav className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border px-4 py-3">
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={locateUser}
            disabled={isLocating}
            className="gap-2"
            data-testid="button-locate"
          >
            {isLocating ? (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Locate className="w-4 h-4" />
            )}
            {isLocating ? "定位中..." : "定位"}
          </Button>
          
          <Button
            variant={watchId !== null ? "destructive" : "outline"}
            className="gap-2"
            onClick={watchId !== null ? stopContinuousTracking : startContinuousTracking}
            data-testid="button-tracking"
          >
            <Navigation2 className={`w-4 h-4 ${watchId !== null ? "animate-pulse" : ""}`} />
            {watchId !== null ? "停止追蹤" : "持續追蹤"}
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (userLocation && mapInstanceRef.current) {
                mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 17);
              }
            }}
            disabled={!userLocation}
            data-testid="button-compass"
          >
            <Compass className="w-4 h-4" />
            回到位置
          </Button>
        </div>
      </nav>
    </div>
  );
}
