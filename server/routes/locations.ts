// 地點 CRUD + 導航路徑路由
import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import {
  insertLocationSchema,
  insertNavigationPathSchema,
  locations,
} from "@shared/schema";
import { checkGameOwnership } from "./utils";
import { ensureUniqueSlug, normalizeSlugInput } from "../lib/slug";
import type { RouteContext } from "./types";
import { registerLocationTrackingRoutes } from "./location-tracking";
import {
  generateShortCode,
  generateQrToken,
} from "../lib/location-verification";
import QRCode from "qrcode";
import { computeImageHash, hammingDistance } from "../lib/image-hash";

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

      if (includeGpsMissions === 'true' || gameLocations.every(loc => loc.latitude == null || loc.longitude == null)) {
        try {
          const pages = await storage.getPages(gameId);
          const gpsMissionPages = pages.filter(p => p.pageType === 'gps_mission');

          gpsMissionPages.forEach((page, index) => {
            const config = page.config as Record<string, unknown> | null;
            if (config) {
              const targetLocation = config.targetLocation as Record<string, unknown> | undefined;
              // 用 ?? 避免合法 0 值被誤判為缺值（赤道 / 子午線座標）
              const lat = targetLocation?.lat ?? config.targetLatitude;
              const lng = targetLocation?.lng ?? config.targetLongitude;

              if (lat != null && lng != null) {
                const existingLocation = gameLocations.find(loc =>
                  loc.latitude === String(lat) && loc.longitude === String(lng)
                );

                if (!existingLocation) {
                  const onSuccess = config.onSuccess as Record<string, unknown> | undefined;
                  // 合成虛擬地點物件供前端地圖顯示（非 DB 實體）
                  gameLocations.push({
                    id: 10000 + index,
                    gameId,
                    name: String(config.title || config.locationName || `GPS任務 ${index + 1}`),
                    slug: null,
                    description: String(config.instruction || config.description || ''),
                    latitude: String(lat),
                    longitude: String(lng),
                    radius: Number(config.radius) || 50,
                    locationType: 'gps_mission',
                    status: 'active',
                    points: Number(onSuccess?.points) || 15,
                    orderIndex: page.pageOrder || index,
                    qrCodeData: null,
                    icon: null,
                    reward: null,
                    isRequired: true,
                    unlockCondition: null,
                    // 🆕 2026-05-22 多元定位驗證欄位（虛擬地點預設值）
                    verificationMode: 'gps',
                    verificationCode: null,
                    qrToken: null,
                    allowAdminRescue: true,
                    referenceImageHash: null,
                    referenceImageUrl: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  });
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

      // slug 自動處理
      const userSlug = normalizeSlugInput(locationData.slug as string | undefined);
      const baseSlug = userSlug || locationData.name;
      locationData.slug = await ensureUniqueSlug(
        locations,
        locations.slug,
        locations.gameId,
        gameId,
        baseSlug,
      );

      const newLocation = await storage.createLocation(locationData);
      res.status(201).json(newLocation);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'errors' in error) {
        return res.status(400).json({ message: "Validation error", errors: (error as { errors: unknown }).errors });
      }
      console.error("[locations] create failed:", error);
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

      // slug 處理（若有傳入）
      const body = { ...req.body };
      if (body.slug !== undefined) {
        const userSlug = normalizeSlugInput(body.slug);
        if (userSlug && userSlug === existingLocation.slug) {
          body.slug = userSlug;
        } else {
          const baseSlug = userSlug || body.name || existingLocation.name;
          body.slug = await ensureUniqueSlug(
            locations,
            locations.slug,
            locations.gameId,
            existingLocation.gameId,
            baseSlug,
            { column: locations.id, value: existingLocation.id },
          );
        }
      }

      const updated = await storage.updateLocation(id, body);
      res.json(updated);
    } catch (error) {
      console.error("[locations] update failed:", error);
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

  // ===========================================
  // 🆕 多元定位驗證 — Admin 輔助端點（2026-05-22）
  // ===========================================

  // 為單一 location 自動生成短碼
  app.post("/api/locations/:id/generate-code", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }
      const existing = await storage.getLocation(id);
      if (!existing) {
        return res.status(404).json({ message: "Location not found" });
      }
      const ownershipCheck = await checkGameOwnership(req, existing.gameId);
      if (!ownershipCheck.authorized) {
        return res.status(ownershipCheck.status || 403).json({ message: ownershipCheck.message });
      }
      const length = (req.body?.length === 5 || req.body?.length === 6) ? req.body.length : 4;
      const code = generateShortCode(length);
      const updated = await storage.updateLocation(id, { verificationCode: code });
      res.json({ verificationCode: code, location: updated });
    } catch (error) {
      console.error("[locations] generate-code failed:", error);
      res.status(500).json({ message: "Failed to generate code" });
    }
  });

  // 為單一 location 自動生成 QR token
  app.post("/api/locations/:id/generate-qr-token", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }
      const existing = await storage.getLocation(id);
      if (!existing) {
        return res.status(404).json({ message: "Location not found" });
      }
      const ownershipCheck = await checkGameOwnership(req, existing.gameId);
      if (!ownershipCheck.authorized) {
        return res.status(ownershipCheck.status || 403).json({ message: ownershipCheck.message });
      }
      const token = generateQrToken(id);
      const updated = await storage.updateLocation(id, { qrToken: token });
      res.json({ qrToken: token, location: updated });
    } catch (error) {
      console.error("[locations] generate-qr-token failed:", error);
      res.status(500).json({ message: "Failed to generate qr token" });
    }
  });

  // 取得 location 的 QR Code DataURL（供 admin 預覽或玩家端使用）
  app.get("/api/locations/:id/qr-image", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }
      const location = await storage.getLocation(id);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      if (!location.qrToken) {
        return res.status(400).json({ message: "Location 尚未啟用 QR（請先 generate-qr-token）" });
      }
      // QR 內容：JSON 字串，含 type + locationId + token，玩家端掃出後 POST 給 server
      const qrPayload = JSON.stringify({ t: "loc", id, tok: location.qrToken });
      const dataUrl = await QRCode.toDataURL(qrPayload, {
        type: "image/png",
        width: 400,
        margin: 2,
        color: { dark: "#1f2937", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      res.json({ dataUrl, payload: qrPayload, locationName: location.name, code: location.verificationCode });
    } catch (error) {
      console.error("[locations] qr-image failed:", error);
      res.status(500).json({ message: "Failed to generate qr image" });
    }
  });

  // 一次取得整個遊戲所有 location 的 QR + 代碼（給列印 PDF 用）
  app.get("/api/games/:gameId/locations/print-data", isAuthenticated, async (req, res) => {
    try {
      const { gameId } = req.params;
      const ownershipCheck = await checkGameOwnership(req, gameId);
      if (!ownershipCheck.authorized) {
        return res.status(ownershipCheck.status || 403).json({ message: ownershipCheck.message });
      }
      const locationsList = await storage.getLocationsByGame(gameId, {});
      const items = await Promise.all(
        locationsList.map(async (loc) => {
          let qrDataUrl: string | null = null;
          if (loc.qrToken) {
            const qrPayload = JSON.stringify({ t: "loc", id: loc.id, tok: loc.qrToken });
            qrDataUrl = await QRCode.toDataURL(qrPayload, {
              type: "image/png",
              width: 400,
              margin: 2,
              color: { dark: "#1f2937", light: "#ffffff" },
              errorCorrectionLevel: "H",
            });
          }
          return {
            id: loc.id,
            name: loc.name,
            description: loc.description,
            verificationMode: loc.verificationMode || "gps",
            verificationCode: loc.verificationCode,
            qrToken: loc.qrToken,
            qrDataUrl,
            radius: loc.radius,
            points: loc.points,
            orderIndex: loc.orderIndex,
          };
        }),
      );
      res.json({ gameId, items });
    } catch (error) {
      console.error("[locations] print-data failed:", error);
      res.status(500).json({ message: "Failed to fetch print data" });
    }
  });

  // Admin 設定 AR 參考照片（接 Cloudinary URL，後端算 dHash）
  app.post("/api/locations/:id/set-reference-image", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { imageUrl } = req.body || {};
      if (isNaN(id) || !imageUrl) {
        return res.status(400).json({ message: "Missing id or imageUrl" });
      }
      const existing = await storage.getLocation(id);
      if (!existing) {
        return res.status(404).json({ message: "Location not found" });
      }
      const ownershipCheck = await checkGameOwnership(req, existing.gameId);
      if (!ownershipCheck.authorized) {
        return res.status(ownershipCheck.status || 403).json({ message: ownershipCheck.message });
      }
      const hash = await computeImageHash(imageUrl);
      if (!hash) {
        return res.status(400).json({ message: "無法處理圖片（請確認 URL 可下載）" });
      }
      const updated = await storage.updateLocation(id, {
        referenceImageHash: hash,
        referenceImageUrl: imageUrl,
      });
      res.json({ hash, location: updated });
    } catch (error) {
      console.error("[locations] set-reference-image failed:", error);
      res.status(500).json({ message: "Failed to set reference image" });
    }
  });

  // 玩家拍照驗證（前端傳已上傳的照片 URL → 後端算 hash 比對 → 回 matchScore）
  app.post(
    "/api/sessions/:sessionId/locations/:locationId/verify-photo",
    isAuthenticated,
    async (req, res) => {
      try {
        const locId = parseInt(req.params.locationId);
        const { imageUrl } = req.body || {};
        if (isNaN(locId) || !imageUrl) {
          return res.status(400).json({ message: "Missing locationId or imageUrl" });
        }
        const location = await storage.getLocation(locId);
        if (!location || !location.referenceImageHash) {
          return res.status(400).json({ message: "此任務點未設定 AR 參考照片" });
        }
        const playerHash = await computeImageHash(imageUrl);
        if (!playerHash) {
          return res.status(400).json({ message: "無法處理玩家照片" });
        }
        const distance = hammingDistance(playerHash, location.referenceImageHash);
        // 0-64 → 轉成 0-1 的 score（距離越小分數越高）
        const matchScore = Math.max(0, 1 - distance / 32);
        res.json({
          matchScore: Number(matchScore.toFixed(3)),
          hammingDistance: distance,
          referenceImageId: String(locId),
          // matchScore 提供給玩家端，可在 visit 時帶入做最終驗證
          passed: matchScore >= 0.7,
        });
      } catch (error) {
        console.error("[locations] verify-photo failed:", error);
        res.status(500).json({ message: "Failed to verify photo" });
      }
    },
  );

  // 掛載玩家位置追蹤、造訪、導航計算子路由
  registerLocationTrackingRoutes(app, ctx);
}
