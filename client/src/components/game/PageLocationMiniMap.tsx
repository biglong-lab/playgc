// 🗺️ 頁面定位迷你地圖
//
// 顯示頁面 config.locationSettings 的目標點 + 玩家位置 + 觸發半徑
// 用在所有支援 LocationSettingsSection 的頁面類型（text_card / dialogue / qr_scan / vote 等）
//
// 設計：
//   - 緊湊（高度 200px）顯示在頁面上方
//   - 自動取玩家 GPS 位置（用 useStableGeolocation）
//   - 顯示距離 + 是否進入觸發範圍
//   - 點擊全螢幕展開
//
// 觸發條件：
//   config.locationSettings.enabled = true
//   config.locationSettings.showOnMap = true
//   config.locationSettings.latitude / longitude 有值

import { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation, MapPin, Maximize2, Minimize2 } from "lucide-react";
import {
  useStableGeolocation,
  distanceMeters,
  formatDistance,
  classifyAccuracy,
} from "@/lib/geolocation";

// ============================================================================
// 型別
// ============================================================================

export interface PageLocationSettings {
  enabled?: boolean;
  showOnMap?: boolean;
  latitude?: number | string | null;
  longitude?: number | string | null;
  radius?: number;
  locationName?: string;
  instructions?: string;
  iconType?: string;
}

interface PageLocationMiniMapProps {
  settings: PageLocationSettings;
  /** 是否啟用 GPS（預設 true）*/
  enableGps?: boolean;
  className?: string;
}

// ============================================================================
// 圖示
// ============================================================================

const iconEmoji: Record<string, string> = {
  default: "📍",
  qr: "🔲",
  photo: "📷",
  shooting: "🎯",
  gps: "📡",
  puzzle: "🧩",
  star: "⭐",
};

function buildTargetIcon(type: string = "default"): L.DivIcon {
  const emoji = iconEmoji[type] || iconEmoji.default;
  return L.divIcon({
    className: "page-loc-target-marker",
    html: `<div style="background: hsl(var(--destructive)); width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 16px;">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const userIcon = L.divIcon({
  className: "page-loc-user-marker",
  html: `<div style="background: hsl(var(--primary)); width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 4px rgba(59,130,246,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// ============================================================================
// 自動 fit bounds
// ============================================================================

function AutoFit({
  userLat,
  userLng,
  targetLat,
  targetLng,
  radius,
}: {
  userLat: number | null;
  userLng: number | null;
  targetLat: number;
  targetLng: number;
  radius: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (userLat !== null && userLng !== null) {
      const bounds = L.latLngBounds([
        [userLat, userLng],
        [targetLat, targetLng],
      ]);
      map.fitBounds(bounds.pad(0.3), { maxZoom: 17 });
    } else {
      const zoom = radius < 50 ? 17 : radius < 200 ? 16 : 15;
      map.setView([targetLat, targetLng], zoom);
    }
  }, [userLat, userLng, targetLat, targetLng, radius, map]);
  return null;
}

// ============================================================================
// 主元件
// ============================================================================

export function PageLocationMiniMap({
  settings,
  enableGps = true,
  className = "",
}: PageLocationMiniMapProps) {
  const [expanded, setExpanded] = useState(false);

  // 解析座標（容錯：可能是 string）
  const targetLat = useMemo(() => {
    const v = settings.latitude;
    return typeof v === "string" ? parseFloat(v) : v ?? NaN;
  }, [settings.latitude]);

  const targetLng = useMemo(() => {
    const v = settings.longitude;
    return typeof v === "string" ? parseFloat(v) : v ?? NaN;
  }, [settings.longitude]);

  const radius = settings.radius || 50;
  const hasValidTarget =
    !Number.isNaN(targetLat) &&
    !Number.isNaN(targetLng) &&
    !(targetLat === 0 && targetLng === 0);

  // 玩家 GPS（穩定版）
  const { position: userPos, accuracy: gpsAccuracy } = useStableGeolocation({
    mode: "watch",
    enabled: enableGps && hasValidTarget,
    sampleSize: 5,
  });

  const distance =
    userPos && hasValidTarget
      ? distanceMeters(userPos.lat, userPos.lng, targetLat, targetLng)
      : null;

  const inRange = distance !== null && distance <= radius;

  if (!hasValidTarget) {
    return (
      <div
        className={`rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-500/30 p-3 text-sm text-amber-700 dark:text-amber-300 ${className}`}
      >
        ⚠️ 地圖標記座標未設定
      </div>
    );
  }

  // 🎯 高度優化：mobile 友善（佔螢幕 15-30%）
  // 原 200/400 對 800px viewport 佔 25-50%，太多
  const mapHeight = expanded ? "260px" : "120px";

  return (
    <div
      className={`rounded-lg overflow-hidden border bg-card shadow-sm ${className}`}
      data-testid="page-location-mini-map"
    >
      {/* 標題列 */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {settings.locationName || "任務地點"}
            </div>
            {settings.instructions && (
              <div className="text-xs text-muted-foreground truncate">
                {settings.instructions}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-muted transition shrink-0"
          aria-label={expanded ? "縮小地圖" : "放大地圖"}
        >
          {expanded ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* 地圖 */}
      <div style={{ height: mapHeight }} className="relative">
        <MapContainer
          center={[targetLat, targetLng]}
          zoom={16}
          style={{ height: "100%", width: "100%" }}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          <AutoFit
            userLat={userPos?.lat ?? null}
            userLng={userPos?.lng ?? null}
            targetLat={targetLat}
            targetLng={targetLng}
            radius={radius}
          />
          {/* 觸發圓 */}
          <Circle
            center={[targetLat, targetLng]}
            radius={radius}
            pathOptions={{
              color: inRange ? "#10b981" : "#f59e0b",
              fillColor: inRange ? "#10b981" : "#f59e0b",
              fillOpacity: 0.15,
              weight: 2,
            }}
          />
          {/* 目標 */}
          <Marker
            position={[targetLat, targetLng]}
            icon={buildTargetIcon(settings.iconType)}
          />
          {/* 玩家 */}
          {userPos && <Marker position={[userPos.lat, userPos.lng]} icon={userIcon} />}
        </MapContainer>
      </div>

      {/* 距離指示 */}
      {distance !== null && (
        <div
          className={`px-3 py-2 text-sm flex items-center justify-between ${
            inRange ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted/30"
          }`}
        >
          <span className="flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5" />
            {inRange ? "已在範圍內" : `距離 ${formatDistance(distance)}`}
          </span>
          {gpsAccuracy && (
            <span className="text-xs text-muted-foreground">
              GPS ±{Math.round(gpsAccuracy)}m
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// helper：判斷 config 是否要顯示 mini map
// ============================================================================

export function shouldShowMiniMap(config: any): boolean {
  const ls = config?.locationSettings as PageLocationSettings | undefined;
  if (!ls?.enabled || !ls?.showOnMap) return false;
  const lat = typeof ls.latitude === "string" ? parseFloat(ls.latitude) : ls.latitude;
  const lng = typeof ls.longitude === "string" ? parseFloat(ls.longitude) : ls.longitude;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    !(lat === 0 && lng === 0)
  );
}

export function getLocationSettings(config: any): PageLocationSettings | null {
  return config?.locationSettings ?? null;
}
