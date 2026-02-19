// 道具 CRUD 路由（從 player-games.ts 拆分）
import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest } from "./types";
import { insertItemSchema } from "@shared/schema";
import { z } from "zod";
import { checkGameOwnership } from "./utils";

export function registerPlayerItemRoutes(app: Express) {
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
}
