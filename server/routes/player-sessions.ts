import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest } from "./types";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../objectStorage";
import { ObjectPermission } from "../objectAcl";
import { insertGameSessionSchema } from "@shared/schema";
import { z } from "zod";

export function registerPlayerSessionRoutes(app: Express) {
  // ==========================================================================
  // Session & Progress API
  // ==========================================================================

  app.get(
    "/api/sessions/active",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const gameId = req.query.gameId as string;
        const userId = req.user?.claims?.sub;

        if (!gameId || !userId) {
          return res.status(400).json({ message: "gameId is required" });
        }

        const result = await storage.getActiveSessionByUserAndGame(
          userId,
          gameId,
        );

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
          },
        });
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch active session" });
      }
    },
  );

  app.get(
    "/api/sessions",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const userSessions = await storage.getSessionsByUser(userId);

        const sessionsWithProgress = userSessions.map(
          ({ session, progress }) => ({
            ...session,
            currentPageId: progress.currentPageId,
            playerScore: progress.score,
            inventory: progress.inventory,
            variables: progress.variables,
          }),
        );

        res.json(sessionsWithProgress);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch sessions" });
      }
    },
  );

  app.post(
    "/api/sessions",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const data = insertGameSessionSchema.parse(req.body);
        const session = await storage.createSession(data);

        const userId = req.user?.claims?.sub;
        if (userId) {
          const existingUser = await storage.getUser(userId);
          if (!existingUser) {
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
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create session" });
      }
    },
  );

  app.get(
    "/api/sessions/:id",
    isAuthenticated,
    async (req, res) => {
      try {
        const session = await storage.getSession(req.params.id);
        if (!session) {
          return res.status(404).json({ message: "Session not found" });
        }
        res.json(session);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch session" });
      }
    },
  );

  app.patch(
    "/api/sessions/:id",
    isAuthenticated,
    async (req, res) => {
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
            completionTimeSeconds:
              session.completedAt && session.startedAt
                ? Math.floor(
                    (new Date(session.completedAt).getTime() -
                      new Date(session.startedAt).getTime()) /
                      1000,
                  )
                : undefined,
          });
        }

        res.json(session);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to update session" });
      }
    },
  );

  app.patch(
    "/api/sessions/:id/progress",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
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

        const updateData: Record<string, unknown> = {};
        if (req.body.pageId) updateData.currentPageId = req.body.pageId;
        if (req.body.score !== undefined) updateData.score = req.body.score;
        if (req.body.inventory) updateData.inventory = req.body.inventory;
        if (req.body.variables) updateData.variables = req.body.variables;

        const updated = await storage.updatePlayerProgress(
          progress.id,
          updateData,
        );

        res.json(updated);
      } catch (error) {
        res.status(500).json({ message: "Failed to update progress" });
      }
    },
  );

  // ==========================================================================
  // Chat API
  // ==========================================================================

  app.get(
    "/api/chat/:sessionId",
    isAuthenticated,
    async (req, res) => {
      try {
        const messages = await storage.getChatMessages(req.params.sessionId);
        res.json(messages);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch chat messages" });
      }
    },
  );

  app.post(
    "/api/chat/:sessionId",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
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
    },
  );

  // ==========================================================================
  // Object Storage / Photos API
  // ==========================================================================

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

  app.get(
    "/objects/:objectPath(*)",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      const userId = req.user?.claims?.sub;
      const objectStorageService = new ObjectStorageService();
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(
          req.path,
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
    },
  );

  app.post(
    "/api/objects/upload",
    isAuthenticated,
    async (req, res) => {
      try {
        const objectStorageService = new ObjectStorageService();
        const uploadURL =
          await objectStorageService.getObjectEntityUploadURL();
        res.json({ uploadURL });
      } catch (error) {
        res.status(500).json({ error: "Failed to get upload URL" });
      }
    },
  );

  app.put(
    "/api/photos",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      if (!req.body.photoURL) {
        return res.status(400).json({ error: "photoURL is required" });
      }

      const userId = req.user?.claims?.sub;

      try {
        const objectStorageService = new ObjectStorageService();
        const objectPath =
          await objectStorageService.trySetObjectEntityAclPolicy(
            req.body.photoURL,
            {
              owner: userId || "anonymous",
              visibility: "private",
            },
          );

        res.status(200).json({
          objectPath: objectPath,
          message: "Photo saved successfully",
        });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  app.post(
    "/api/photos/upload",
    isAuthenticated,
    async (req, res) => {
      try {
        const objectStorageService = new ObjectStorageService();
        const uploadURL =
          await objectStorageService.getObjectEntityUploadURL();
        const objectPath =
          objectStorageService.normalizeObjectEntityPath(
            uploadURL.split("?")[0],
          );
        res.status(201).json({
          message: "Upload URL generated",
          uploadURL,
          objectPath,
          id: `photo-${Date.now()}`,
        });
      } catch (error) {
        res.status(500).json({ message: "Failed to generate upload URL" });
      }
    },
  );
}
