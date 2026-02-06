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
  ObjectStorageService,
  ObjectNotFoundError,
} from "../objectStorage";
import { ObjectPermission } from "../objectAcl";
import {
  insertGameSchema,
  insertPageSchema,
  insertItemSchema,
  insertEventSchema,
  insertAchievementSchema,
  insertGameSessionSchema,
} from "@shared/schema";
import { db } from "../db";
import { games } from "@shared/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { checkGameOwnership } from "./utils";

export function registerPlayerGameRoutes(app: Express) {
  // ============================================================================
  // Game QR Code Routes - 遊戲 QR Code (Player API)
  // ============================================================================

  app.get("/api/games/:id/qrcode", isAuthenticated, async (req, res) => {
    try {
      const qrCodeDataUrl = await generateGameQRCode(req.params.id);
      res.json({ qrCodeUrl: qrCodeDataUrl, gameUrl: generateGameUrl(req.params.id) });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.post("/api/games/:id/generate-slug", isAuthenticated, async (req, res) => {
    try {
      const auth = await checkGameOwnership(req, req.params.id);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ message: auth.message });
      }

      const slug = generateSlug();
      await db.update(games).set({ publicSlug: slug }).where(eq(games.id, req.params.id));

      const qrCodeDataUrl = await generateGameQRCode(req.params.id);
      const gameUrl = generateGameUrl(slug);

      res.json({ slug, qrCodeUrl: qrCodeDataUrl, gameUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate slug" });
    }
  });

  // 透過 slug 存取遊戲（僅已發布的遊戲）
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

  app.get("/api/games", async (req, res) => {
    try {
      const games = await storage.getPublishedGames();
      res.json(games);
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

  app.post("/api/games", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const data = insertGameSchema.parse(req.body);
      const userId = req.user?.claims?.sub;
      const game = await storage.createGame({ ...data, creatorId: userId });
      res.status(201).json(game);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create game" });
    }
  });

  app.patch("/api/games/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await checkGameOwnership(req, req.params.id);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ message: auth.message });
      }

      const data = insertGameSchema.partial().parse(req.body);
      const game = await storage.updateGame(req.params.id, data);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json(game);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update game" });
    }
  });

  app.delete("/api/games/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await checkGameOwnership(req, req.params.id);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ message: auth.message });
      }

      await storage.deleteGame(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete game" });
    }
  });

  app.get("/api/games/:gameId/pages", async (req, res) => {
    try {
      const pages = await storage.getPages(req.params.gameId);
      res.json(pages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pages" });
    }
  });

  app.post("/api/games/:gameId/pages", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await checkGameOwnership(req, req.params.gameId);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ message: auth.message });
      }

      const data = insertPageSchema.parse({ ...req.body, gameId: req.params.gameId });
      const page = await storage.createPage(data);
      res.status(201).json(page);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create page" });
    }
  });

  app.patch("/api/pages/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const page = await storage.getPage(req.params.id);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      const auth = await checkGameOwnership(req, page.gameId);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ message: auth.message });
      }

      const data = insertPageSchema.partial().parse(req.body);
      const updatedPage = await storage.updatePage(req.params.id, data);
      res.json(updatedPage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update page" });
    }
  });

  app.delete("/api/pages/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const page = await storage.getPage(req.params.id);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      const auth = await checkGameOwnership(req, page.gameId);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ message: auth.message });
      }

      await storage.deletePage(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete page" });
    }
  });

  app.get("/api/games/:gameId/events", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = userId ? await storage.getUser(userId) : null;
      if (!user || (user.role !== "admin" && user.role !== "creator")) {
        return res.status(403).json({ message: "Unauthorized: Admin or creator role required" });
      }

      const game = await storage.getGame(req.params.gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      if (user.role !== "admin" && game.creatorId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You can only access events for games you created" });
      }

      const events = await storage.getEvents(req.params.gameId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.post("/api/games/:gameId/events", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = userId ? await storage.getUser(userId) : null;
      if (!user || (user.role !== "admin" && user.role !== "creator")) {
        return res.status(403).json({ message: "Unauthorized: Admin or creator role required" });
      }

      const game = await storage.getGame(req.params.gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      if (user.role !== "admin" && game.creatorId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You can only create events for games you created" });
      }

      const data = insertEventSchema.parse({ ...req.body, gameId: req.params.gameId });
      const event = await storage.createEvent(data);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.patch("/api/events/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = userId ? await storage.getUser(userId) : null;
      if (!user || (user.role !== "admin" && user.role !== "creator")) {
        return res.status(403).json({ message: "Unauthorized: Admin or creator role required" });
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
        return res.status(403).json({ message: "Unauthorized: You can only update events for games you created" });
      }

      const data = insertEventSchema.partial().parse(req.body);
      const updatedEvent = await storage.updateEvent(req.params.id, data);
      if (!updatedEvent) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(updatedEvent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = userId ? await storage.getUser(userId) : null;
      if (!user || (user.role !== "admin" && user.role !== "creator")) {
        return res.status(403).json({ message: "Unauthorized: Admin or creator role required" });
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
        return res.status(403).json({ message: "Unauthorized: You can only delete events for games you created" });
      }

      await storage.deleteEvent(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // ============================================================================
  // Items API endpoints
  // ============================================================================
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

  app.post("/api/games/:gameId/items", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await checkGameOwnership(req, req.params.gameId);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ message: auth.message });
      }

      const data = insertItemSchema.parse({ ...req.body, gameId: req.params.gameId });
      const item = await storage.createItem(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create item" });
    }
  });

  app.patch("/api/items/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const item = await storage.getItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      const auth = await checkGameOwnership(req, item.gameId);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ message: auth.message });
      }

      const data = insertItemSchema.partial().parse(req.body);
      const updated = await storage.updateItem(req.params.id, data);
      if (!updated) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update item" });
    }
  });

  app.delete("/api/items/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const item = await storage.getItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      const auth = await checkGameOwnership(req, item.gameId);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ message: auth.message });
      }

      await storage.deleteItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete item" });
    }
  });

  // ============================================================================
  // Achievements API endpoints
  // ============================================================================
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
      const achievement = await storage.getAchievement(parseInt(req.params.id));
      if (!achievement) {
        return res.status(404).json({ message: "Achievement not found" });
      }
      res.json(achievement);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch achievement" });
    }
  });

  app.post("/api/games/:gameId/achievements", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await checkGameOwnership(req, req.params.gameId);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ message: auth.message });
      }

      const data = insertAchievementSchema.parse({ ...req.body, gameId: req.params.gameId });
      const achievement = await storage.createAchievement(data);
      res.status(201).json(achievement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create achievement" });
    }
  });

  app.patch("/api/achievements/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const achievement = await storage.getAchievement(parseInt(req.params.id));
      if (!achievement) {
        return res.status(404).json({ message: "Achievement not found" });
      }

      const auth = await checkGameOwnership(req, achievement.gameId);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ message: auth.message });
      }

      const data = insertAchievementSchema.partial().parse(req.body);
      const updated = await storage.updateAchievement(parseInt(req.params.id), data);
      if (!updated) {
        return res.status(404).json({ message: "Achievement not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update achievement" });
    }
  });

  app.delete("/api/achievements/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const achievement = await storage.getAchievement(parseInt(req.params.id));
      if (!achievement) {
        return res.status(404).json({ message: "Achievement not found" });
      }

      const auth = await checkGameOwnership(req, achievement.gameId);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ message: auth.message });
      }

      await storage.deleteAchievement(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete achievement" });
    }
  });

  // ============================================================================
  // Session & Progress API
  // ============================================================================

  app.get("/api/sessions/active", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const gameId = req.query.gameId as string;
      const userId = req.user?.claims?.sub;

      if (!gameId || !userId) {
        return res.status(400).json({ message: "gameId is required" });
      }

      const result = await storage.getActiveSessionByUserAndGame(userId, gameId);

      if (!result) {
        return res.json(null);
      }

      res.json({
        session: result.session,
        progress: {
          currentPageId: result.progress.currentPageId,
          score: result.progress.score,
          inventory: result.progress.inventory,
          variables: result.progress.variables,
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active session" });
    }
  });

  app.get("/api/sessions", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userSessions = await storage.getSessionsByUser(userId);

      const sessionsWithProgress = userSessions.map(({ session, progress }) => ({
        ...session,
        currentPageId: progress.currentPageId,
        playerScore: progress.score,
        inventory: progress.inventory,
        variables: progress.variables,
      }));

      res.json(sessionsWithProgress);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.post("/api/sessions", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const data = insertGameSessionSchema.parse(req.body);
      const session = await storage.createSession(data);

      const userId = req.user?.claims?.sub;
      if (userId) {
        // 確保用戶存在於 users 表中（處理 email 相同但 Firebase UID 不同的情況）
        const existingUser = await storage.getUser(userId);
        if (!existingUser) {
          // 用戶不存在，建立一個基本的用戶記錄
          await storage.upsertUser({
            id: userId,
            email: `user-${userId}@firebase.local`,
            firstName: null,
            lastName: null,
            profileImageUrl: null,
          });
        }

        await storage.createPlayerProgress({
          sessionId: session.id,
          userId: userId,
          inventory: [],
          variables: {},
        });
      }

      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("建立 session 失敗:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.get("/api/sessions/:id", isAuthenticated, async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  app.patch("/api/sessions/:id", isAuthenticated, async (req, res) => {
    try {
      const data = insertGameSessionSchema.partial().parse(req.body);
      const session = await storage.updateSession(req.params.id, data);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (data.status === "completed" && session.score) {
        await storage.createLeaderboardEntry({
          gameId: session.gameId,
          sessionId: session.id,
          teamName: session.teamName,
          totalScore: session.score,
          completionTimeSeconds: session.completedAt && session.startedAt
            ? Math.floor((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
            : undefined,
        });
      }

      res.json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  app.patch("/api/sessions/:id/progress", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const progressList = await storage.getPlayerProgress(sessionId);
      let progress = progressList.find((p) => p.userId === userId);

      if (!progress) {
        progress = await storage.createPlayerProgress({
          sessionId: sessionId,
          userId: userId,
          inventory: req.body.inventory || [],
          variables: req.body.variables || {},
          score: req.body.score || 0,
          currentPageId: req.body.pageId || null,
        });
        res.json(progress);
        return;
      }

      const updateData: any = {};
      if (req.body.pageId) updateData.currentPageId = req.body.pageId;
      if (req.body.score !== undefined) updateData.score = req.body.score;
      if (req.body.inventory) updateData.inventory = req.body.inventory;
      if (req.body.variables) updateData.variables = req.body.variables;

      const updated = await storage.updatePlayerProgress(progress.id, updateData);

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update progress" });
    }
  });

  app.get("/api/chat/:sessionId", isAuthenticated, async (req, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.sessionId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chat/:sessionId", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const message = await storage.createChatMessage({
        sessionId: req.params.sessionId,
        userId: userId,
        message: req.body.message,
      });
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to create chat message" });
    }
  });

  // ============================================================================
  // Object Storage / Photos API
  // ============================================================================

  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path
      );
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.put("/api/photos", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    if (!req.body.photoURL) {
      return res.status(400).json({ error: "photoURL is required" });
    }

    const userId = req.user?.claims?.sub;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.photoURL,
        {
          owner: userId || "anonymous",
          visibility: "private",
        }
      );

      res.status(200).json({
        objectPath: objectPath,
        message: "Photo saved successfully",
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/photos/upload", isAuthenticated, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL.split("?")[0]);
      res.status(201).json({
        message: "Upload URL generated",
        uploadURL,
        objectPath,
        id: `photo-${Date.now()}`
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });
}
