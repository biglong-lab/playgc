// 🌐 後端 GPS 工具 — Haversine 距離 / 方位角
//
// 與 client/src/lib/geolocation/geo-utils.ts 邏輯**完全一致**
// 確保前後端距離計算結果相同（避免「前端說進入了，後端說沒進」）

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Haversine 距離（公尺）
 * 適用 < 100km，誤差 < 0.5%
 */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * 方位角（從 A 看 B 的方向，0=北、90=東、180=南、270=西）
 */
export function bearingDegrees(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** 方位角轉中文方位（北 / 東北 / 東 / 東南 / 南 / 西南 / 西 / 西北）*/
export function bearingToCompass(bearing: number): string {
  const directions = ["北", "東北", "東", "東南", "南", "西南", "西", "西北"];
  return directions[Math.round(bearing / 45) % 8];
}

/**
 * 距離格式化（給 UI 顯示）
 */
export function formatDistance(meters: number): string {
  if (meters < 1) return "已抵達";
  if (meters < 100) return `${Math.round(meters)} 公尺`;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} 公尺`;
  return `${(meters / 1000).toFixed(1)} 公里`;
}

/**
 * 計算移動速度（m/s），配合距離 + 時間差
 * 用於：
 * - 防作弊（瞬移檢測，正常人 < 30m/s = 108km/h）
 * - 預估抵達時間
 */
export function calculateSpeed(distanceM: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return distanceM / (durationMs / 1000);
}
