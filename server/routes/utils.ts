import { storage } from "../storage";
import type { AuthenticatedRequest } from "./types";
import type { User } from "@shared/schema";

export async function checkGameOwnership(req: AuthenticatedRequest, gameId: string): Promise<{ authorized: boolean; message?: string; user?: User; status?: number }> {
  const userId = req.user?.claims?.sub;
  if (!userId) {
    return { authorized: false, message: "Unauthorized", status: 401 };
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return { authorized: false, message: "User not found", status: 401 };
  }

  const game = await storage.getGame(gameId);
  if (!game) {
    return { authorized: false, message: "Game not found", status: 404 };
  }

  if (user.role === "admin") {
    return { authorized: true, user };
  }

  if (game.creatorId === userId) {
    return { authorized: true, user };
  }

  return { authorized: false, message: "Unauthorized: You can only modify your own games", status: 403 };
}

export async function requireAdminRole(req: AuthenticatedRequest): Promise<{ authorized: boolean; message?: string; user?: User }> {
  const userId = req.user?.claims?.sub;
  if (!userId) {
    return { authorized: false, message: "Unauthorized" };
  }

  const user = await storage.getUser(userId);
  if (!user || user.role !== "admin") {
    return { authorized: false, message: "Unauthorized: Admin role required" };
  }

  return { authorized: true, user };
}
