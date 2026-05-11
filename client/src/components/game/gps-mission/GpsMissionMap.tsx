// GPS 任務地圖 — showMap=true 時顯示玩家位置、目標點、觸發半徑
// 注意：Leaflet 直接操作 DOM，不能讓 React 管 map container 內部 children。
// 這裡透過 react-leaflet 的 MapContainer 包裝，內部用 Marker/Circle 即可，
// 所有 children 都走 react-leaflet 管理，不混用原生 JSX。
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { bearingDegrees } from "@/lib/geolocation";

// 目標點圖示（大紅）
const targetIcon = L.divIcon({
  className: "gps-target-marker",
  html: `<div style="background: hsl(var(--destructive)); width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">🎯</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// 🆕 2026-05-12 #10: 玩家位置 + 面向目標方向的箭頭 icon factory
//   bearing 0 = 北、90 = 東、180 = 南、270 = 西
//   箭頭從中心向上、用 CSS rotate(bearing) 指向目標
function makeUserIcon(bearing: number | null) {
  const arrowSvg = bearing !== null
    ? `<svg width="32" height="32" viewBox="0 0 32 32" style="position:absolute; top:-6px; left:-6px; transform: rotate(${bearing}deg); transform-origin: center; pointer-events: none;">
         <polygon points="16,2 22,12 16,9 10,12" fill="hsl(var(--primary))" stroke="white" stroke-width="1.5" />
       </svg>`
    : "";
  return L.divIcon({
    className: "gps-user-marker",
    html: `<div style="position:relative; width:20px; height:20px;">
             <div style="background: hsl(var(--primary)); width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 4px rgba(59,130,246,0.3); animation: gps-pulse 2s infinite;"></div>
             ${arrowSvg}
             <style>@keyframes gps-pulse { 0%,100%{ box-shadow: 0 0 0 4px rgba(59,130,246,0.3);} 50%{ box-shadow: 0 0 0 10px rgba(59,130,246,0.15);}}</style>
           </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

/** 依 user / target 自動調整視野 */
function AutoFit({ userLat, userLng, targetLat, targetLng, radius }: {
  userLat: number | null; userLng: number | null;
  targetLat: number; targetLng: number; radius: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (userLat !== null && userLng !== null) {
      const bounds = L.latLngBounds([[userLat, userLng], [targetLat, targetLng]]);
      map.fitBounds(bounds.pad(0.3), { maxZoom: 17 });
    } else {
      // 只知道目標 → 中心目標點，使用 radius 決定 zoom
      const zoom = radius < 50 ? 17 : radius < 200 ? 16 : 15;
      map.setView([targetLat, targetLng], zoom);
    }
  }, [userLat, userLng, targetLat, targetLng, radius, map]);
  return null;
}

interface GpsMissionMapProps {
  targetLat: number;
  targetLng: number;
  radius: number;
  userLat?: number | null;
  userLng?: number | null;
}

export default function GpsMissionMap({
  targetLat,
  targetLng,
  radius,
  userLat = null,
  userLng = null,
}: GpsMissionMapProps) {
  const center = useMemo<[number, number]>(
    () => [targetLat, targetLng],
    [targetLat, targetLng],
  );

  // 🆕 2026-05-12 #10: 玩家箭頭面向目標方向
  const userBearing = useMemo<number | null>(() => {
    if (userLat === null || userLng === null) return null;
    return bearingDegrees(userLat, userLng, targetLat, targetLng);
  }, [userLat, userLng, targetLat, targetLng]);
  const userIcon = useMemo(() => makeUserIcon(userBearing), [userBearing]);

  return (
    <div className="w-full rounded-lg overflow-hidden border border-border" style={{ height: 240 }}>
      <MapContainer
        center={center}
        zoom={16}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={center} icon={targetIcon} />
        <Circle
          center={center}
          radius={radius}
          pathOptions={{ color: "hsl(var(--destructive))", fillOpacity: 0.15, weight: 2 }}
        />
        {userLat !== null && userLng !== null && (
          <Marker position={[userLat, userLng]} icon={userIcon} />
        )}
        <AutoFit
          userLat={userLat}
          userLng={userLng}
          targetLat={targetLat}
          targetLng={targetLng}
          radius={radius}
        />
      </MapContainer>
    </div>
  );
}
