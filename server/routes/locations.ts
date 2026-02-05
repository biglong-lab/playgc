import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import {
  insertLocationSchema,
  insertPlayerLocationSchema,
  insertLocationVisitSchema,
  insertNavigationPathSchema,
} from "@shared/schema";
import { checkGameOwnership } from "./utils";
import type { RouteContext } from "./types";

export function registerLocationRoutes(app: Express, ctx: RouteContext) {
  // ===========================================
  // GPS Navigation & Location Routes
  // ===========================================

  app.get("/api/games/:gameId/locations", isAuthenticated, async (req, res) => {
    try {
      const { gameId } = req.params;
      const { type, status, includeGpsMissions } = req.query;

      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      const filters: { type?: string; status?: string } = {};
      if (type && typeof type === 'string') filters.type = type;
      if (status && typeof status === 'string') filters.status = status;

      const gameLocations = await storage.getLocations(gameId, filters);

      if (includeGpsMissions === 'true' || gameLocations.every(loc => !loc.latitude || !loc.longitude)) {
        try {
          const pages = await storage.getPages(gameId);
          const gpsMissionPages = pages.filter(p => p.pageType === 'gps_mission');

          gpsMissionPages.forEach((page, index) => {
            const config = page.config as any;
            if (config) {
              const lat = config.targetLocation?.lat || config.targetLatitude;
              const lng = config.targetLocation?.lng || config.targetLongitude;

              if (lat && lng) {
                const existingLocation = gameLocations.find(loc =>
                  loc.latitude === String(lat) && loc.longitude === String(lng)
                );

                if (!existingLocation) {
                  gameLocations.push({
                    id: 10000 + index,
                    gameId,
                    name: config.title || config.locationName || `GPS任務 ${index + 1}`,
                    description: config.instruction || config.description || '',
                    latitude: String(lat),
                    longitude: String(lng),
                    radius: config.radius || 50,
                    type: 'gps_mission',
                    status: 'active',
                    points: config.onSuccess?.points || 15,
                    order: page.pageOrder || index,
                    qrCode: null,
                    imageUrl: config.imageUrl || null,
                    unlockCondition: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  } as any);
                }
              }
            }
          });
        } catch (pagesError) {
          // 靜默處理頁面資料擷取失敗
        }
      }

      res.json(gameLocations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.get("/api/locations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }

      const location = await storage.getLocation(id);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch location" });
    }
  });

  app.post("/api/games/:gameId/locations", isAuthenticated, async (req, res) => {
    try {
      const { gameId } = req.params;
      const ownershipCheck = await checkGameOwnership(req, gameId);
      if (!ownershipCheck.authorized) {
        return res.status(ownershipCheck.status || 403).json({ message: ownershipCheck.message });
      }

      const locationData = insertLocationSchema.parse({
        ...req.body,
        gameId,
      });

      const newLocation = await storage.createLocation(locationData);
      res.status(201).json(newLocation);
    } catch (error: any) {
      if (error.errors) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  app.patch("/api/locations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }

      const existingLocation = await storage.getLocation(id);
      if (!existingLocation) {
        return res.status(404).json({ message: "Location not found" });
      }

      const ownershipCheck = await checkGameOwnership(req, existingLocation.gameId);
      if (!ownershipCheck.authorized) {
        return res.status(ownershipCheck.status || 403).json({ message: ownershipCheck.message });
      }

      const updated = await storage.updateLocation(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  app.delete("/api/locations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }

      const existingLocation = await storage.getLocation(id);
      if (!existingLocation) {
        return res.status(404).json({ message: "Location not found" });
      }

      const ownershipCheck = await checkGameOwnership(req, existingLocation.gameId);
      if (!ownershipCheck.authorized) {
        return res.status(ownershipCheck.status || 403).json({ message: ownershipCheck.message });
      }

      await storage.deleteLocation(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete location" });
    }
  });

  // ===========================================
  // Player Location Tracking Routes
  // ===========================================

  app.post("/api/sessions/:sessionId/player-location", isAuthenticated, async (req: any, res) => {
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
    } catch (error: any) {
      if (error.errors) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update player location" });
    }
  });

  app.get("/api/sessions/:sessionId/team-locations", isAuthenticated, async (req: any, res) => {
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
    } catch (error) {
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
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch location history" });
    }
  });

  // ===========================================
  // Location Visit Routes
  // ===========================================

  app.post("/api/sessions/:sessionId/locations/:locationId/visit", isAuthenticated, async (req: any, res) => {
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
    } catch (error: any) {
      if (error.errors) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to record location visit" });
    }
  });

  app.get("/api/sessions/:sessionId/visits", isAuthenticated, async (req: any, res) => {
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
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch location visits" });
    }
  });

  // ===========================================
  // Navigation Path Routes
  // ===========================================

  app.get("/api/games/:gameId/navigation-paths", isAuthenticated, async (req, res) => {
    try {
      const { gameId } = req.params;

      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      const paths = await storage.getNavigationPaths(gameId);
      res.json(paths);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch navigation paths" });
    }
  });

  app.post("/api/games/:gameId/navigation-paths", isAuthenticated, async (req, res) => {
    try {
      const { gameId } = req.params;
      const ownershipCheck = await checkGameOwnership(req, gameId);
      if (!ownershipCheck.authorized) {
        return res.status(ownershipCheck.status || 403).json({ message: ownershipCheck.message });
      }

      const pathData = insertNavigationPathSchema.parse({
        ...req.body,
        gameId,
      });

      const newPath = await storage.createNavigationPath(pathData);
      res.status(201).json(newPath);
    } catch (error: any) {
      if (error.errors) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create navigation path" });
    }
  });

  app.delete("/api/navigation-paths/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid path ID" });
      }

      const paths = await storage.getNavigationPaths("");
      const path = paths.find(p => p.id === id);

      if (!path) {
        return res.status(404).json({ message: "Navigation path not found" });
      }

      const ownershipCheck = await checkGameOwnership(req, path.gameId);
      if (!ownershipCheck.authorized) {
        return res.status(ownershipCheck.status || 403).json({ message: ownershipCheck.message });
      }

      await storage.deleteNavigationPath(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete navigation path" });
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
    } catch (error) {
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
    } catch (error) {
      res.status(500).json({ message: "Failed to check proximity" });
    }
  });
}
