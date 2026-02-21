// 玩家位置追蹤、地點造訪、導航計算路由
import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest, RouteContext } from "./types";
import {
  insertPlayerLocationSchema,
  insertLocationVisitSchema,
} from "@shared/schema";

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

  app.get("/api/sessions/:sessionId/players/:playerId/location-history", isAuthenticated, async (req, res) => {
    try {
      const { sessionId, playerId } = req.params;
      const { startTime, endTime, limit } = req.query;

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
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

  app.post("/api/sessions/:sessionId/locations/:locationId/visit", isAuthenticated, async (req: AuthenticatedRequest, res) => {
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

      const location = await storage.getLocation(locId);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
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

      const progressList = await storage.getPlayerProgress(sessionId);
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

      const R = 6371e3;
      const φ1 = currentLat * Math.PI / 180;
      const φ2 = targetLat * Math.PI / 180;
      const Δφ = (targetLat - currentLat) * Math.PI / 180;
      const Δλ = (targetLng - currentLng) * Math.PI / 180;

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      const y = Math.sin(Δλ) * Math.cos(φ2);
      const x = Math.cos(φ1) * Math.sin(φ2) -
                Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
      const θ = Math.atan2(y, x);
      const bearing = (θ * 180 / Math.PI + 360) % 360;

      const directions = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];
      const directionIndex = Math.round(bearing / 45) % 8;

      res.json({
        distance: Math.round(distance),
        bearing: Math.round(bearing),
        direction: directions[directionIndex],
        estimatedTime: Math.ceil(distance / 83.33),
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

      const R = 6371e3;
      const φ1 = playerLat * Math.PI / 180;
      const φ2 = locLat * Math.PI / 180;
      const Δφ = (locLat - playerLat) * Math.PI / 180;
      const Δλ = (locLng - playerLng) * Math.PI / 180;

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

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
