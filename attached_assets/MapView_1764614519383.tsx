/**
 * GPS 地圖導航 - 前端地圖主組件
 * 使用 Leaflet.js 顯示地圖、任務點、玩家位置等
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Users, Target } from 'lucide-react';

// 修復 Leaflet 預設圖示問題
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Location {
  id: number;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  location_type: 'task' | 'checkpoint' | 'item' | 'start' | 'finish' | 'custom';
  icon?: string;
  radius: number;
  status: 'active' | 'inactive' | 'completed';
  reward?: any;
}

interface PlayerPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
}

interface MapViewProps {
  gameId: number;
  sessionId: number;
  playerId: number;
  showPlayerLocation?: boolean;
  showTeammates?: boolean;
  enableNavigation?: boolean;
  onLocationClick?: (location: Location) => void;
  onLocationArrived?: (location: Location) => void;
}

const MapView: React.FC<MapViewProps> = ({
  gameId,
  sessionId,
  playerId,
  showPlayerLocation = true,
  showTeammates = false,
  enableNavigation = true,
  onLocationClick,
  onLocationArrived,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const playerMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const locationMarkersRef = useRef<Map<number, L.Marker>>(new Map());
  const watchIdRef = useRef<number | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [playerPosition, setPlayerPosition] = useState<PlayerPosition | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [nearbyLocations, setNearbyLocations] = useState<any[]>([]);

  // 初始化地圖
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // 建立地圖 (預設中心: 賈村競技體驗場)
    const map = L.map(mapContainerRef.current).setView([24.4324, 118.3786], 16);

    // 加入 OpenStreetMap 圖層
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 載入遊戲地點
  useEffect(() => {
    fetchLocations();
  }, [gameId]);

  // 開始追蹤玩家位置
  useEffect(() => {
    if (showPlayerLocation && !isTracking) {
      startTracking();
    }

    return () => {
      stopTracking();
    };
  }, [showPlayerLocation]);

  // 更新地點標記
  useEffect(() => {
    if (!mapRef.current) return;

    // 清除舊標記
    locationMarkersRef.current.forEach((marker) => marker.remove());
    locationMarkersRef.current.clear();

    // 加入新標記
    locations.forEach((location) => {
      const marker = createLocationMarker(location);
      marker.addTo(mapRef.current!);
      locationMarkersRef.current.set(location.id, marker);
    });
  }, [locations]);

  /**
   * 取得遊戲地點
   */
  const fetchLocations = async () => {
    try {
      const response = await fetch(`/api/locations?game_id=${gameId}&status=active`);
      const data = await response.json();
      setLocations(data.locations || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  /**
   * 建立地點標記
   */
  const createLocationMarker = (location: Location): L.Marker => {
    const icon = getLocationIcon(location.location_type, location.status);

    const marker = L.marker([location.latitude, location.longitude], { icon });

    // 加入彈出視窗
    const popupContent = `
      <div class="location-popup">
        <h3 class="font-bold text-lg mb-2">${location.name}</h3>
        ${location.description ? `<p class="text-sm text-gray-600 mb-2">${location.description}</p>` : ''}
        <div class="flex items-center gap-2 text-sm">
          <span class="px-2 py-1 bg-amber-100 text-amber-800 rounded">
            ${getLocationTypeLabel(location.location_type)}
          </span>
          ${location.status === 'completed' ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded">已完成</span>' : ''}
        </div>
        ${location.reward ? `<p class="text-sm text-green-600 mt-2">🎁 獎勵: ${JSON.stringify(location.reward)}</p>` : ''}
      </div>
    `;

    marker.bindPopup(popupContent);

    // 點擊事件
    marker.on('click', () => {
      if (onLocationClick) {
        onLocationClick(location);
      }
    });

    // 加入觸發範圍圓圈
    L.circle([location.latitude, location.longitude], {
      radius: location.radius,
      color: location.status === 'completed' ? '#22c55e' : '#f59e0b',
      fillColor: location.status === 'completed' ? '#22c55e' : '#f59e0b',
      fillOpacity: 0.1,
      weight: 2,
    }).addTo(mapRef.current!);

    return marker;
  };

  /**
   * 取得地點圖示
   */
  const getLocationIcon = (type: string, status: string): L.Icon => {
    const iconColors = {
      task: status === 'completed' ? '#22c55e' : '#f59e0b',
      checkpoint: status === 'completed' ? '#22c55e' : '#3b82f6',
      item: status === 'completed' ? '#22c55e' : '#8b5cf6',
      start: '#10b981',
      finish: '#ef4444',
      custom: '#6b7280',
    };

    const color = iconColors[type as keyof typeof iconColors] || '#6b7280';

    const iconHtml = `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      ">
        <div style="
          transform: rotate(45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          color: white;
          font-size: 16px;
        ">
          ${getLocationEmoji(type)}
        </div>
      </div>
    `;

    return L.divIcon({
      html: iconHtml,
      className: 'custom-location-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30],
    });
  };

  /**
   * 取得地點 Emoji
   */
  const getLocationEmoji = (type: string): string => {
    const emojis = {
      task: '🎯',
      checkpoint: '🏁',
      item: '🎁',
      start: '🚩',
      finish: '🏆',
      custom: '📍',
    };
    return emojis[type as keyof typeof emojis] || '📍';
  };

  /**
   * 取得地點類型標籤
   */
  const getLocationTypeLabel = (type: string): string => {
    const labels = {
      task: '任務點',
      checkpoint: '檢查點',
      item: '道具點',
      start: '起點',
      finish: '終點',
      custom: '自訂',
    };
    return labels[type as keyof typeof labels] || '未知';
  };

  /**
   * 開始追蹤玩家位置
   */
  const startTracking = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported');
      return;
    }

    setIsTracking(true);

    // 開始持續追蹤
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, heading } = position.coords;

        const newPosition: PlayerPosition = {
          latitude,
          longitude,
          accuracy,
          heading: heading || undefined,
        };

        setPlayerPosition(newPosition);
        updatePlayerMarker(newPosition);
        updatePlayerLocationOnServer(newPosition);
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  /**
   * 停止追蹤玩家位置
   */
  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  };

  /**
   * 更新玩家標記
   */
  const updatePlayerMarker = (position: PlayerPosition) => {
    if (!mapRef.current) return;

    const { latitude, longitude, accuracy, heading } = position;

    // 更新或建立玩家標記
    if (playerMarkerRef.current) {
      playerMarkerRef.current.setLatLng([latitude, longitude]);
    } else {
      const playerIcon = L.divIcon({
        html: `
          <div style="
            background-color: #3b82f6;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
          "></div>
        `,
        className: 'player-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      playerMarkerRef.current = L.marker([latitude, longitude], {
        icon: playerIcon,
        zIndexOffset: 1000,
      }).addTo(mapRef.current);
    }

    // 更新或建立精度圓圈
    if (accuracy) {
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng([latitude, longitude]);
        accuracyCircleRef.current.setRadius(accuracy);
      } else {
        accuracyCircleRef.current = L.circle([latitude, longitude], {
          radius: accuracy,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
          weight: 1,
        }).addTo(mapRef.current);
      }
    }

    // 移動地圖中心 (首次)
    if (!playerMarkerRef.current) {
      mapRef.current.setView([latitude, longitude], 17);
    }
  };

  /**
   * 更新玩家位置到伺服器
   */
  const updatePlayerLocationOnServer = async (position: PlayerPosition) => {
    try {
      const response = await fetch('/api/player-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_session_id: sessionId,
          player_id: playerId,
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
          heading: position.heading,
        }),
      });

      const data = await response.json();

      if (data.nearby_locations) {
        setNearbyLocations(data.nearby_locations);
      }

      // 檢查是否到達任何地點
      if (data.arrived_locations && data.arrived_locations.length > 0) {
        data.arrived_locations.forEach((loc: any) => {
          if (onLocationArrived) {
            onLocationArrived(loc);
          }
        });
      }
    } catch (error) {
      console.error('Error updating player location:', error);
    }
  };

  /**
   * 移動到玩家位置
   */
  const centerOnPlayer = () => {
    if (mapRef.current && playerPosition) {
      mapRef.current.setView([playerPosition.latitude, playerPosition.longitude], 17);
    }
  };

  /**
   * 移動到特定地點
   */
  const centerOnLocation = (location: Location) => {
    if (mapRef.current) {
      mapRef.current.setView([location.latitude, location.longitude], 18);

      // 開啟彈出視窗
      const marker = locationMarkersRef.current.get(location.id);
      if (marker) {
        marker.openPopup();
      }
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* 地圖容器 */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* 控制按鈕 */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
        {showPlayerLocation && (
          <button
            onClick={centerOnPlayer}
            className="p-3 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
            title="移動到我的位置"
          >
            <Navigation className="w-5 h-5 text-blue-600" />
          </button>
        )}

        {showTeammates && (
          <button
            className="p-3 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
            title="顯示團隊成員"
          >
            <Users className="w-5 h-5 text-green-600" />
          </button>
        )}
      </div>

      {/* 附近地點列表 */}
      {nearbyLocations.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 max-h-48 overflow-y-auto z-[1000]">
          <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" />
            附近地點
          </h3>
          <div className="space-y-2">
            {nearbyLocations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center justify-between text-sm p-2 hover:bg-gray-50 rounded cursor-pointer"
                onClick={() => {
                  const location = locations.find((l) => l.id === loc.id);
                  if (location) centerOnLocation(location);
                }}
              >
                <div>
                  <div className="font-medium">{loc.name}</div>
                  <div className="text-gray-500 text-xs">
                    {loc.distance.toFixed(1)}m · {loc.direction}
                  </div>
                </div>
                <MapPin className="w-4 h-4 text-amber-600" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 追蹤狀態指示器 */}
      {isTracking && (
        <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 z-[1000]">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          定位中
        </div>
      )}
    </div>
  );
};

export default MapView;
