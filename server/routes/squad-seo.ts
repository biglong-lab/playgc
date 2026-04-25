// Squad SEO 端點 — Phase 15.7
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §15
//
// 端點：
//   GET /api/squads/:id/og              — 回傳 og:image SVG（社交平台預覽）
//   GET /api/squads/:id/schema.json     — 回傳 Schema.org SportsTeam JSON-LD
//
// 用途：FB / Line / Twitter 分享時自動產生隊伍卡片
//
import type { Express, Request, Response } from "express";
import { db } from "../db";
import { battleClans, squadStats, squads } from "@shared/schema";
import { eq } from "drizzle-orm";
import { buildOgImageSvg, buildSchemaJsonLd } from "../services/seo-helpers";

/**
 * 取隊伍資料（同時嘗試 squads 主表和 battle_clans）
 */
async function fetchSquadData(squadId: string) {
  // 先試 squads 主表
  const [squad] = await db.select().from(squads).where(eq(squads.id, squadId));
  if (squad) {
    const [stats] = await db
      .select()
      .from(squadStats)
      .where(eq(squadStats.squadId, squadId));
    return {
      id: squad.id,
      name: squad.name,
      tag: squad.tag,
      emblemUrl: squad.emblemUrl,
      description: squad.description,
      stats,
    };
  }

  // 後試 battle_clans
  const [clan] = await db
    .select()
    .from(battleClans)
    .where(eq(battleClans.id, squadId));
  if (!clan) return null;

  const [stats] = await db
    .select()
    .from(squadStats)
    .where(eq(squadStats.squadId, squadId));

  return {
    id: clan.id,
    name: clan.name,
    tag: clan.tag,
    emblemUrl: clan.logoUrl,
    description: clan.description,
    stats,
  };
}

export function registerSquadSeoRoutes(app: Express) {
  // ============================================================================
  // GET /api/squads/:id/og — og:image SVG
  // ============================================================================
  app.get("/api/squads/:id/og", async (req: Request, res: Response) => {
    try {
      const data = await fetchSquadData(req.params.id);
      if (!data) {
        return res.status(404).send("Squad 不存在");
      }

      const svg = buildOgImageSvg({
        name: data.name,
        tag: data.tag,
        totalGames: data.stats?.totalGames ?? 0,
        recruitsCount: data.stats?.recruitsCount ?? 0,
        superLeaderTier: data.stats?.superLeaderTier,
      });

      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=600"); // 10 分鐘快取
      res.send(svg);
    } catch (err) {
      console.error("[squad-seo] og 失敗:", err);
      res.status(500).send("產生 og 失敗");
    }
  });

  // ============================================================================
  // GET /api/squads/:id/schema.json — Schema.org JSON-LD
  // ============================================================================
  app.get("/api/squads/:id/schema.json", async (req: Request, res: Response) => {
    try {
      const data = await fetchSquadData(req.params.id);
      if (!data) {
        return res.status(404).json({ error: "Squad 不存在" });
      }

      const schema = buildSchemaJsonLd({
        id: data.id,
        name: data.name,
        tag: data.tag,
        description: data.description,
        emblemUrl: data.emblemUrl,
        totalGames: data.stats?.totalGames ?? 0,
        totalWins: data.stats?.totalWins ?? 0,
        totalLosses: data.stats?.totalLosses ?? 0,
      });

      res.setHeader("Cache-Control", "public, max-age=600");
      res.json(schema);
    } catch (err) {
      console.error("[squad-seo] schema 失敗:", err);
      res.status(500).json({ error: "產生 schema 失敗" });
    }
  });
}

