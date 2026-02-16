// 地圖導航資訊卡片
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Compass, Timer, ExternalLink } from "lucide-react";
import { openExternalNavigation } from "@/lib/map-utils";
import type { Location } from "@shared/schema";
import type { NavigationInfo } from "@/lib/map-utils";

interface MapNavigationCardProps {
  selectedLocation: Location;
  navigationInfo: NavigationInfo;
  isVisited: boolean;
  sessionId?: string;
  isPending: boolean;
  onVisit: () => void;
}

export default function MapNavigationCard({
  selectedLocation,
  navigationInfo,
  isVisited,
  sessionId,
  isPending,
  onVisit,
}: MapNavigationCardProps) {
  const handleExternalNav = () => {
    if (!selectedLocation.latitude || !selectedLocation.longitude) return;
    const lat = parseFloat(selectedLocation.latitude);
    const lng = parseFloat(selectedLocation.longitude);
    openExternalNavigation(lat, lng, selectedLocation.name);
  };

  return (
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
              onClick={handleExternalNav}
              data-testid="button-external-nav"
            >
              <ExternalLink className="w-4 h-4" />
              導航 App
            </Button>
            {sessionId && !isVisited && (
              <Button
                className="flex-1"
                onClick={onVisit}
                disabled={isPending}
                data-testid="button-checkin"
              >
                {isPending ? "打卡中..." : "打卡"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
