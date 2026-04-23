import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest } from "./types";
import {
  generateGameQRCode,
  generateGameUrl,
  generateSlug,
  getGameBySlug,
} from "../qrCodeService";
import {
  insertGameSchema,
  insertPageSchema,
  insertEventSchema,
} from "@shared/schema";
import { db } from "../db";
import { games } from "@shared/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { checkGameOwnership } from "./utils";
import { registerPlayerSessionRoutes } from "./player-sessions";
import { registerPlayerItemRoutes } from "./player-items";
import { registerPlayerAchievementRoutes } from "./player-achievements";

export function registerPlayerGameRoutes(app: Express) {
  // 註冊子模組路由
  registerPlayerSessionRoutes(app);
  registerPlayerItemRoutes(app);
  registerPlayerAchievementRoutes(app);

  // ==========================================================================
  // Game QR Code Routes
  // ==========================================================================

  app.get("/api/games/:id/qrcode", isAuthenticated, async (req, res) => {
    try {
      const qrCodeDataUrl = await generateGameQRCode(req.params.id);
      res.json({
        qrCodeUrl: qrCodeDataUrl,
        gameUrl: generateGameUrl(req.params.id),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.post(
    "/api/games/:id/generate-slug",
    isAuthenticated,
    async (req, res) => {
      try {
        const auth = await checkGameOwnership(req, req.params.id);
        if (!auth.authorized) {
          return res
            .status(auth.status || 403)
            .json({ message: auth.message });
        }

        const slug = generateSlug();
        await db
          .update(games)
          .set({ publicSlug: slug })
          .where(eq(games.id, req.params.id));

        const qrCodeDataUrl = await generateGameQRCode(req.params.id);
        const gameUrl = generateGameUrl(slug);

        res.json({ slug, qrCodeUrl: qrCodeDataUrl, gameUrl });
      } catch (error) {
        res.status(500).json({ message: "Failed to generate slug" });
      }
    },
  );

  app.get("/api/g/:slug", async (req, res) => {
    try {
      const game = await getGameBySlug(req.params.slug);
      if (!game) {
        return res.status(404).json({ message: "遊戲不存在" });
      }
      if (game.status !== "published") {
        return res.status(404).json({ message: "遊戲尚未開放" });
      }
      res.json(game);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch game" });
    }
  });

  // ==========================================================================
  // Games CRUD
  // ==========================================================================

  app.get("/api/games", async (req, res) => {
    try {
      const allGames = await storage.getPublishedGames();
      res.json(allGames);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  /**
   * 📊 遊戲統計 — 讓玩家端列表卡片顯示「XX 人玩過 · 累計 YY 場」
   * 公開端點（快取友善，不放敏感資料）
   */
  app.get("/api/games/:gameId/stats/public", async (req, res) => {
    try {
      const { gameId } = req.params;
      const { db } = await import("../db");
      const { gameSessions, playerProgress } = await import("@shared/schema");
      const { eq, sql } = await import("drizzle-orm");

      const [result] = await db
        .select({
          totalPlays: sql<number>`count(distinct ${gameSessions.id})::int`,
          uniquePlayers: sql<number>`count(distinct ${playerProgress.userId})::int`,
          completedPlays: sql<number>`count(distinct ${gameSessions.id}) filter (where ${gameSessions.status} = 'completed')::int`,
        })
        .from(gameSessions)
        .leftJoin(playerProgress, eq(playerProgress.sessionId, gameSessions.id))
        .where(eq(gameSessions.gameId, gameId));

      res.set("Cache-Control", "public, max-age=60");
      res.json({
        totalPlays: result?.totalPlays ?? 0,
        uniquePlayers: result?.uniquePlayers ?? 0,
        completedPlays: result?.completedPlays ?? 0,
      });
    } catch (error) {
      console.error("[player-games] stats failed:", error);
      res.status(500).json({ message: "Failed to fetch game stats" });
    }
  });

  /**
   * 📊 批次遊戲統計 — 一次回傳所有已發佈遊戲的累計資料
   *
   * 路徑放在 /api 層而非 /api/games/* 之下，避免與 /api/games/:id 衝突
   * 回傳格式：{ [gameId]: { totalPlays, uniquePlayers, completedPlays } }
   *
   * 公開端點，快取 60 秒，適合 home 列表一次拿
   */
  app.get("/api/games-stats/public", async (_req, res) => {
    try {
      const { db } = await import("../db");
      const { gameSessions, playerProgress, games } = await import(
        "@shared/schema"
      );
      const { eq, sql } = await import("drizzle-orm");

      const rows = await db
        .select({
          gameId: games.id,
          totalPlays: sql<number>`count(distinct ${gameSessions.id})::int`,
          uniquePlayers: sql<number>`count(distinct ${playerProgress.userId})::int`,
          completedPlays: sql<number>`count(distinct ${gameSessions.id}) filter (where ${gameSessions.status} = 'completed')::int`,
        })
        .from(games)
        .leftJoin(gameSessions, eq(gameSessions.gameId, games.id))
        .leftJoin(playerProgress, eq(playerProgress.sessionId, gameSessions.id))
        .groupBy(games.id);

      const map: Record<
        string,
        { totalPlays: number; uniquePlayers: number; completedPlays: number }
      > = {};
      for (const r of rows) {
        map[r.gameId] = {
          totalPlays: r.totalPlays ?? 0,
          uniquePlayers: r.uniquePlayers ?? 0,
          completedPlays: r.completedPlays ?? 0,
        };
      }

      res.set("Cache-Control", "public, max-age=60");
      res.json(map);
    } catch (error) {
      console.error("[player-games] batch stats failed:", error);
      res.status(500).json({ message: "Failed to fetch batch game stats" });
    }
  });

  app.get("/api/games/:id", async (req, res) => {
    try {
      const game = await storage.getGameWithPages(req.params.id);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json(game);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch game" });
    }
  });

  app.post(
    "/api/games",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const data = insertGameSchema.parse(req.body);
        const userId = req.user?.claims?.sub;
        const game = await storage.createGame({ ...data, creatorId: userId });
        res.status(201).json(game);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create game" });
      }
    },
  );

  app.patch(
    "/api/games/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const auth = await checkGameOwnership(req, req.params.id);
        if (!auth.authorized) {
          return res
            .status(auth.status || 403)
            .json({ message: auth.message });
        }

        const data = insertGameSchema.partial().parse(req.body);
        const game = await storage.updateGame(req.params.id, data);
        if (!game) {
          return res.status(404).json({ message: "Game not found" });
        }
        res.json(game);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to update game" });
      }
    },
  );

  app.delete(
    "/api/games/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const auth = await checkGameOwnership(req, req.params.id);
        if (!auth.authorized) {
          return res
            .status(auth.status || 403)
            .json({ message: auth.message });
        }

        await storage.deleteGame(req.params.id);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete game" });
      }
    },
  );

  // ==========================================================================
  // Pages CRUD
  // ==========================================================================

  app.get("/api/games/:gameId/pages", async (req, res) => {
    try {
      const pages = await storage.getPages(req.params.gameId);
      res.json(pages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pages" });
    }
  });

  app.post(
    "/api/games/:gameId/pages",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const auth = await checkGameOwnership(req, req.params.gameId);
        if (!auth.authorized) {
          return res
            .status(auth.status || 403)
            .json({ message: auth.message });
        }

        const data = insertPageSchema.parse({
          ...req.body,
          gameId: req.params.gameId,
        });
        const page = await storage.createPage(data);
        res.status(201).json(page);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create page" });
      }
    },
  );

  app.patch(
    "/api/pages/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const page = await storage.getPage(req.params.id);
        if (!page) {
          return res.status(404).json({ message: "Page not found" });
        }

        const auth = await checkGameOwnership(req, page.gameId);
        if (!auth.authorized) {
          return res
            .status(auth.status || 403)
            .json({ message: auth.message });
        }

        const data = insertPageSchema.partial().parse(req.body);
        const updatedPage = await storage.updatePage(req.params.id, data);
        res.json(updatedPage);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to update page" });
      }
    },
  );

  app.delete(
    "/api/pages/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const page = await storage.getPage(req.params.id);
        if (!page) {
          return res.status(404).json({ message: "Page not found" });
        }

        const auth = await checkGameOwnership(req, page.gameId);
        if (!auth.authorized) {
          return res
            .status(auth.status || 403)
            .json({ message: auth.message });
        }

        await storage.deletePage(req.params.id);
        res.status(204).send();
      } catch (error) {
        console.error("[player-games] deletePage failed:", error);
        const msg = error instanceof Error ? error.message : "Failed to delete page";
        res.status(500).json({ message: `刪除頁面失敗: ${msg}` });
      }
    },
  );

  // ==========================================================================
  // Events CRUD
  // ==========================================================================

  app.get(
    "/api/games/:gameId/events",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const user = userId ? await storage.getUser(userId) : null;
        if (!user || (user.role !== "admin" && user.role !== "creator")) {
          return res.status(403).json({
            message: "Unauthorized: Admin or creator role required",
          });
        }

        const game = await storage.getGame(req.params.gameId);
        if (!game) {
          return res.status(404).json({ message: "Game not found" });
        }

        if (user.role !== "admin" && game.creatorId !== userId) {
          return res.status(403).json({
            message:
              "Unauthorized: You can only access events for games you created",
          });
        }

        const events = await storage.getEvents(req.params.gameId);
        res.json(events);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch events" });
      }
    },
  );

  app.post(
    "/api/games/:gameId/events",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const user = userId ? await storage.getUser(userId) : null;
        if (!user || (user.role !== "admin" && user.role !== "creator")) {
          return res.status(403).json({
            message: "Unauthorized: Admin or creator role required",
          });
        }

        const game = await storage.getGame(req.params.gameId);
        if (!game) {
          return res.status(404).json({ message: "Game not found" });
        }

        if (user.role !== "admin" && game.creatorId !== userId) {
          return res.status(403).json({
            message:
              "Unauthorized: You can only create events for games you created",
          });
        }

        const data = insertEventSchema.parse({
          ...req.body,
          gameId: req.params.gameId,
        });
        const event = await storage.createEvent(data);
        res.status(201).json(event);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create event" });
      }
    },
  );

  app.patch(
    "/api/events/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const user = userId ? await storage.getUser(userId) : null;
        if (!user || (user.role !== "admin" && user.role !== "creator")) {
          return res.status(403).json({
            message: "Unauthorized: Admin or creator role required",
          });
        }

        const event = await storage.getEvent(req.params.id);
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        const game = await storage.getGame(event.gameId);
        if (!game) {
          return res.status(404).json({ message: "Game not found" });
        }

        if (user.role !== "admin" && game.creatorId !== userId) {
          return res.status(403).json({
            message:
              "Unauthorized: You can only update events for games you created",
          });
        }

        const data = insertEventSchema.partial().parse(req.body);
        const updatedEvent = await storage.updateEvent(req.params.id, data);
        if (!updatedEvent) {
          return res.status(404).json({ message: "Event not found" });
        }
        res.json(updatedEvent);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to update event" });
      }
    },
  );

  app.delete(
    "/api/events/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        const user = userId ? await storage.getUser(userId) : null;
        if (!user || (user.role !== "admin" && user.role !== "creator")) {
          return res.status(403).json({
            message: "Unauthorized: Admin or creator role required",
          });
        }

        const event = await storage.getEvent(req.params.id);
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        const game = await storage.getGame(event.gameId);
        if (!game) {
          return res.status(404).json({ message: "Game not found" });
        }

        if (user.role !== "admin" && game.creatorId !== userId) {
          return res.status(403).json({
            message:
              "Unauthorized: You can only delete events for games you created",
          });
        }

        await storage.deleteEvent(req.params.id);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete event" });
      }
    },
  );
}
