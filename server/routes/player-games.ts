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
        res.status(500).json({ message: "Failed to delete page" });
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

  // ==========================================================================
  // Items CRUD
  // ==========================================================================

  app.get("/api/games/:gameId/items", async (req, res) => {
    try {
      const items = await storage.getItems(req.params.gameId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  app.get("/api/items/:id", async (req, res) => {
    try {
      const item = await storage.getItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch item" });
    }
  });

  app.post(
    "/api/games/:gameId/items",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const auth = await checkGameOwnership(req, req.params.gameId);
        if (!auth.authorized) {
          return res
            .status(auth.status || 403)
            .json({ message: auth.message });
        }

        const data = insertItemSchema.parse({
          ...req.body,
          gameId: req.params.gameId,
        });
        const item = await storage.createItem(data);
        res.status(201).json(item);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create item" });
      }
    },
  );

  app.patch(
    "/api/items/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const item = await storage.getItem(req.params.id);
        if (!item) {
          return res.status(404).json({ message: "Item not found" });
        }

        const auth = await checkGameOwnership(req, item.gameId);
        if (!auth.authorized) {
          return res
            .status(auth.status || 403)
            .json({ message: auth.message });
        }

        const data = insertItemSchema.partial().parse(req.body);
        const updated = await storage.updateItem(req.params.id, data);
        if (!updated) {
          return res.status(404).json({ message: "Item not found" });
        }
        res.json(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to update item" });
      }
    },
  );

  app.delete(
    "/api/items/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const item = await storage.getItem(req.params.id);
        if (!item) {
          return res.status(404).json({ message: "Item not found" });
        }

        const auth = await checkGameOwnership(req, item.gameId);
        if (!auth.authorized) {
          return res
            .status(auth.status || 403)
            .json({ message: auth.message });
        }

        await storage.deleteItem(req.params.id);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete item" });
      }
    },
  );

  // ==========================================================================
  // Achievements CRUD
  // ==========================================================================

  app.get("/api/games/:gameId/achievements", async (req, res) => {
    try {
      const achievements = await storage.getAchievements(req.params.gameId);
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.get("/api/achievements/:id", async (req, res) => {
    try {
      const achievement = await storage.getAchievement(
        parseInt(req.params.id),
      );
      if (!achievement) {
        return res.status(404).json({ message: "Achievement not found" });
      }
      res.json(achievement);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch achievement" });
    }
  });

  app.post(
    "/api/games/:gameId/achievements",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const auth = await checkGameOwnership(req, req.params.gameId);
        if (!auth.authorized) {
          return res
            .status(auth.status || 403)
            .json({ message: auth.message });
        }

        const data = insertAchievementSchema.parse({
          ...req.body,
          gameId: req.params.gameId,
        });
        const achievement = await storage.createAchievement(data);
        res.status(201).json(achievement);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create achievement" });
      }
    },
  );

  app.patch(
    "/api/achievements/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const achievement = await storage.getAchievement(
          parseInt(req.params.id),
        );
        if (!achievement) {
          return res.status(404).json({ message: "Achievement not found" });
        }

        const auth = await checkGameOwnership(req, achievement.gameId);
        if (!auth.authorized) {
          return res
            .status(auth.status || 403)
            .json({ message: auth.message });
        }

        const data = insertAchievementSchema.partial().parse(req.body);
        const updated = await storage.updateAchievement(
          parseInt(req.params.id),
          data,
        );
        if (!updated) {
          return res.status(404).json({ message: "Achievement not found" });
        }
        res.json(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to update achievement" });
      }
    },
  );

  app.delete(
    "/api/achievements/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const achievement = await storage.getAchievement(
          parseInt(req.params.id),
        );
        if (!achievement) {
          return res.status(404).json({ message: "Achievement not found" });
        }

        const auth = await checkGameOwnership(req, achievement.gameId);
        if (!auth.authorized) {
          return res
            .status(auth.status || 403)
            .json({ message: auth.message });
        }

        await storage.deleteAchievement(parseInt(req.params.id));
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete achievement" });
      }
    },
  );
}
