// 成就 CRUD 路由（從 player-games.ts 拆分）
import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest } from "./types";
import { insertAchievementSchema } from "@shared/schema";
import { z } from "zod";
import { checkGameOwnership } from "./utils";

export function registerPlayerAchievementRoutes(app: Express) {
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
