/**
 * GPS 地圖導航 - 導航面板組件
 * 顯示導航資訊、距離、方向、預估時間等
 */

import React, { useEffect, useState } from 'react';
import { Navigation, X, MapPin, Clock, TrendingUp } from 'lucide-react';

interface Location {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

interface PlayerPosition {
  latitude: number;
  longitude: number;
}

interface NavigationPanelProps {
  destination: Location | null;
  playerPosition: PlayerPosition | null;
  onCancel: () => void;
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({
  destination,
  playerPosition,
  onCancel,
}) => {
  const [distance, setDistance] = useState<number>(0);
  const [bearing, setBearing] = useState<number>(0);
  const [direction, setDirection] = useState<string>('');
  const [estimatedTime, setEstimatedTime] = useState<number>(0);

  useEffect(() => {
    if (!destination || !playerPosition) return;

    // 計算距離與方向
    const dist = calculateDistance(
      playerPosition.latitude,
      playerPosition.longitude,
      destination.latitude,
      destination.longitude
    );

    const bear = calculateBearing(
      playerPosition.latitude,
      playerPosition.longitude,
      destination.latitude,
      destination.longitude
    );

    const dir = bearingToDirection(bear);
    const time = calculateEstimatedTime(dist, 'walking');

    setDistance(dist);
    setBearing(bear);
    setDirection(dir);
    setEstimatedTime(time);
  }, [destination, playerPosition]);

  /**
   * 計算兩點之間的距離 (Haversine Formula)
   */
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  /**
   * 計算方向角度
   */
  const calculateBearing = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);

    return ((θ * 180) / Math.PI + 360) % 360;
  };

  /**
   * 將角度轉換為方向文字
   */
  const bearingToDirection = (bearing: number): string => {
    const directions = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  };

  /**
   * 計算預估時間
   */
  const calculateEstimatedTime = (
    distance: number,
    mode: 'walking' | 'running' = 'walking'
  ): number => {
    const speeds = {
      walking: 1.4,
      running: 2.8,
    };
    return Math.ceil(distance / speeds[mode]);
  };

  /**
   * 格式化時間
   */
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} 秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} 分鐘`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} 小時 ${minutes} 分鐘`;
    }
  };

  /**
   * 格式化距離
   */
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} 公尺`;
    } else {
      return `${(meters / 1000).toFixed(2)} 公里`;
    }
  };

  /**
   * 取得方向箭頭
   */
  const getDirectionArrow = (bearing: number): string => {
    const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    const index = Math.round(bearing / 45) % 8;
    return arrows[index];
  };

  if (!destination) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-4 rounded-lg shadow-lg">
      {/* 標題列 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5" />
          <h3 className="font-bold text-lg">導航中</h3>
        </div>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          title="取消導航"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 目的地 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="w-4 h-4" />
          <span className="text-sm opacity-90">目的地</span>
        </div>
        <div className="text-xl font-bold">{destination.name}</div>
      </div>

      {/* 導航資訊 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* 距離 */}
        <div className="bg-white/10 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold mb-1">{formatDistance(distance)}</div>
          <div className="text-xs opacity-75">距離</div>
        </div>

        {/* 方向 */}
        <div className="bg-white/10 rounded-lg p-3 text-center">
          <div className="text-3xl mb-1">{getDirectionArrow(bearing)}</div>
          <div className="text-xs opacity-75">{direction}</div>
        </div>

        {/* 預估時間 */}
        <div className="bg-white/10 rounded-lg p-3 text-center">
          <div className="text-sm font-bold mb-1">{formatTime(estimatedTime)}</div>
          <div className="text-xs opacity-75 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" />
            預估
          </div>
        </div>
      </div>

      {/* 距離提示 */}
      {distance < 50 && (
        <div className="bg-green-500 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 animate-pulse">
          <TrendingUp className="w-4 h-4" />
          即將到達目的地!
        </div>
      )}

      {distance >= 50 && distance < 100 && (
        <div className="bg-yellow-500 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          接近目的地,請注意周圍環境
        </div>
      )}
    </div>
  );
};

export default NavigationPanel;
