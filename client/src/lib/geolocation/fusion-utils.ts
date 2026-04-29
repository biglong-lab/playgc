// 🧮 GPS 融合算法 — 多人同隊 GPS 取統計加權平均
//
// 原理：
//   當 N 人在同位置（< 30m），各自 GPS 有獨立誤差。
//   統計上：σ_combined = σ_single / √N
//   5 人融合 → 誤差降低 ~55%
//   10 人融合 → 誤差降低 ~68%
//
// 步驟：
//   1. 過濾過時樣本（> 10 秒舊的）
//   2. IQR 過濾離群（不在中位數附近的丟掉）
//   3. 散開檢測（隊友距離 > 50m → 不融合，回傳自己的位置）
//   4. 反方差加權平均（accuracy 越好權重越高）

import { distanceMeters, median } from "./geo-utils";

/** 融合用的 GPS 樣本（含 userId 識別來源）*/
export interface FusionSample {
  userId: string;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number; // 來源時間（不是收到時）
}

export interface FusionResult {
  lat: number;
  lng: number;
  accuracy: number;
  /** 融合用了幾個有效樣本（含自己）*/
  contributors: number;
  /** 隊友是否分散（true = 沒做融合，回自己的位置）*/
  scattered: boolean;
  /** 融合 vs 單獨提升幅度（0-1，0=沒提升，0.5=精度減半）*/
  improvementRatio: number;
}

const MAX_SAMPLE_AGE_MS = 10_000; // 10 秒前的樣本不採用
const SCATTERED_THRESHOLD_M = 50; // 隊友距離 > 50m 視為分散
const MIN_CONTRIBUTORS_FOR_FUSION = 2; // 至少 2 人才有融合意義

/**
 * 融合多個 GPS 樣本（包含自己 + 隊友）
 *
 * @param mySample 自己的 GPS（必填，作為參考點）
 * @param teamSamples 隊友 GPS 列表（不含自己）
 * @returns 融合結果，scattered=true 時 lat/lng = 自己原位置
 */
export function fuseTeamGps(
  mySample: FusionSample,
  teamSamples: FusionSample[],
): FusionResult {
  const now = Date.now();

  // Step 1: 過濾過時樣本 + 自己（避免重複）
  const fresh = teamSamples.filter(
    (s) =>
      s.userId !== mySample.userId &&
      now - s.timestamp <= MAX_SAMPLE_AGE_MS &&
      typeof s.lat === "number" &&
      typeof s.lng === "number" &&
      typeof s.accuracy === "number" &&
      s.accuracy > 0,
  );

  // Step 2: 散開檢測 — 任何隊友距離我超過 SCATTERED_THRESHOLD_M → 不融合
  const distances = fresh.map((s) =>
    distanceMeters(mySample.lat, mySample.lng, s.lat, s.lng),
  );
  const someoneFarAway = distances.some((d) => d > SCATTERED_THRESHOLD_M);

  if (someoneFarAway || fresh.length < MIN_CONTRIBUTORS_FOR_FUSION - 1) {
    // 隊友分散 / 樣本不足 → 不融合
    return {
      lat: mySample.lat,
      lng: mySample.lng,
      accuracy: mySample.accuracy,
      contributors: 1,
      scattered: someoneFarAway,
      improvementRatio: 0,
    };
  }

  // Step 3: IQR 過濾離群（緯度 / 經度分別處理）
  const allSamples = [mySample, ...fresh];
  const lats = allSamples.map((s) => s.lat);
  const lngs = allSamples.map((s) => s.lng);
  const medianLat = median(lats);
  const medianLng = median(lngs);

  // IQR 上下 1.5 倍視為合理範圍
  const iqrFactor = 1.5;
  const latDeviations = lats.map((l) => Math.abs(l - medianLat));
  const lngDeviations = lngs.map((l) => Math.abs(l - medianLng));
  const sortedLatDev = [...latDeviations].sort((a, b) => a - b);
  const sortedLngDev = [...lngDeviations].sort((a, b) => a - b);
  const q3LatDev = sortedLatDev[Math.floor(sortedLatDev.length * 0.75)];
  const q3LngDev = sortedLngDev[Math.floor(sortedLngDev.length * 0.75)];
  const latThreshold = q3LatDev * iqrFactor;
  const lngThreshold = q3LngDev * iqrFactor;

  const filtered = allSamples.filter((_, i) => {
    return latDeviations[i] <= latThreshold && lngDeviations[i] <= lngThreshold;
  });

  // Step 4: 反方差加權平均（1 / accuracy² 權重）
  // accuracy 越小（越精準）→ 權重越大
  const weights = filtered.map((s) => 1 / (s.accuracy * s.accuracy));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const fusedLat =
    filtered.map((s, i) => s.lat * weights[i]).reduce((a, b) => a + b, 0) /
    totalWeight;
  const fusedLng =
    filtered.map((s, i) => s.lng * weights[i]).reduce((a, b) => a + b, 0) /
    totalWeight;
  // 融合後等效精度：σ_fused = 1 / √(Σ 1/σᵢ²)
  const fusedAccuracy = Math.sqrt(1 / totalWeight);

  // 計算改善幅度（accuracy 比例）
  const improvementRatio = Math.max(
    0,
    Math.min(1, 1 - fusedAccuracy / mySample.accuracy),
  );

  return {
    lat: fusedLat,
    lng: fusedLng,
    accuracy: fusedAccuracy,
    contributors: filtered.length,
    scattered: false,
    improvementRatio,
  };
}

/**
 * Throttle 控制 GPS 廣播頻率（避免太密集 spam WebSocket）
 * 預設每 2 秒廣播一次（足夠遊戲用，省頻寬）
 */
export const GPS_BROADCAST_INTERVAL_MS = 2000;
