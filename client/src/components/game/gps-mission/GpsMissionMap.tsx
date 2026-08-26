// GPS 任務地圖 — showMap=true 時顯示玩家位置、目標點、觸發半徑
// 注意：Leaflet 直接操作 DOM，不能讓 React 管 map container 內部 children。
// 這裡透過 react-leaflet 的 MapContainer 包裝，內部用 Marker/Circle 即可，
// 所有 children 都走 react-leaflet 管理，不混用原生 JSX。
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { worldAbsoluteAngle } from "@/lib/compass-rotation";
import { useCompassHeading } from "@/hooks/useCompassHeading";

// 目標點圖示（大紅）
const targetIcon = L.divIcon({
  className: "gps-target-marker",
  html: `<div style="background: hsl(var(--destructive)); width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">🎯</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// 🧭 玩家位置 icon factory
//   2026-08-27（CHITO 2a1bb97a）：地圖是「北朝上、不隨手機旋轉」的世界座標系，
//   箭頭必須用絕對角度。舊版套了羅盤用的相對角（目標方位 − 裝置朝向），
//   箭頭因此與地圖上的目標位置差一個 heading → 回報「地圖方向與實際相反」。
//   現在箭頭代表「手機目前朝向」（rotate(heading)，同 Google Maps 的視野指標），
//   與上方羅盤刻度環（rotate(-heading)）指的是同一個真實方位。
//   heading 0 = 北、90 = 東、180 = 南、270 = 西；無羅盤時不畫箭頭。
function makeUserIcon(headingDeg: number | null) {
  const arrowSvg = headingDeg !== null
    ? `<svg width="32" height="32" viewBox="0 0 32 32" style="position:absolute; top:-6px; left:-6px; transform: rotate(${headingDeg}deg); transform-origin: center; pointer-events: none;">
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

  // 🧭 地圖箭頭 = 手機朝向的「絕對」方位（世界座標系，見 lib/compass-rotation.ts）
  //   ⚠️ 不可再減 compass.heading — 那是羅盤（裝置座標系）才要做的事。
  const compass = useCompassHeading();
  const userHeading = useMemo<number | null>(
    () => worldAbsoluteAngle(compass.heading),
    [compass.heading],
  );
  const userIcon = useMemo(() => makeUserIcon(userHeading), [userHeading]);

  // iOS 需 user gesture 觸發 compass.request()
  useEffect(() => {
    if (!compass.supported || compass.granted) return;
    const tryRequest = () => {
      void compass.request();
    };
    document.addEventListener("pointerdown", tryRequest, { once: true, passive: true });
    document.addEventListener("touchstart", tryRequest, { once: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", tryRequest);
      document.removeEventListener("touchstart", tryRequest);
    };
  }, [compass.supported, compass.granted, compass]);

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
