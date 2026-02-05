/**
 * GPS 地圖導航 - 後端地點與導航服務
 * 提供地點管理、位置追蹤、導航計算等功能
 */

import { db } from '../db';

// ==================== 工具函數 ====================

/**
 * 計算兩點之間的距離 (Haversine Formula)
 * @param lat1 起點緯度
 * @param lon1 起點經度
 * @param lat2 終點緯度
 * @param lon2 終點經度
 * @returns 距離 (公尺)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // 地球半徑 (公尺)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * 計算方向角度 (Bearing)
 * @param lat1 起點緯度
 * @param lon1 起點經度
 * @param lat2 終點緯度
 * @param lon2 終點經度
 * @returns 方向角度 (0-360度)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * 將角度轉換為方向文字
 * @param bearing 角度 (0-360)
 * @returns 方向文字 (如 "北", "東北")
 */
export function bearingToDirection(bearing: number): string {
  const directions = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

/**
 * 計算預估時間
 * @param distance 距離 (公尺)
 * @param mode 移動模式 (walking, running, cycling)
 * @returns 預估時間 (秒)
 */
export function calculateEstimatedTime(
  distance: number,
  mode: 'walking' | 'running' | 'cycling' = 'walking'
): number {
  // 平均速度 (公尺/秒)
  const speeds = {
    walking: 1.4, // 步行 5 km/h
    running: 2.8, // 跑步 10 km/h
    cycling: 4.2, // 騎車 15 km/h
  };

  return Math.ceil(distance / speeds[mode]);
}

// ==================== 地點管理服務 ====================

export interface Location {
  id: number;
  game_id: number;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  location_type: 'task' | 'checkpoint' | 'item' | 'start' | 'finish' | 'custom';
  icon?: string;
  radius: number;
  unlock_condition?: any;
  reward?: any;
  status: 'active' | 'inactive' | 'completed';
  order_index?: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * 取得遊戲的所有地點
 */
export async function getGameLocations(
  gameId: number,
  filters?: {
    type?: string;
    status?: string;
  }
): Promise<Location[]> {
  let query = db
    .selectFrom('locations')
    .selectAll()
    .where('game_id', '=', gameId)
    .orderBy('order_index', 'asc');

  if (filters?.type) {
    query = query.where('location_type', '=', filters.type);
  }

  if (filters?.status) {
    query = query.where('status', '=', filters.status);
  }

  return await query.execute();
}

/**
 * 取得單一地點詳細資訊
 */
export async function getLocationById(locationId: number): Promise<Location | null> {
  const location = await db
    .selectFrom('locations')
    .selectAll()
    .where('id', '=', locationId)
    .executeTakeFirst();

  return location || null;
}

/**
 * 建立新地點
 */
export async function createLocation(data: {
  game_id: number;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  location_type: string;
  icon?: string;
  radius?: number;
  unlock_condition?: any;
  reward?: any;
  order_index?: number;
}): Promise<Location> {
  const result = await db
    .insertInto('locations')
    .values({
      ...data,
      radius: data.radius || 10,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return result;
}

/**
 * 更新地點資訊
 */
export async function updateLocation(
  locationId: number,
  data: Partial<Location>
): Promise<Location> {
  const result = await db
    .updateTable('locations')
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where('id', '=', locationId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return result;
}

/**
 * 刪除地點
 */
export async function deleteLocation(locationId: number): Promise<void> {
  await db.deleteFrom('locations').where('id', '=', locationId).execute();
}

// ==================== 位置追蹤服務 ====================

export interface PlayerLocation {
  id: number;
  game_session_id: number;
  player_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: Date;
}

/**
 * 更新玩家位置
 */
export async function updatePlayerLocation(data: {
  game_session_id: number;
  player_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
}): Promise<{
  success: boolean;
  nearby_locations: Array<{
    id: number;
    name: string;
    distance: number;
    direction: string;
    bearing: number;
  }>;
  arrived_locations: Array<{
    id: number;
    name: string;
    reward?: any;
  }>;
}> {
  // 儲存玩家位置
  await db
    .insertInto('player_locations')
    .values({
      ...data,
      timestamp: new Date(),
    })
    .execute();

  // 取得遊戲的所有地點
  const session = await db
    .selectFrom('game_sessions')
    .select('game_id')
    .where('id', '=', data.game_session_id)
    .executeTakeFirst();

  if (!session) {
    return { success: true, nearby_locations: [], arrived_locations: [] };
  }

  const locations = await getGameLocations(session.game_id, { status: 'active' });

  // 計算附近的地點
  const nearbyLocations = locations
    .map((loc) => {
      const distance = calculateDistance(
        data.latitude,
        data.longitude,
        loc.latitude,
        loc.longitude
      );
      const bearing = calculateBearing(
        data.latitude,
        data.longitude,
        loc.latitude,
        loc.longitude
      );
      const direction = bearingToDirection(bearing);

      return {
        id: loc.id,
        name: loc.name,
        distance: Math.round(distance * 10) / 10,
        direction,
        bearing: Math.round(bearing),
        radius: loc.radius,
      };
    })
    .filter((loc) => loc.distance <= 100) // 100公尺內
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5); // 最多5個

  // 檢查是否到達任何地點
  const arrivedLocations: Array<{ id: number; name: string; reward?: any }> = [];

  for (const loc of nearbyLocations) {
    if (loc.distance <= loc.radius) {
      // 檢查是否已經造訪過
      const visited = await db
        .selectFrom('location_visits')
        .selectAll()
        .where('location_id', '=', loc.id)
        .where('game_session_id', '=', data.game_session_id)
        .where('player_id', '=', data.player_id)
        .where('completed', '=', true)
        .executeTakeFirst();

      if (!visited) {
        // 記錄造訪
        await db
          .insertInto('location_visits')
          .values({
            location_id: loc.id,
            game_session_id: data.game_session_id,
            player_id: data.player_id,
            distance_from_center: loc.distance,
            completed: true,
            visited_at: new Date(),
          })
          .execute();

        // 取得地點資訊
        const location = await getLocationById(loc.id);
        if (location) {
          arrivedLocations.push({
            id: location.id,
            name: location.name,
            reward: location.reward,
          });
        }
      }
    }
  }

  return {
    success: true,
    nearby_locations: nearbyLocations.map(({ radius, ...rest }) => rest),
    arrived_locations: arrivedLocations,
  };
}

/**
 * 取得玩家當前位置
 */
export async function getPlayerCurrentLocation(
  sessionId: number,
  playerId: number
): Promise<PlayerLocation | null> {
  const location = await db
    .selectFrom('player_locations')
    .selectAll()
    .where('game_session_id', '=', sessionId)
    .where('player_id', '=', playerId)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .executeTakeFirst();

  return location || null;
}

/**
 * 取得玩家移動軌跡
 */
export async function getPlayerLocationHistory(
  sessionId: number,
  playerId: number,
  options?: {
    start_time?: Date;
    end_time?: Date;
    limit?: number;
  }
): Promise<PlayerLocation[]> {
  let query = db
    .selectFrom('player_locations')
    .selectAll()
    .where('game_session_id', '=', sessionId)
    .where('player_id', '=', playerId)
    .orderBy('timestamp', 'desc');

  if (options?.start_time) {
    query = query.where('timestamp', '>=', options.start_time);
  }

  if (options?.end_time) {
    query = query.where('timestamp', '<=', options.end_time);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  return await query.execute();
}

/**
 * 取得團隊成員位置
 */
export async function getTeamLocations(
  sessionId: number
): Promise<Array<PlayerLocation & { player_name: string }>> {
  const locations = await db
    .selectFrom('player_locations')
    .innerJoin('users', 'users.id', 'player_locations.player_id')
    .select([
      'player_locations.id',
      'player_locations.game_session_id',
      'player_locations.player_id',
      'player_locations.latitude',
      'player_locations.longitude',
      'player_locations.accuracy',
      'player_locations.altitude',
      'player_locations.speed',
      'player_locations.heading',
      'player_locations.timestamp',
      'users.username as player_name',
    ])
    .where('player_locations.game_session_id', '=', sessionId)
    .where(
      'player_locations.timestamp',
      '>',
      new Date(Date.now() - 60000) // 最近1分鐘
    )
    .distinctOn('player_locations.player_id')
    .orderBy('player_locations.player_id')
    .orderBy('player_locations.timestamp', 'desc')
    .execute();

  return locations;
}

// ==================== 導航服務 ====================

/**
 * 計算導航路徑
 */
export async function calculateRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: 'walking' | 'running' | 'cycling' = 'walking'
): Promise<{
  distance: number;
  duration: number;
  path: Array<{ lat: number; lng: number }>;
}> {
  // 簡單實作: 直線路徑
  // 進階版可整合 OSRM 或 Google Directions API
  const distance = calculateDistance(from.lat, from.lng, to.lat, to.lng);
  const duration = calculateEstimatedTime(distance, mode);

  // 生成簡單的路徑點 (直線)
  const path = [
    { lat: from.lat, lng: from.lng },
    { lat: to.lat, lng: to.lng },
  ];

  return {
    distance: Math.round(distance * 10) / 10,
    duration,
    path,
  };
}

/**
 * 取得附近的地點
 */
export async function getNearbyLocations(
  lat: number,
  lng: number,
  radius: number = 100,
  gameId?: number,
  type?: string
): Promise<
  Array<{
    id: number;
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    location_type: string;
    distance: number;
    direction: string;
  }>
> {
  let query = db.selectFrom('locations').selectAll().where('status', '=', 'active');

  if (gameId) {
    query = query.where('game_id', '=', gameId);
  }

  if (type) {
    query = query.where('location_type', '=', type);
  }

  const locations = await query.execute();

  // 計算距離並篩選
  const nearbyLocations = locations
    .map((loc) => {
      const distance = calculateDistance(lat, lng, loc.latitude, loc.longitude);
      const bearing = calculateBearing(lat, lng, loc.latitude, loc.longitude);
      const direction = bearingToDirection(bearing);

      return {
        id: loc.id,
        name: loc.name,
        description: loc.description,
        latitude: loc.latitude,
        longitude: loc.longitude,
        location_type: loc.location_type,
        distance: Math.round(distance * 10) / 10,
        direction,
      };
    })
    .filter((loc) => loc.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  return nearbyLocations;
}

// ==================== 統計服務 ====================

/**
 * 取得玩家造訪統計
 */
export async function getPlayerVisitStats(
  sessionId: number,
  playerId: number
): Promise<{
  total_locations: number;
  visited_locations: number;
  completion_rate: number;
  total_distance: number;
}> {
  // 取得遊戲總地點數
  const session = await db
    .selectFrom('game_sessions')
    .select('game_id')
    .where('id', '=', sessionId)
    .executeTakeFirst();

  if (!session) {
    return {
      total_locations: 0,
      visited_locations: 0,
      completion_rate: 0,
      total_distance: 0,
    };
  }

  const totalLocations = await db
    .selectFrom('locations')
    .select(db.fn.count('id').as('count'))
    .where('game_id', '=', session.game_id)
    .where('status', '=', 'active')
    .executeTakeFirst();

  // 取得已造訪地點數
  const visitedLocations = await db
    .selectFrom('location_visits')
    .select(db.fn.countDistinct('location_id').as('count'))
    .where('game_session_id', '=', sessionId)
    .where('player_id', '=', playerId)
    .where('completed', '=', true)
    .executeTakeFirst();

  // 計算總移動距離
  const locations = await getPlayerLocationHistory(sessionId, playerId);
  let totalDistance = 0;

  for (let i = 1; i < locations.length; i++) {
    const distance = calculateDistance(
      locations[i - 1].latitude,
      locations[i - 1].longitude,
      locations[i].latitude,
      locations[i].longitude
    );
    totalDistance += distance;
  }

  const total = Number(totalLocations?.count || 0);
  const visited = Number(visitedLocations?.count || 0);

  return {
    total_locations: total,
    visited_locations: visited,
    completion_rate: total > 0 ? Math.round((visited / total) * 100) : 0,
    total_distance: Math.round(totalDistance),
  };
}

export default {
  // 工具函數
  calculateDistance,
  calculateBearing,
  bearingToDirection,
  calculateEstimatedTime,

  // 地點管理
  getGameLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,

  // 位置追蹤
  updatePlayerLocation,
  getPlayerCurrentLocation,
  getPlayerLocationHistory,
  getTeamLocations,

  // 導航
  calculateRoute,
  getNearbyLocations,

  // 統計
  getPlayerVisitStats,
};
