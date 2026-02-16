// 地圖導航頁面
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMapGeolocation } from "@/hooks/useMapGeolocation";
import { getPageTypeIcon } from "@/lib/map-utils";
import MapNavigationCard from "@/components/map/MapNavigationCard";
import MapLocationList from "@/components/map/MapLocationList";
import {
  ChevronLeft,
  Locate,
  Navigation2,
  AlertCircle,
  Users,
  Compass,
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

export default function MapView() {
  const { gameId, sessionId } = useParams<{ gameId: string; sessionId?: string }>();
  const [, setLocationPath] = useLocation();
  const { toast } = useToast();

  // Map refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const teamMarkersRef = useRef<Map<string, any>>(new Map());
  const locationMarkersRef = useRef<Map<number, any>>(new Map());
  const pageMarkersRef = useRef<Map<string, any>>(new Map());

  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  // === 資料查詢 ===
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
      .map((page) => ({
        page,
        locationSettings: (page.config as any).locationSettings as PageLocationSettings,
      }));
  }, [pages]);

  const { data: visits = [] } = useQuery<LocationVisit[]>({
    queryKey: [`/api/sessions/${sessionId}/visits`],
    enabled: !!sessionId,
    refetchInterval: 10000,
  });

  const { data: teamLocations = [] } = useQuery<{ playerId: string; latitude: string; longitude: string; timestamp: string }[]>({
    queryKey: [`/api/sessions/${sessionId}/team-locations`],
    enabled: !!sessionId,
    refetchInterval: 5000,
  });

  const visitedLocationIds = useMemo(() => new Set(visits.map(v => v.locationId)), [visits]);

  // === 打卡 ===
  const visitLocationMutation = useMutation({
    mutationFn: async (locationId: number) => {
      if (!sessionId) return;
      return apiRequest('POST', `/api/sessions/${sessionId}/locations/${locationId}/visit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/visits`] });
      queryClient.invalidateQueries({ queryKey: [`/api/games/${gameId}/locations`] });
      toast({ title: "到達任務點!", description: "恭喜你完成了這個位置!" });
    },
    onError: (error: any) => {
      toast({ title: "打卡失敗", description: error.message || "無法完成打卡", variant: "destructive" });
    },
  });

  // === 定位追蹤 ===
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

  const {
    userLocation,
    isLocating,
    locationError,
    navigationInfo,
    isTracking,
    locateUser,
    startContinuousTracking,
    stopContinuousTracking,
  } = useMapGeolocation({
    sessionId,
    locations,
    visitedLocationIds,
    selectedLocation,
    onUserMarkerUpdate: updateUserMarker,
  });

  // === 地圖初始化 ===
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const defaultCenter: [number, number] = [24.4399, 118.3471];
    const map = L.map(mapRef.current, { zoomControl: false }).setView(defaultCenter, 15);
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

  // === 地點標記 ===
  useEffect(() => {
    if (!mapInstanceRef.current || !locations.length) return;
    locationMarkersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    locationMarkersRef.current.clear();

    const locationsWithCoords = locations.filter(l => l.latitude && l.longitude);
    if (locationsWithCoords.length > 0 && !userLocation) {
      const first = locationsWithCoords[0];
      const lat = parseFloat(first.latitude!);
      const lng = parseFloat(first.longitude!);
      if (!isNaN(lat) && !isNaN(lng)) mapInstanceRef.current.setView([lat, lng], 16);
    }

    locations.forEach((location) => {
      if (!location.latitude || !location.longitude) return;
      const isVisited = visitedLocationIds.has(location.id);
      const lat = parseFloat(location.latitude);
      const lng = parseFloat(location.longitude);

      const iconHtml = isVisited ? `
        <div class="w-10 h-10 rounded-full bg-success/80 border-2 border-success flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      ` : `
        <div class="w-10 h-10 rounded-full bg-primary/80 border-2 border-primary flex items-center justify-center marker-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        </div>
      `;

      const icon = L.divIcon({ className: "custom-marker", html: iconHtml, iconSize: [40, 40], iconAnchor: [20, 20] });
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
      marker.on('click', () => setSelectedLocation(location));

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

  // === 頁面地點標記 ===
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    pageMarkersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    pageMarkersRef.current.clear();

    pagesWithLocations.forEach(({ page, locationSettings }) => {
      const lat = typeof locationSettings.latitude === 'string'
        ? parseFloat(locationSettings.latitude) : locationSettings.latitude!;
      const lng = typeof locationSettings.longitude === 'string'
        ? parseFloat(locationSettings.longitude) : locationSettings.longitude!;
      if (isNaN(lat) || isNaN(lng)) return;

      const iconEmoji = locationSettings.markerIcon || getPageTypeIcon(page.pageType);
      const icon = L.divIcon({
        className: "page-marker",
        html: `<div class="w-8 h-8 rounded-full bg-amber-500/80 border-2 border-amber-400 flex items-center justify-center shadow-lg"><span class="text-sm">${iconEmoji}</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
      const pageConfig = page.config as Record<string, unknown>;
      const pageTitle = (pageConfig?.title as string) || '';
      const label = locationSettings.markerLabel || pageTitle || `任務 ${page.pageOrder}`;
      marker.bindPopup(`
        <div class="font-chinese p-2">
          <strong class="text-lg">${label}</strong>
          <p class="text-sm text-muted-foreground mt-1">頁面: ${pageTitle || page.pageType}</p>
          ${locationSettings.radius ? `<p class="text-xs mt-1">範圍: ${locationSettings.radius}m</p>` : ''}
        </div>
      `);

      if (locationSettings.radius && locationSettings.radius > 0) {
        L.circle([lat, lng], {
          radius: locationSettings.radius, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.1, weight: 1,
        }).addTo(mapInstanceRef.current);
      }
      pageMarkersRef.current.set(page.id, marker);
    });
  }, [pagesWithLocations]);

  // === 隊友標記 ===
  useEffect(() => {
    if (!mapInstanceRef.current || !teamLocations.length) return;
    teamMarkersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    teamMarkersRef.current.clear();

    teamLocations.forEach((member) => {
      const lat = parseFloat(member.latitude);
      const lng = parseFloat(member.longitude);
      const icon = L.divIcon({
        className: "team-marker",
        html: `<div class="relative"><div class="w-5 h-5 rounded-full bg-green-500 border-2 border-white flex items-center justify-center shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
      marker.bindPopup(`<strong>隊友</strong>`);
      teamMarkersRef.current.set(member.playerId, marker);
    });
  }, [teamLocations]);

  // === 打卡處理 ===
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
      toast({ title: "檢查失敗", description: error.message || "無法驗證位置", variant: "destructive" });
    }
  };

  // === 選擇地點 ===
  const handleSelectLocation = useCallback((location: Location) => {
    setSelectedLocation(location);
    if (mapInstanceRef.current && location.latitude && location.longitude) {
      const lat = parseFloat(location.latitude);
      const lng = parseFloat(location.longitude);
      mapInstanceRef.current.setView([lat, lng], 17);
    }
  }, []);

  // === 定位按鈕 ===
  const handleLocate = async () => {
    const position = await locateUser();
    if (position && mapInstanceRef.current) {
      mapInstanceRef.current.setView([position.coords.latitude, position.coords.longitude], 17);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 頂部 */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost" size="sm"
            onClick={() => setLocationPath(sessionId ? `/game/${gameId}/play?session=${sessionId}` : `/game/${gameId}`)}
            className="gap-1" data-testid="button-back-to-game"
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

      {/* 地圖 + 覆蓋層 */}
      <main className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />

        <MapLocationList
          locations={locations}
          visitedLocationIds={visitedLocationIds}
          selectedLocation={selectedLocation}
          userLocation={userLocation}
          isLoading={locationsLoading}
          onSelectLocation={handleSelectLocation}
        />

        {selectedLocation && navigationInfo && (
          <MapNavigationCard
            selectedLocation={selectedLocation}
            navigationInfo={navigationInfo}
            isVisited={visitedLocationIds.has(selectedLocation.id)}
            sessionId={sessionId}
            isPending={visitLocationMutation.isPending}
            onVisit={handleVisitLocation}
          />
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

      {/* 底部控制列 */}
      <nav className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border px-4 py-3">
        <div className="flex items-center justify-center gap-4">
          <Button onClick={handleLocate} disabled={isLocating} className="gap-2" data-testid="button-locate">
            {isLocating ? (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Locate className="w-4 h-4" />
            )}
            {isLocating ? "定位中..." : "定位"}
          </Button>

          <Button
            variant={isTracking ? "destructive" : "outline"} className="gap-2"
            onClick={isTracking ? stopContinuousTracking : startContinuousTracking}
            data-testid="button-tracking"
          >
            <Navigation2 className={`w-4 h-4 ${isTracking ? "animate-pulse" : ""}`} />
            {isTracking ? "停止追蹤" : "持續追蹤"}
          </Button>

          <Button
            variant="outline" className="gap-2"
            onClick={() => {
              if (userLocation && mapInstanceRef.current) {
                mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 17);
              }
            }}
            disabled={!userLocation} data-testid="button-compass"
          >
            <Compass className="w-4 h-4" />
            回到位置
          </Button>
        </div>
      </nav>
    </div>
  );
}
