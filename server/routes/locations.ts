// 地點 CRUD + 導航路徑路由
import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import {
  insertLocationSchema,
  insertNavigationPathSchema,
} from "@shared/schema";
import { checkGameOwnership } from "./utils";
import type { RouteContext } from "./types";
import { registerLocationTrackingRoutes } from "./location-tracking";

export function registerLocationRoutes(app: Express, ctx: RouteContext) {
  // ===========================================
  // GPS Navigation & Location CRUD Routes
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB JSON 動態結構
            const config = page.config as any;
            if (config) {
              const lat = config.targetLocation?.lat || config.targetLatitude;
              const lng = config.targetLocation?.lng || config.targetLongitude;

              if (lat && lng) {
                const existingLocation = gameLocations.find(loc =>
                  loc.latitude === String(lat) && loc.longitude === String(lng)
                );

                if (!existingLocation) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 合成虛擬地點物件
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
        } catch (_pagesError) {
          // 靜默處理頁面資料擷取失敗
        }
      }

      res.json(gameLocations);
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'errors' in error) {
        return res.status(400).json({ message: "Validation error", errors: (error as { errors: unknown }).errors });
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
    } catch (_error) {
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
    } catch (_error) {
      res.status(500).json({ message: "Failed to delete location" });
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
    } catch (_error) {
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
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'errors' in error) {
        return res.status(400).json({ message: "Validation error", errors: (error as { errors: unknown }).errors });
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
    } catch (_error) {
      res.status(500).json({ message: "Failed to delete navigation path" });
    }
  });

  // 掛載玩家位置追蹤、造訪、導航計算子路由
  registerLocationTrackingRoutes(app, ctx);
}
