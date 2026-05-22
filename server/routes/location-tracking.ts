// 玩家位置追蹤、地點造訪、導航計算路由
import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest, RouteContext } from "./types";
import {
  insertPlayerLocationSchema,
  insertLocationVisitSchema,
} from "@shared/schema";
import { hotPathLimiter } from "../utils/rate-limiters";
import { verifyVisit, type VerifyMethod, type VerifyPayload } from "../lib/location-verification";

export function registerLocationTrackingRoutes(app: Express, ctx: RouteContext) {
  // ===========================================
  // Player Location Tracking Routes
  // ===========================================

  app.post("/api/sessions/:sessionId/player-location", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const locationData = insertPlayerLocationSchema.parse({
        gameSessionId: sessionId,
        playerId: userId,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        accuracy: req.body.accuracy,
        heading: req.body.heading,
        speed: req.body.speed,
        altitude: req.body.altitude,
      });

      const newLocation = await storage.createPlayerLocation(locationData);

      ctx.broadcastToSession(sessionId, {
        type: "player_location_update",
        playerId: userId,
        location: {
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
          timestamp: newLocation.timestamp,
        },
      });

      res.status(201).json(newLocation);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'errors' in error) {
        return res.status(400).json({ message: "Validation error", errors: (error as { errors: unknown }).errors });
      }
      res.status(500).json({ message: "Failed to update player location" });
    }
  });

  app.get("/api/sessions/:sessionId/team-locations", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const teamLocations = await storage.getTeamLocations(sessionId);

      const latestByPlayer = new Map();
      for (const loc of teamLocations) {
        if (!latestByPlayer.has(loc.playerId)) {
          latestByPlayer.set(loc.playerId, loc);
        }
      }

      res.json(Array.from(latestByPlayer.values()));
    } catch (_error) {
      res.status(500).json({ message: "Failed to fetch team locations" });
    }
  });

  app.get("/api/sessions/:sessionId/players/:playerId/location-history", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId, playerId } = req.params;
      const { startTime, endTime, limit } = req.query;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // 🔒 §19 隱私保護：只能查自己軌跡，或同隊隊友軌跡
      if (playerId !== userId) {
        // 看是否同隊：取雙方 progress，比對 teamId
        const progressList = await storage.getPlayerProgress(sessionId);
        const me = progressList.find((p) => p.userId === userId);
        const target = progressList.find((p) => p.userId === playerId);
        const sameTeam = me && target && (me as any).teamId
          && (me as any).teamId === (target as any).teamId;
        if (!sameTeam) {
          return res.status(403).json({ message: "無權查看他人軌跡" });
        }
      }

      const options: { startTime?: Date; endTime?: Date; limit?: number } = {};
      if (startTime && typeof startTime === 'string') options.startTime = new Date(startTime);
      if (endTime && typeof endTime === 'string') options.endTime = new Date(endTime);
      if (limit && typeof limit === 'string') options.limit = parseInt(limit);

      const history = await storage.getPlayerLocationHistory(sessionId, playerId, options);
      res.json(history);
    } catch (_error) {
      res.status(500).json({ message: "Failed to fetch location history" });
    }
  });

  // ===========================================
  // Location Visit Routes
  // ===========================================

  app.post("/api/sessions/:sessionId/locations/:locationId/visit", isAuthenticated, hotPathLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId, locationId } = req.params;
      const userId = req.user?.claims?.sub;
      const locId = parseInt(locationId);

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (isNaN(locId)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // 🔒 §19 防作弊：必須是 session 的玩家才能打卡
      const progressList = await storage.getPlayerProgress(sessionId);
      const isInSession = progressList.some((p) => p.userId === userId);
      if (!isInSession) {
        return res.status(403).json({ message: "您不在此遊戲場次中" });
      }

      const location = await storage.getLocation(locId);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }

      // 🔒 §19 防作弊：location 必須屬於此 session 對應的 game
      if (location.gameId !== session.gameId) {
        return res.status(400).json({ message: "Location 不屬於此遊戲" });
      }

      const alreadyVisited = await storage.hasVisitedLocation(locId, sessionId, userId);
      if (alreadyVisited) {
        return res.status(400).json({ message: "Location already visited" });
      }

      const visitData = insertLocationVisitSchema.parse({
        locationId: locId,
        gameSessionId: sessionId,
        playerId: userId,
        completed: true,
      });

      const visit = await storage.createLocationVisit(visitData);
      const earnedPoints = location.points || 0;

      // 已於前面取得 progressList（避免重複 query）
      const playerProgressEntry = progressList.find(p => p.userId === userId);
      if (playerProgressEntry) {
        const currentScore = playerProgressEntry.score || 0;
        await storage.updatePlayerProgress(playerProgressEntry.id, {
          score: currentScore + earnedPoints,
        });
      }

      ctx.broadcastToSession(sessionId, {
        type: "location_visited",
        playerId: userId,
        locationId: locId,
        locationName: location.name,
        pointsEarned: earnedPoints,
      });

      res.status(201).json(visit);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'errors' in error) {
        return res.status(400).json({ message: "Validation error", errors: (error as { errors: unknown }).errors });
      }
      res.status(500).json({ message: "Failed to record location visit" });
    }
  });

  app.get("/api/sessions/:sessionId/visits", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.claims?.sub;
      const { playerId } = req.query;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const targetPlayerId = typeof playerId === 'string' ? playerId : userId;

      // 🔒 §19 隱私保護：只能查自己 visits 或同隊
      if (targetPlayerId !== userId) {
        const progressList = await storage.getPlayerProgress(sessionId);
        const me = progressList.find((p) => p.userId === userId);
        const target = progressList.find((p) => p.userId === targetPlayerId);
        const sameTeam = me && target && (me as any).teamId
          && (me as any).teamId === (target as any).teamId;
        if (!sameTeam) {
          return res.status(403).json({ message: "無權查看他人 visits" });
        }
      }

      const visits = await storage.getLocationVisits(sessionId, targetPlayerId);
      res.json(visits);
    } catch (_error) {
      res.status(500).json({ message: "Failed to fetch location visits" });
    }
  });

  // ===========================================
  // Navigation Calculation Routes
  // ===========================================

  app.post("/api/navigation/calculate", isAuthenticated, async (req, res) => {
    try {
      const { currentLat, currentLng, targetLat, targetLng } = req.body;

      if (typeof currentLat !== 'number' || typeof currentLng !== 'number' ||
          typeof targetLat !== 'number' || typeof targetLng !== 'number') {
        return res.status(400).json({ message: "Invalid coordinates" });
      }

      // 🌐 統一用 server/lib/geo.ts（前後端共用同一邏輯）
      const { distanceMeters, bearingDegrees, bearingToCompass } = await import("../lib/geo");
      const distance = distanceMeters(currentLat, currentLng, targetLat, targetLng);
      const bearing = bearingDegrees(currentLat, currentLng, targetLat, targetLng);

      res.json({
        distance: Math.round(distance),
        bearing: Math.round(bearing),
        direction: bearingToCompass(bearing),
        estimatedTime: Math.ceil(distance / 83.33), // 5km/h ≈ 83.33 m/min
      });
    } catch (_error) {
      res.status(500).json({ message: "Failed to calculate navigation" });
    }
  });

  app.post("/api/navigation/check-proximity", isAuthenticated, async (req, res) => {
    try {
      const { locationId, playerLat, playerLng } = req.body;
      const locId = parseInt(locationId);

      if (isNaN(locId) || typeof playerLat !== 'number' || typeof playerLng !== 'number') {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      const location = await storage.getLocation(locId);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }

      const locLat = parseFloat(location.latitude || "0");
      const locLng = parseFloat(location.longitude || "0");

      // 🌐 統一 Haversine
      const { distanceMeters } = await import("../lib/geo");
      const distance = distanceMeters(playerLat, playerLng, locLat, locLng);
      const isWithinRange = distance <= (location.radius || 50);

      res.json({
        locationId: locId,
        locationName: location.name,
        distance: Math.round(distance),
        radius: location.radius || 50,
        isWithinRange,
      });
    } catch (_error) {
      res.status(500).json({ message: "Failed to check proximity" });
    }
  });
}
