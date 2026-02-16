// 地圖相關工具函式

// 計算兩點間的距離（公尺），使用 Haversine 公式
export function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
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
}

// 計算方位角（度）
export function calculateBearing(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const y = Math.sin((lng2 - lng1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.cos((lng2 - lng1) * Math.PI / 180);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// 方位角轉方向文字
const DIRECTIONS = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'] as const;

export function bearingToDirection(bearing: number): string {
  const index = Math.round(bearing / 45) % 8;
  return DIRECTIONS[index];
}

// 計算導航資訊
export interface NavigationInfo {
  distance: number;
  bearing: number;
  direction: string;
  estimatedTime: number;
}

export function calculateNavigation(
  userLat: number, userLng: number,
  targetLat: number, targetLng: number
): NavigationInfo {
  const distance = calculateDistance(userLat, userLng, targetLat, targetLng);
  const bearing = calculateBearing(userLat, userLng, targetLat, targetLng);

  return {
    distance: Math.round(distance),
    bearing: Math.round(bearing),
    direction: bearingToDirection(bearing),
    estimatedTime: Math.ceil(distance / 83.33), // 約 5km/h 步行速度
  };
}

// 取得頁面類型的地圖圖標
export function getPageTypeIcon(type: string): string {
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
}

// 開啟外部導航 App
export function openExternalNavigation(
  lat: number, lng: number, label: string
): void {
  const encodedLabel = encodeURIComponent(label);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const url = isIOS
    ? `maps://maps.apple.com/?q=${encodedLabel}&ll=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, '_blank');
}
