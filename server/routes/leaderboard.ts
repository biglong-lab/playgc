import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import { requireAdminRole, validateId } from "./utils";
import type { AuthenticatedRequest } from "./types";

export function registerLeaderboardRoutes(app: Express) {
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const rawGameId = req.query.gameId as string | undefined;
      // 若提供了 gameId 就驗證格式，未提供則回傳全部
      if (rawGameId) {
        const gameId = validateId(rawGameId, res);
        if (!gameId) return;
        const entries = await storage.getLeaderboard(gameId);
        return res.json(entries);
      }
      const entries = await storage.getLeaderboard(undefined);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/analytics/overview", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      const games = await storage.getGames();
      const sessions = await storage.getSessions();

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

  app.get("/api/analytics/sessions", isAuthenticated, async (req, res) => {
    try {
      const sessions = await storage.getSessions();
      const games = await storage.getGames();

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
