// 地圖任務點清單卡片
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Target, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { calculateDistance } from "@/lib/map-utils";
import type { Location } from "@shared/schema";

interface MapLocationListProps {
  locations: Location[];
  visitedLocationIds: Set<number>;
  selectedLocation: Location | null;
  userLocation: { lat: number; lng: number } | null;
  isLoading: boolean;
  onSelectLocation: (location: Location) => void;
}

export default function MapLocationList({
  locations,
  visitedLocationIds,
  selectedLocation,
  userLocation,
  isLoading,
  onSelectLocation,
}: MapLocationListProps) {
  // 🔧 預設摺疊（避免 7+ 個任務點佔住畫面 1/3 擋住地圖）
  //   點擊頂部列展開/收起，與地圖空間平衡
  const [expanded, setExpanded] = useState(false);

  const locationsWithCoords = locations.filter(l => l.latitude && l.longitude);

  return (
    <div className="absolute top-4 left-4 right-4 z-[1000]" data-testid="map-location-list">
      <Card className="bg-card/95 backdrop-blur">
        <CardContent className="p-3">
          {/* 標題列 — 點擊摺疊/展開 */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center justify-between w-full"
            data-testid="button-toggle-location-list"
          >
            <span className="text-sm font-medium flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" />
              任務點
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-number">
                {visitedLocationIds.size} / {locations.length}
              </Badge>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {/* 展開時才顯示清單 */}
          {expanded && (
            <div className="mt-2 max-h-[40vh] overflow-y-auto">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">載入中...</div>
              ) : locationsWithCoords.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  此遊戲目前沒有設定 GPS 任務點
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {locationsWithCoords.map((location) => {
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
                          onSelectLocation(location);
                          setExpanded(false); // 點選任務點後自動收起，露出地圖
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
