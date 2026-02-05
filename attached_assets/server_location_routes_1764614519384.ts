/**
 * GPS 地圖導航 - 後端 API 路由
 * 提供地點管理、位置追蹤、導航等 RESTful API
 */

import { Express, Request, Response } from 'express';
import locationService from './server_location_service';

export function registerLocationRoutes(app: Express) {
  // ==================== 地點管理 API ====================

  /**
   * GET /api/locations
   * 取得遊戲的所有地點
   */
  app.get('/api/locations', async (req: Request, res: Response) => {
    try {
      const { game_id, type, status } = req.query;

      if (!game_id) {
        return res.status(400).json({ error: 'game_id is required' });
      }

      const locations = await locationService.getGameLocations(
        Number(game_id),
        {
          type: type as string,
          status: status as string,
        }
      );

      res.json({ locations });
    } catch (error) {
      console.error('Error fetching locations:', error);
      res.status(500).json({ error: 'Failed to fetch locations' });
    }
  });

  /**
   * GET /api/locations/:id
   * 取得單一地點詳細資訊
   */
  app.get('/api/locations/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const location = await locationService.getLocationById(Number(id));

      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }

      res.json(location);
    } catch (error) {
      console.error('Error fetching location:', error);
      res.status(500).json({ error: 'Failed to fetch location' });
    }
  });

  /**
   * POST /api/locations
   * 建立新地點
   */
  app.post('/api/locations', async (req: Request, res: Response) => {
    try {
      const {
        game_id,
        name,
        description,
        latitude,
        longitude,
        location_type,
        icon,
        radius,
        unlock_condition,
        reward,
        order_index,
      } = req.body;

      // 驗證必填欄位
      if (!game_id || !name || !latitude || !longitude || !location_type) {
        return res.status(400).json({
          error: 'game_id, name, latitude, longitude, and location_type are required',
        });
      }

      // 驗證座標範圍
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: 'Invalid coordinates' });
      }

      const location = await locationService.createLocation({
        game_id,
        name,
        description,
        latitude,
        longitude,
        location_type,
        icon,
        radius,
        unlock_condition,
        reward,
        order_index,
      });

      res.status(201).json(location);
    } catch (error) {
      console.error('Error creating location:', error);
      res.status(500).json({ error: 'Failed to create location' });
    }
  });

  /**
   * PUT /api/locations/:id
   * 更新地點資訊
   */
  app.put('/api/locations/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // 驗證座標範圍 (如果有更新)
      if (updates.latitude && (updates.latitude < -90 || updates.latitude > 90)) {
        return res.status(400).json({ error: 'Invalid latitude' });
      }
      if (updates.longitude && (updates.longitude < -180 || updates.longitude > 180)) {
        return res.status(400).json({ error: 'Invalid longitude' });
      }

      const location = await locationService.updateLocation(Number(id), updates);

      res.json(location);
    } catch (error) {
      console.error('Error updating location:', error);
      res.status(500).json({ error: 'Failed to update location' });
    }
  });

  /**
   * DELETE /api/locations/:id
   * 刪除地點
   */
  app.delete('/api/locations/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await locationService.deleteLocation(Number(id));

      res.json({ success: true, message: 'Location deleted successfully' });
    } catch (error) {
      console.error('Error deleting location:', error);
      res.status(500).json({ error: 'Failed to delete location' });
    }
  });

  // ==================== 位置追蹤 API ====================

  /**
   * POST /api/player-location
   * 更新玩家位置
   */
  app.post('/api/player-location', async (req: Request, res: Response) => {
    try {
      const {
        game_session_id,
        player_id,
        latitude,
        longitude,
        accuracy,
        altitude,
        speed,
        heading,
      } = req.body;

      // 驗證必填欄位
      if (!game_session_id || !player_id || !latitude || !longitude) {
        return res.status(400).json({
          error: 'game_session_id, player_id, latitude, and longitude are required',
        });
      }

      // 驗證座標範圍
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: 'Invalid coordinates' });
      }

      const result = await locationService.updatePlayerLocation({
        game_session_id,
        player_id,
        latitude,
        longitude,
        accuracy,
        altitude,
        speed,
        heading,
      });

      res.json(result);
    } catch (error) {
      console.error('Error updating player location:', error);
      res.status(500).json({ error: 'Failed to update player location' });
    }
  });

  /**
   * GET /api/player-location/:sessionId/:playerId
   * 取得玩家當前位置
   */
  app.get(
    '/api/player-location/:sessionId/:playerId',
    async (req: Request, res: Response) => {
      try {
        const { sessionId, playerId } = req.params;

        const location = await locationService.getPlayerCurrentLocation(
          Number(sessionId),
          Number(playerId)
        );

        if (!location) {
          return res.status(404).json({ error: 'Player location not found' });
        }

        res.json(location);
      } catch (error) {
        console.error('Error fetching player location:', error);
        res.status(500).json({ error: 'Failed to fetch player location' });
      }
    }
  );

  /**
   * GET /api/player-location/:sessionId/:playerId/history
   * 取得玩家移動軌跡
   */
  app.get(
    '/api/player-location/:sessionId/:playerId/history',
    async (req: Request, res: Response) => {
      try {
        const { sessionId, playerId } = req.params;
        const { start_time, end_time, limit } = req.query;

        const options: any = {};

        if (start_time) {
          options.start_time = new Date(start_time as string);
        }
        if (end_time) {
          options.end_time = new Date(end_time as string);
        }
        if (limit) {
          options.limit = Number(limit);
        }

        const history = await locationService.getPlayerLocationHistory(
          Number(sessionId),
          Number(playerId),
          options
        );

        res.json({ history });
      } catch (error) {
        console.error('Error fetching location history:', error);
        res.status(500).json({ error: 'Failed to fetch location history' });
      }
    }
  );

  /**
   * GET /api/team-locations/:sessionId
   * 取得團隊成員位置
   */
  app.get('/api/team-locations/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const locations = await locationService.getTeamLocations(Number(sessionId));

      res.json({ locations });
    } catch (error) {
      console.error('Error fetching team locations:', error);
      res.status(500).json({ error: 'Failed to fetch team locations' });
    }
  });

  // ==================== 導航 API ====================

  /**
   * POST /api/navigation/route
   * 計算導航路徑
   */
  app.post('/api/navigation/route', async (req: Request, res: Response) => {
    try {
      const { from, to, mode } = req.body;

      // 驗證必填欄位
      if (!from || !to || !from.lat || !from.lng || !to.lat || !to.lng) {
        return res.status(400).json({
          error: 'from and to coordinates are required',
        });
      }

      // 驗證座標範圍
      if (
        from.lat < -90 ||
        from.lat > 90 ||
        from.lng < -180 ||
        from.lng > 180 ||
        to.lat < -90 ||
        to.lat > 90 ||
        to.lng < -180 ||
        to.lng > 180
      ) {
        return res.status(400).json({ error: 'Invalid coordinates' });
      }

      const route = await locationService.calculateRoute(from, to, mode);

      res.json(route);
    } catch (error) {
      console.error('Error calculating route:', error);
      res.status(500).json({ error: 'Failed to calculate route' });
    }
  });

  /**
   * GET /api/navigation/nearby
   * 取得附近的地點
   */
  app.get('/api/navigation/nearby', async (req: Request, res: Response) => {
    try {
      const { lat, lng, radius, game_id, type } = req.query;

      // 驗證必填欄位
      if (!lat || !lng) {
        return res.status(400).json({ error: 'lat and lng are required' });
      }

      const latitude = Number(lat);
      const longitude = Number(lng);

      // 驗證座標範圍
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: 'Invalid coordinates' });
      }

      const locations = await locationService.getNearbyLocations(
        latitude,
        longitude,
        radius ? Number(radius) : 100,
        game_id ? Number(game_id) : undefined,
        type as string
      );

      res.json({ locations });
    } catch (error) {
      console.error('Error fetching nearby locations:', error);
      res.status(500).json({ error: 'Failed to fetch nearby locations' });
    }
  });

  // ==================== 統計 API ====================

  /**
   * GET /api/player-stats/:sessionId/:playerId
   * 取得玩家造訪統計
   */
  app.get(
    '/api/player-stats/:sessionId/:playerId',
    async (req: Request, res: Response) => {
      try {
        const { sessionId, playerId } = req.params;

        const stats = await locationService.getPlayerVisitStats(
          Number(sessionId),
          Number(playerId)
        );

        res.json(stats);
      } catch (error) {
        console.error('Error fetching player stats:', error);
        res.status(500).json({ error: 'Failed to fetch player stats' });
      }
    }
  );

  console.log('✅ 地點與導航 API 路由已註冊');
}

export default registerLocationRoutes;
