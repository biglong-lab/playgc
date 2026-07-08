// 🎯 team-shooting — 隊伍射擊命中持久化（2026-05-05）
//
// 解決問題：重整後命中紀錄遺失、MQTT 命中無法同步給後進入的玩家
//
// 設計：team-level 命中累計，每個 hit 一筆紀錄
//
// 端點：
//   GET  /api/team-shooting/hits    ?teamId=&sessionId=&pageId=
//   POST /api/team-shooting/hit     (teamId, sessionId, pageId, userId, displayName, hitZone, score)
//
// WS：
//   shooting_hit_updated { teamHits }   全隊廣播

import type { Express, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../firebaseAuth";
import { db } from "../db";
import { teamMembers } from "@shared/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { RouteContext, AuthenticatedRequest } from "./types";
// 🔐 2026-07-09 S2：isTeamMember 統一到 lib/team-membership（原 5 檔各自複製、易漏）
import { isTeamMember } from "../lib/team-membership";

export async function ensureTeamShootingSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_shooting_hits (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      team_id VARCHAR NOT NULL,
      session_id VARCHAR NOT NULL,
      page_id VARCHAR NOT NULL,
      user_id VARCHAR NOT NULL,
      display_name VARCHAR NOT NULL,
      hit_zone VARCHAR NOT NULL DEFAULT 'outer',
      score INTEGER NOT NULL DEFAULT 0,
      hit_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_team_shooting_hits_team
    ON team_shooting_hits (team_id, session_id, page_id)
  `);
}

type TeamShootingHitRow = {
  id: string;
  team_id: string;
  session_id: string;
  page_id: string;
  user_id: string;
  display_name: string;
  hit_zone: string;
  score: number;
  hit_at: string;
} & Record<string, unknown>;

const hitsQuerySchema = z.object({
  teamId: z.string().min(1),
  sessionId: z.string().min(1),
  pageId: z.string().min(1),
});

const hitSchema = hitsQuerySchema.extend({
  displayName: z.string().min(1).max(100),
  hitZone: z.string().min(1).max(50).default("outer"),
  score: z.number().int().min(0).max(1000).default(0),
});

async function fetchHits(teamId: string, sessionId: string, pageId: string): Promise<TeamShootingHitRow[]> {
  const result = await db.execute<TeamShootingHitRow>(
    sql`SELECT * FROM team_shooting_hits
        WHERE team_id = ${teamId}
          AND session_id = ${sessionId}
          AND page_id = ${pageId}
        ORDER BY hit_at ASC`,
  );
  return (result as unknown as { rows?: TeamShootingHitRow[] }).rows ?? [];
}

export function registerTeamShootingRoutes(app: Express, ctx: RouteContext): void {
  app.get(
    "/api/team-shooting/hits",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = hitsQuerySchema.safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ message: "參數錯誤" });
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "請先登入" });
        const { teamId, sessionId, pageId } = parsed.data;
        if (!(await isTeamMember(teamId, userId))) return res.status(403).json({ message: "非隊伍成員" });
        const hits = await fetchHits(teamId, sessionId, pageId);
        res.json({ hits });
      } catch (err) {
        console.error("[team-shooting] hits get 失敗:", err);
        res.status(500).json({ message: "讀取命中失敗" });
      }
    },
  );

  app.post(
    "/api/team-shooting/hit",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = hitSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: "參數錯誤" });
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "請先登入" });
        const { teamId, sessionId, pageId, displayName, hitZone, score } = parsed.data;
        if (!(await isTeamMember(teamId, userId))) return res.status(403).json({ message: "非隊伍成員" });

        await db.execute(sql`
          INSERT INTO team_shooting_hits (team_id, session_id, page_id, user_id, display_name, hit_zone, score)
          VALUES (${teamId}, ${sessionId}, ${pageId}, ${userId}, ${displayName}, ${hitZone}, ${score})
        `);

        const hits = await fetchHits(teamId, sessionId, pageId);
        ctx.broadcastToTeam(teamId, { type: "shooting_hit_updated", hits });
        res.json({ hits });
      } catch (err) {
        console.error("[team-shooting] hit 寫入失敗:", err);
        res.status(500).json({ message: "命中寫入失敗" });
      }
    },
  );
}
