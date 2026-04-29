// 🌐 GPS 工具函式 — 統一所有距離計算 + 角度
//
// 為何集中管理：
//   - 原本 map-utils.ts / GpsMissionPage.tsx / location-tracking.ts 各有一份 Haversine
//   - 三份程式碼重複，修改時容易不一致 → 前後端距離計算可能差異
//   - 統一後前端用此檔，後端 server/lib/geo.ts 同步
//
// 公式：Haversine（球面三角公式）
// 誤差：< 0.5%（地球非完美球體，ECEF 才更準，但 < 100km 用 Haversine 已夠）

const EARTH_RADIUS_M = 6371000; // 地球平均半徑（公尺）

/** 角度轉弧度 */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 弧度轉角度 */
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Haversine 距離（公尺）
 * 適用於 < 100km 的距離計算，誤差 < 0.5%
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
 * 方位角（從點 A 看點 B 的方向，0=北、90=東、180=南、270=西）
 * 用於導航箭頭指向
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
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/**
 * 中位數（用於從多次 GPS 採樣中過濾離群值）
 * 比平均數更抗極端值
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * 把方位角轉成中文方位
 * 給玩家看「目標在你的東北方」這種文字
 */
export function bearingToCompass(bearing: number): string {
  const directions = ["北", "東北", "東", "東南", "南", "西南", "西", "西北"];
  const idx = Math.round(bearing / 45) % 8;
  return directions[idx];
}

/**
 * 距離格式化（給玩家看的友善文字）
 */
export function formatDistance(meters: number): string {
  if (meters < 1) return "已抵達";
  if (meters < 100) return `${Math.round(meters)} 公尺`;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} 公尺`;
  return `${(meters / 1000).toFixed(1)} 公里`;
}

/**
 * GPS 精度品質分級
 * accuracy 是 navigator.geolocation 回傳的 1σ 不確定半徑（公尺）
 *
 * 等級對應實際表現：
 *   excellent: GPS 直視、戶外無遮蔽（平均 5-10m）
 *   good: 戶外輕微遮蔽（10-30m）
 *   fair: 樹蔭 / 城市峽谷（30-50m）
 *   poor: 室內 / 重度遮蔽（50-100m）
 *   unusable: 純 IP 定位 / 行動數據網路推算（> 100m）
 */
export type GpsQuality = "excellent" | "good" | "fair" | "poor" | "unusable";

export function classifyAccuracy(accuracy: number | null | undefined): GpsQuality {
  if (accuracy == null) return "unusable";
  if (accuracy <= 10) return "excellent";
  if (accuracy <= 30) return "good";
  if (accuracy <= 50) return "fair";
  if (accuracy <= 100) return "poor";
  return "unusable";
}

/**
 * 給玩家看的精度文字 + 改善建議
 */
export function describeQuality(quality: GpsQuality): {
  label: string;
  emoji: string;
  color: string;
  hint?: string;
} {
  switch (quality) {
    case "excellent":
      return { label: "極佳", emoji: "🟢", color: "text-emerald-500" };
    case "good":
      return { label: "良好", emoji: "🟢", color: "text-emerald-500" };
    case "fair":
      return {
        label: "一般",
        emoji: "🟡",
        color: "text-amber-500",
        hint: "可繼續遊戲，建議移動到開闊處可更精準",
      };
    case "poor":
      return {
        label: "較差",
        emoji: "🟠",
        color: "text-orange-500",
        hint: "建議走出室內 / 遠離高樓，並等 10-30 秒讓 GPS 暖機",
      };
    case "unusable":
      return {
        label: "極差",
        emoji: "🔴",
        color: "text-red-500",
        hint: "請開啟『裝置定位』權限與 WiFi（不需連網）以提升精度",
      };
  }
}
