import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import { requireAdminAuth } from "../adminAuth";
import { requireAdminRole, validateId } from "./utils";
import type { AuthenticatedRequest } from "./types";

export function registerLeaderboardRoutes(app: Express) {
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const rawGameId = req.query.gameId as string | undefined;
      const rawFieldCode = req.query.fieldCode as string | undefined;

      // 🔒 場域隔離：有 fieldCode 就先換成 fieldId 傳入 storage
      let fieldId: string | undefined;
      if (rawFieldCode && rawFieldCode.trim()) {
        const { db } = await import("../db");
        const { fields } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        const field = await db.query.fields.findFirst({
          where: eq(fields.code, rawFieldCode.trim().toUpperCase()),
        });
        if (!field) {
          return res.json([]);
        }
        fieldId = field.id;
      }

      if (rawGameId) {
        const gameId = validateId(rawGameId, res);
        if (!gameId) return;
        const entries = await storage.getLeaderboard(gameId, fieldId);
        return res.json(entries);
      }
      const entries = await storage.getLeaderboard(undefined, fieldId);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/analytics/overview", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      // 🔒 場域隔離：super_admin 可指定場域，其他人強制自己的場域
      const fieldId =
        req.admin.systemRole === "super_admin"
          ? (req.query.fieldId as string) || req.admin.fieldId
          : req.admin.fieldId;

      const games = await storage.getGamesByField(fieldId);
      const sessions = await storage.getSessionsByField(fieldId);

      const completedSessions = sessions.filter(s => s.status === "completed");
      const activeSessions = sessions.filter(s => s.status === "playing");

      const sessionsWithValidTime = sessions.filter(s => s.completedAt && s.startedAt);
      const totalPlayTime = sessionsWithValidTime.reduce((sum, s) => {
        const startMs = new Date(s.startedAt!).getTime();
        const endMs = new Date(s.completedAt!).getTime();
        return sum + Math.max(0, endMs - startMs);
      }, 0);

      const gameStats = games.map(game => {
        const gameSessions = sessions.filter(s => s.gameId === game.id);
        const completed = gameSessions.filter(s => s.status === "completed").length;
        const rate = gameSessions.length > 0 ? (completed / gameSessions.length) * 100 : 0;
        return {
          gameId: game.id,
          title: game.title,
          totalSessions: gameSessions.length,
          completedSessions: completed,
          completionRate: Math.round(rate * 10) / 10,
        };
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySessions = sessions.filter(s => {
        const sessionDate = s.startedAt ? new Date(s.startedAt) : null;
        return sessionDate && sessionDate >= today;
      });

      const overallRate = sessions.length > 0 ? (completedSessions.length / sessions.length) * 100 : 0;

      res.json({
        totalGames: games.length,
        publishedGames: games.filter(g => g.status === "published").length,
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        activeSessions: activeSessions.length,
        todaySessions: todaySessions.length,
        averagePlayTime: sessionsWithValidTime.length > 0 ? Math.round(totalPlayTime / sessionsWithValidTime.length / 60000) : 0,
        overallCompletionRate: Math.round(overallRate * 10) / 10,
        gameStats,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics overview" });
    }
  });

  app.get("/api/analytics/sessions", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      // 🔒 場域隔離
      const fieldId =
        req.admin.systemRole === "super_admin"
          ? (req.query.fieldId as string) || req.admin.fieldId
          : req.admin.fieldId;

      const sessions = await storage.getSessionsByField(fieldId);
      const games = await storage.getGamesByField(fieldId);

      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const daySessions = sessions.filter(s => {
          const sessionDate = s.startedAt ? new Date(s.startedAt) : null;
          return sessionDate && sessionDate >= date && sessionDate < nextDate;
        });

        last7Days.push({
          date: date.toISOString().split('T')[0],
          total: daySessions.length,
          completed: daySessions.filter(s => s.status === "completed").length,
        });
      }

      const recentSessions = sessions
        .sort((a, b) => {
          const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
          const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 20)
        .map(s => {
          const game = games.find(g => g.id === s.gameId);
          return {
            ...s,
            gameTitle: game?.title || "Unknown Game",
          };
        });

      res.json({
        dailyStats: last7Days,
        recentSessions,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session analytics" });
    }
  });
}
