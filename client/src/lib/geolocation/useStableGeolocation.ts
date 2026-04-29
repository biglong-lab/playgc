// 🛰️ 穩定 GPS Hook — 多採樣 + 中位數 + 1D Kalman 濾波
//
// 為什麼需要：
//   原本：直接用 watchPosition → 單次採樣有大誤差 → 玩家覺得「定位差很遠」
//
//   問題情境：
//   - GPS 暖機未完成（前 30 秒精度差）
//   - 室內 / 高樓峽谷 → 多路徑反射造成跳點
//   - 雲層 / 對流層延遲 → 微小漂移
//   - WiFi 定位忽然搶先 → 一下準一下不準
//
// 解法：
//   1. 連續採樣 N 個點
//   2. 用緯度 / 經度的中位數過濾離群（比平均數抗極端）
//   3. 1D Kalman 濾波平滑軌跡（給導航箭頭用）
//   4. 弱訊號時友善降級（顯示警示，不直接拋錯）
//
// API：
//   const { position, accuracy, quality, error, samples, retry } = useStableGeolocation({
//     mode: "watch",        // 持續追蹤 / "once" 一次取
//     sampleSize: 5,        // 維持的最近採樣數
//     onUpdate: (pos) => {} // 每次穩定後 callback
//   });

import { useEffect, useRef, useState, useCallback } from "react";
import { median, classifyAccuracy, type GpsQuality } from "./geo-utils";
import { useImuPositioning, type ImuAnchor } from "./useImuPositioning";

export interface StablePosition {
  lat: number;
  lng: number;
  accuracy: number;
  /** 原始 GPS 時間戳（裝置產生）*/
  timestamp: number;
  /** 是否為平滑後的位置（false = 第一次採樣，無平滑）*/
  smoothed: boolean;
  /** 用了幾個樣本來計算這次的位置 */
  samplesUsed: number;
}

export interface UseStableGeolocationOptions {
  /** "watch"（持續追蹤）或 "once"（一次取） */
  mode?: "watch" | "once";
  /** 維持的最近採樣數（預設 5）*/
  sampleSize?: number;
  /** 採樣間隔下限（毫秒，太密集沒意義；預設 1000）*/
  minSampleIntervalMs?: number;
  /** 1D Kalman 濾波器強度（0=不平滑、1=完全沿用前次；預設 0.3）*/
  smoothingFactor?: number;
  /** 每次穩定位置更新時 callback */
  onUpdate?: (pos: StablePosition) => void;
  /** GPS 取得失敗 callback */
  onError?: (err: GeolocationPositionError) => void;
  /** 是否啟用（預設 true；可動態關閉避免電量消耗）*/
  enabled?: boolean;
  /**
   * 🧭 IMU PDR fallback（預設 false）
   * 啟用後：GPS 失效（accuracy > 100m 或 timeout）時自動用步數+朝向推算位置
   * 注意：iOS 14+ 需要使用者點按鈕授權 DeviceMotion，請呼叫 requestMotionPermission()
   */
  imuFallback?: boolean;
}

export interface UseStableGeolocationResult {
  /** 經過平滑處理的位置（穩定可用）*/
  position: StablePosition | null;
  /** 即時最後一次採樣（未平滑，有跳動）*/
  rawPosition: StablePosition | null;
  /** 當前 accuracy（公尺）*/
  accuracy: number | null;
  /** 精度等級（給玩家看）*/
  quality: GpsQuality;
  /** 採樣數（≥3 才算穩定）*/
  samples: number;
  /** GPS 是否在運作 */
  active: boolean;
  /** 錯誤訊息 */
  error: GeolocationPositionError | null;
  /** 重試（once 模式失敗後重抓）*/
  retry: () => void;
  /** 強制重置採樣緩衝（場景切換時呼叫）*/
  reset: () => void;
  /** 🧭 IMU 是否正在補位（GPS 失效時 true）*/
  imuActive: boolean;
  /** IMU 累積步數（從 anchor 起算）*/
  imuSteps: number;
}

/**
 * 1D Kalman filter（簡化版）
 * 給定前次位置 + 新測量 + 不確定度，回傳平滑後位置
 *
 * 思路：accuracy 越好（小）→ 越相信新測量
 *      accuracy 越差（大）→ 越信任前次預測
 */
function kalmanStep(
  prev: number,
  prevAccuracy: number,
  measured: number,
  measuredAccuracy: number,
): { value: number; accuracy: number } {
  // 卡爾曼增益：K = P / (P + R)
  // P = 過程方差（前次精度平方）
  // R = 觀測方差（當前精度平方）
  const P = prevAccuracy * prevAccuracy;
  const R = measuredAccuracy * measuredAccuracy;
  const K = P / (P + R);

  const value = prev + K * (measured - prev);
  const accuracy = Math.sqrt((1 - K) * P);

  return { value, accuracy };
}

/**
 * GeolocationOptions 統一設定
 *   - enableHighAccuracy: true → 強制用 GPS + WiFi + 基地台（不單靠 IP）
 *   - timeout: 15000 → 室內 GPS 暖機可能要 10s+，給 15s 緩衝
 *   - maximumAge: 0 → 不用快取，每次都要新位置
 */
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

export function useStableGeolocation(
  options: UseStableGeolocationOptions = {},
): UseStableGeolocationResult {
  const {
    mode = "watch",
    sampleSize = 5,
    minSampleIntervalMs = 1000,
    smoothingFactor = 0.3,
    onUpdate,
    onError,
    enabled = true,
    imuFallback = false,
  } = options;

  const [position, setPosition] = useState<StablePosition | null>(null);
  const [rawPosition, setRawPosition] = useState<StablePosition | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [active, setActive] = useState(false);

  const sampleBufferRef = useRef<StablePosition[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const lastSampleAtRef = useRef<number>(0);
  // smoothed state（用 ref 避免每次 setState）
  const smoothedRef = useRef<{ lat: number; lng: number; accLat: number; accLng: number } | null>(null);

  const reset = useCallback(() => {
    sampleBufferRef.current = [];
    smoothedRef.current = null;
    setPosition(null);
    setRawPosition(null);
    setError(null);
  }, []);

  const handlePosition = useCallback(
    (geoPos: GeolocationPosition) => {
      const now = Date.now();

      // 採樣間隔限制（避免高頻率採樣）
      if (now - lastSampleAtRef.current < minSampleIntervalMs) return;
      lastSampleAtRef.current = now;

      const sample: StablePosition = {
        lat: geoPos.coords.latitude,
        lng: geoPos.coords.longitude,
        accuracy: geoPos.coords.accuracy,
        timestamp: geoPos.timestamp,
        smoothed: false,
        samplesUsed: 1,
      };

      setRawPosition(sample);

      // 加入採樣緩衝
      sampleBufferRef.current.push(sample);
      if (sampleBufferRef.current.length > sampleSize) {
        sampleBufferRef.current.shift();
      }

      // 採樣數不足 → 直接用最新點（先給玩家看，避免空白）
      if (sampleBufferRef.current.length < 3) {
        setPosition(sample);
        onUpdate?.(sample);
        return;
      }

      // 中位數過濾離群（緯度、經度分別取中位數）
      const lats = sampleBufferRef.current.map((s) => s.lat);
      const lngs = sampleBufferRef.current.map((s) => s.lng);
      const accs = sampleBufferRef.current.map((s) => s.accuracy);
      const medianLat = median(lats);
      const medianLng = median(lngs);
      const medianAcc = median(accs);

      // 1D Kalman 平滑（緯度 / 經度分開處理）
      let smoothLat = medianLat;
      let smoothLng = medianLng;
      let smoothAcc = medianAcc;

      if (smoothedRef.current) {
        const r = kalmanStep(
          smoothedRef.current.lat,
          smoothedRef.current.accLat,
          medianLat,
          medianAcc,
        );
        const r2 = kalmanStep(
          smoothedRef.current.lng,
          smoothedRef.current.accLng,
          medianLng,
          medianAcc,
        );
        smoothLat = r.value;
        smoothLng = r2.value;
        smoothAcc = (r.accuracy + r2.accuracy) / 2;
      }

      // 額外：smoothingFactor 加權（保留設定彈性）
      const finalLat = smoothedRef.current
        ? smoothedRef.current.lat * smoothingFactor + smoothLat * (1 - smoothingFactor)
        : smoothLat;
      const finalLng = smoothedRef.current
        ? smoothedRef.current.lng * smoothingFactor + smoothLng * (1 - smoothingFactor)
        : smoothLng;

      smoothedRef.current = {
        lat: finalLat,
        lng: finalLng,
        accLat: smoothAcc,
        accLng: smoothAcc,
      };

      const stable: StablePosition = {
        lat: finalLat,
        lng: finalLng,
        accuracy: smoothAcc,
        timestamp: now,
        smoothed: true,
        samplesUsed: sampleBufferRef.current.length,
      };

      setPosition(stable);
      onUpdate?.(stable);
    },
    [minSampleIntervalMs, sampleSize, smoothingFactor, onUpdate],
  );

  const handleError = useCallback(
    (err: GeolocationPositionError) => {
      setError(err);
      setActive(false);
      onError?.(err);
    },
    [onError],
  );

  // 重試（once 模式 / 出錯後）
  const retry = useCallback(() => {
    if (!navigator.geolocation) return;
    setError(null);
    reset();
    if (mode === "once") {
      setActive(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handlePosition(pos);
          setActive(false);
        },
        (err) => {
          handleError(err);
        },
        GEO_OPTIONS,
      );
    }
  }, [mode, handlePosition, handleError, reset]);

  // 啟動 / 停止 GPS
  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      setActive(false);
      return;
    }

    setActive(true);
    setError(null);

    if (mode === "watch") {
      const id = navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        GEO_OPTIONS,
      );
      watchIdRef.current = id;

      return () => {
        if (watchIdRef.current != null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        setActive(false);
      };
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handlePosition(pos);
          setActive(false);
        },
        (err) => {
          handleError(err);
        },
        GEO_OPTIONS,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, enabled]);

  const accuracy = position?.accuracy ?? null;
  const quality = classifyAccuracy(accuracy);

  return {
    position,
    rawPosition,
    accuracy,
    quality,
    samples: sampleBufferRef.current.length,
    active,
    error,
    retry,
    reset,
  };
}
