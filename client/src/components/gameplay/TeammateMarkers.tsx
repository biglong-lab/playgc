import { Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface TeamMemberLocation {
  userId: string;
  userName: string;
  userAvatar?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

interface TeammateMarkersProps {
  locations: Map<string, TeamMemberLocation>;
  currentUserId?: string;
  showAccuracyCircle?: boolean;
  teamColor?: string;
}

function createTeammateIcon(name: string, color: string = "#f97316") {
  const initial = name.charAt(0).toUpperCase();
  
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48" width="40" height="48">
      <path d="M20 0C8.954 0 0 8.954 0 20c0 14 20 28 20 28s20-14 20-28C40 8.954 31.046 0 20 0z" fill="${color}"/>
      <circle cx="20" cy="18" r="12" fill="white"/>
      <text x="20" y="23" text-anchor="middle" font-size="14" font-weight="bold" fill="${color}">${initial}</text>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: "teammate-marker",
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -48],
  });
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 10) return "剛剛";
  if (diffSec < 60) return `${diffSec}秒前`;
  
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分鐘前`;
  
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}小時前`;
}

export function TeammateMarkers({
  locations,
  currentUserId,
  showAccuracyCircle = false,
  teamColor = "#f97316",
}: TeammateMarkersProps) {
  const teammateLocations = Array.from(locations.values()).filter(
    loc => loc.userId !== currentUserId
  );

  if (teammateLocations.length === 0) {
    return null;
  }

  return (
    <>
      {teammateLocations.map((loc) => (
        <div key={loc.userId}>
          <Marker
            position={[loc.latitude, loc.longitude]}
            icon={createTeammateIcon(loc.userName, teamColor)}
          >
            <Popup>
              <div className="flex items-center gap-2 min-w-[120px]">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={loc.userAvatar} />
                  <AvatarFallback className="text-xs">
                    {loc.userName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-sm">{loc.userName}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(loc.timestamp)}
                  </div>
                </div>
              </div>
              {loc.accuracy && (
                <div className="text-xs text-muted-foreground mt-1">
                  精確度: ±{Math.round(loc.accuracy)}m
                </div>
              )}
            </Popup>
          </Marker>

          {showAccuracyCircle && loc.accuracy && (
            <Circle
              center={[loc.latitude, loc.longitude]}
              radius={loc.accuracy}
              pathOptions={{
                color: teamColor,
                fillColor: teamColor,
                fillOpacity: 0.1,
                weight: 1,
                opacity: 0.3,
              }}
            />
          )}
        </div>
      ))}
    </>
  );
}
