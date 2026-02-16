// 地圖任務點清單卡片
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Target, AlertCircle } from "lucide-react";
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
  const locationsWithCoords = locations.filter(l => l.latitude && l.longitude);

  return (
    <div className="absolute top-4 left-4 right-4 z-[1000]">
      <Card className="bg-card/95 backdrop-blur">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">任務點</span>
            <Badge variant="outline" className="font-number">
              {visitedLocationIds.size} / {locations.length}
            </Badge>
          </div>
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
                    onClick={() => onSelectLocation(location)}
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
  );
}
