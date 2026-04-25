// Squad 6 個排行榜 — Phase 12.2
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §8
//
// 端點：
//   GET /api/squads/leaderboard/total          — 場次榜（主榜）
//   GET /api/squads/leaderboard/hall-of-fame   — 名人堂（100+ 場）
//   GET /api/squads/leaderboard/newbies        — 新人榜（1-9 場）
//   GET /api/squads/leaderboard/rising         — 上升星（30 天成長）
//   GET /api/squads/leaderboard/regulars       — 常客榜（體驗點數）
//   GET /api/squads/leaderboard/by-game/:gameType — 各遊戲段位
//
import type { Express } from "express";
import { db } from "../db";
import { squadStats, squadRatings, battleClans } from "@shared/schema";
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm";

// 排行榜共用：上限 100 筆，給前端 paging
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parseLimit(val: unknown): number {
  const n = parseInt(String(val ?? DEFAULT_LIMIT), 10);
  if (Number.isNaN(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

// 把 squadStats + 隊伍名稱 join 起來
async function enrichWithSquadName<T extends { squadId: string }>(
  rows: T[],
): Promise<(T & { squadName: string; squadTag: string | null })[]> {
  if (rows.length === 0) return [] as any;
  const ids = rows.map((r) => r.squadId);
  const clans = await db
    .select({
      id: battleClans.id,
      name: battleClans.name,
      tag: battleClans.tag,
    })
    .from(battleClans)
    .where(inArray(battleClans.id, ids));
  const map = new Map(clans.map((c) => [c.id, c]));
  return rows.map((r) => {
    const c = map.get(r.squadId);
    return {
      ...r,
      squadName: c?.name ?? "（未知隊伍）",
      squadTag: c?.tag ?? null,
    };
  });
}

export function registerSquadLeaderboardsRoutes(app: Express) {
  // ============================================================================
  // GET /api/squads/leaderboard/total — 場次榜（全部隊伍降序）
  // ============================================================================
  app.get("/api/squads/leaderboard/total", async (req, res) => {
    try {
      const limit = parseLimit(req.query.limit);
      const rows = await db
        .select()
        .from(squadStats)
        .orderBy(desc(squadStats.totalGames), desc(squadStats.lastActiveAt))
        .limit(limit);

      const enriched = await enrichWithSquadName(rows);
      res.json({
        type: "total",
        items: enriched.map((r, i) => ({ rank: i + 1, ...r })),
      });
    } catch (error) {
      console.error("[squad-leaderboards] total 失敗:", error);
      res.status(500).json({ error: "取得場次榜失敗" });
    }
  });

  // ============================================================================
  // GET /api/squads/leaderboard/hall-of-fame — 名人堂（總場次 100+）
  // ============================================================================
  app.get("/api/squads/leaderboard/hall-of-fame", async (req, res) => {
    try {
      const limit = parseLimit(req.query.limit);
      const rows = await db
        .select()
        .from(squadStats)
        .where(gte(squadStats.totalGames, 100))
        .orderBy(desc(squadStats.totalGames))
        .limit(limit);

      const enriched = await enrichWithSquadName(rows);
      res.json({
        type: "hall_of_fame",
        items: enriched.map((r, i) => ({ rank: i + 1, ...r })),
      });
    } catch (error) {
      console.error("[squad-leaderboards] hall-of-fame 失敗:", error);
      res.status(500).json({ error: "取得名人堂失敗" });
    }
  });

  // ============================================================================
  // GET /api/squads/leaderboard/newbies — 新人榜（1-9 場）
  // ============================================================================
  app.get("/api/squads/leaderboard/newbies", async (req, res) => {
    try {
      const limit = parseLimit(req.query.limit);
      const rows = await db
        .select()
        .from(squadStats)
        .where(
          and(gte(squadStats.totalGames, 1), lte(squadStats.totalGames, 9)),
        )
        .orderBy(desc(squadStats.totalGames), desc(squadStats.lastActiveAt))
        .limit(limit);

      const enriched = await enrichWithSquadName(rows);
      res.json({
        type: "newbies",
        items: enriched.map((r, i) => ({ rank: i + 1, ...r })),
      });
    } catch (error) {
      console.error("[squad-leaderboards] newbies 失敗:", error);
      res.status(500).json({ error: "取得新人榜失敗" });
    }
  });

  // ============================================================================
  // GET /api/squads/leaderboard/rising — 上升星（30 天成長）
  // ============================================================================
  app.get("/api/squads/leaderboard/rising", async (req, res) => {
    try {
      const limit = parseLimit(req.query.limit);
      // monthlyGames + monthlyRecruits 加權排序
      const rows = await db
        .select()
        .from(squadStats)
        .where(gte(squadStats.monthlyGames, 1))
        .orderBy(
          desc(
            sql`${squadStats.monthlyGames} + ${squadStats.monthlyRecruits} * 2`,
          ),
        )
        .limit(limit);

      const enriched = await enrichWithSquadName(rows);
      res.json({
        type: "rising",
        items: enriched.map((r, i) => ({
          rank: i + 1,
          ...r,
          growthScore:
            (r.monthlyGames ?? 0) + (r.monthlyRecruits ?? 0) * 2,
        })),
      });
    } catch (error) {
      console.error("[squad-leaderboards] rising 失敗:", error);
      res.status(500).json({ error: "取得上升星榜失敗" });
    }
  });

  // ============================================================================
  // GET /api/squads/leaderboard/regulars — 常客榜（體驗點數）
  // ============================================================================
  // 設計文件 §8.6 — 給休閒玩家舞台（不靠輸贏，靠累積體驗）
  app.get("/api/squads/leaderboard/regulars", async (req, res) => {
    try {
      const limit = parseLimit(req.query.limit);
      const rows = await db
        .select()
        .from(squadStats)
        .where(gte(squadStats.totalExpPoints, 1))
        .orderBy(desc(squadStats.totalExpPoints))
        .limit(limit);

      const enriched = await enrichWithSquadName(rows);
      res.json({
        type: "regulars",
        items: enriched.map((r, i) => ({ rank: i + 1, ...r })),
      });
    } catch (error) {
      console.error("[squad-leaderboards] regulars 失敗:", error);
      res.status(500).json({ error: "取得常客榜失敗" });
    }
  });

  // ============================================================================
  // GET /api/squads/leaderboard/by-game/:gameType — 各遊戲段位
  // ============================================================================
  app.get("/api/squads/leaderboard/by-game/:gameType", async (req, res) => {
    try {
      const gameType = req.params.gameType;
      const limit = parseLimit(req.query.limit);
      const rows = await db
        .select()
        .from(squadRatings)
        .where(
          and(
            eq(squadRatings.gameType, gameType),
            gte(squadRatings.gamesPlayed, 1),
          ),
        )
        .orderBy(desc(squadRatings.rating))
        .limit(limit);

      const enriched = await enrichWithSquadName(rows);
      res.json({
        type: "by_game",
        gameType,
        items: enriched.map((r, i) => ({ rank: i + 1, ...r })),
      });
    } catch (error) {
      console.error("[squad-leaderboards] by-game 失敗:", error);
      res.status(500).json({ error: "取得遊戲段位榜失敗" });
    }
  });

  // ============================================================================
  // GET /api/squads/leaderboard/all — 一次取所有 6 榜（首頁 dashboard 用）
  // ============================================================================
  app.get("/api/squads/leaderboard/all", async (req, res) => {
    try {
      const limit = parseLimit(req.query.limit ?? 5); // 首頁用 top 5

      const [total, hof, newbies, rising, regulars] = await Promise.all([
        db
          .select()
          .from(squadStats)
          .orderBy(desc(squadStats.totalGames))
          .limit(limit),
        db
          .select()
          .from(squadStats)
          .where(gte(squadStats.totalGames, 100))
          .orderBy(desc(squadStats.totalGames))
          .limit(limit),
        db
          .select()
          .from(squadStats)
          .where(
            and(gte(squadStats.totalGames, 1), lte(squadStats.totalGames, 9)),
          )
          .orderBy(desc(squadStats.totalGames))
          .limit(limit),
        db
          .select()
          .from(squadStats)
          .where(gte(squadStats.monthlyGames, 1))
          .orderBy(desc(squadStats.monthlyGames))
          .limit(limit),
        db
          .select()
          .from(squadStats)
          .where(gte(squadStats.totalExpPoints, 1))
          .orderBy(desc(squadStats.totalExpPoints))
          .limit(limit),
      ]);

      const [totalE, hofE, newbiesE, risingE, regularsE] = await Promise.all([
        enrichWithSquadName(total),
        enrichWithSquadName(hof),
        enrichWithSquadName(newbies),
        enrichWithSquadName(rising),
        enrichWithSquadName(regulars),
      ]);

      res.json({
        total: totalE.map((r, i) => ({ rank: i + 1, ...r })),
        hall_of_fame: hofE.map((r, i) => ({ rank: i + 1, ...r })),
        newbies: newbiesE.map((r, i) => ({ rank: i + 1, ...r })),
        rising: risingE.map((r, i) => ({ rank: i + 1, ...r })),
        regulars: regularsE.map((r, i) => ({ rank: i + 1, ...r })),
      });
    } catch (error) {
      console.error("[squad-leaderboards] all 失敗:", error);
      res.status(500).json({ error: "取得綜合排行榜失敗" });
    }
  });
}
