// 📸 team-photo-gather — 集合模式合照 server-side 持久化（2026-05-05）
//
// 解決問題：
//   - 隊長拍完合照、其他人按合照題目仍要重拍（重複拍照）
//   - 重整後合照記錄丟失、要重拍
//
// 設計：team-level 一張主照、第一個玩家拍完後其他人看到完成畫面直接繼續
//
// 端點：
//   GET  /api/team-photo-gather/state    ?teamId=&sessionId=&pageId=
//   POST /api/team-photo-gather/complete (teamId, sessionId, pageId, mainPhotoUrl)
//
// WS：
//   photo_gather_updated { state }   全隊廣播

import type { Express, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../firebaseAuth";
import { db } from "../db";
import { teamMembers } from "@shared/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { RouteContext, AuthenticatedRequest } from "./types";
// 🔐 2026-07-09 S2：isTeamMember 統一到 lib/team-membership（原 5 檔各自複製、易漏）
import { isTeamMember } from "../lib/team-membership";

export async function ensureTeamPhotoGatherSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_photo_gather (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      team_id VARCHAR NOT NULL,
      session_id VARCHAR NOT NULL,
      page_id VARCHAR NOT NULL,
      completed_by_user_id VARCHAR NOT NULL,
      completed_by_display_name VARCHAR NOT NULL,
      main_photo_url VARCHAR NOT NULL,
      shot_count INTEGER NOT NULL DEFAULT 1,
      completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_team_photo_gather
    ON team_photo_gather (team_id, session_id, page_id)
  `);
}

const stateQuerySchema = z.object({
  teamId: z.string().min(1),
  sessionId: z.string().min(1),
  pageId: z.string().min(1),
});

const completeSchema = stateQuerySchema.extend({
  mainPhotoUrl: z.string().url().or(z.string().startsWith("data:")), // url 或 dataURL
  shotCount: z.number().int().min(1).max(10).optional(),
  displayName: z.string().min(1).max(100),
});

type TeamPhotoGatherRow = {
  id: string;
  team_id: string;
  session_id: string;
  page_id: string;
  completed_by_user_id: string;
  completed_by_display_name: string;
  main_photo_url: string;
  shot_count: number;
  completed_at: string;
  created_at: string;
} & Record<string, unknown>;

async function fetchState(
  teamId: string,
  sessionId: string,
  pageId: string,
): Promise<TeamPhotoGatherRow | null> {
  const result = await db.execute<TeamPhotoGatherRow>(
    sql`SELECT * FROM team_photo_gather
        WHERE team_id = ${teamId}
          AND session_id = ${sessionId}
          AND page_id = ${pageId}
        LIMIT 1`,
  );
  const rows = (result as unknown as { rows?: TeamPhotoGatherRow[] }).rows ?? [];
  return rows[0] ?? null;
}

export function registerTeamPhotoGatherRoutes(
  app: Express,
  ctx: RouteContext,
): void {
  /**
   * GET /api/team-photo-gather/state
   * 拉當前合照狀態（已完成 / null=尚未）
   */
  app.get(
    "/api/team-photo-gather/state",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = stateQuerySchema.safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ message: "參數錯誤" });
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "請先登入" });

        const { teamId, sessionId, pageId } = parsed.data;
        if (!(await isTeamMember(teamId, userId))) {
          return res.status(403).json({ message: "非隊伍成員" });
        }

        const state = await fetchState(teamId, sessionId, pageId);
        res.json({ state });
      } catch (err) {
        console.error("[team-photo-gather] state get 失敗:", err);
        res.status(500).json({ message: "讀取狀態失敗" });
      }
    },
  );

  /**
   * POST /api/team-photo-gather/complete
   * 寫入主照（INSERT ON CONFLICT DO NOTHING — 第一人 win、其他冪等）
   * 寫入後 ws broadcast、其他人看到自動跳過
   */
  app.post(
    "/api/team-photo-gather/complete",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = completeSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "參數錯誤" });
        }
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "請先登入" });

        const { teamId, sessionId, pageId, mainPhotoUrl, shotCount = 1, displayName } = parsed.data;
        if (!(await isTeamMember(teamId, userId))) {
          return res.status(403).json({ message: "非隊伍成員" });
        }

        // INSERT ... ON CONFLICT DO NOTHING — 第一人 win、其他冪等
        await db.execute(sql`
          INSERT INTO team_photo_gather (
            team_id, session_id, page_id,
            completed_by_user_id, completed_by_display_name,
            main_photo_url, shot_count
          ) VALUES (
            ${teamId}, ${sessionId}, ${pageId},
            ${userId}, ${displayName},
            ${mainPhotoUrl}, ${shotCount}
          )
          ON CONFLICT (team_id, session_id, page_id) DO NOTHING
        `);

        const state = await fetchState(teamId, sessionId, pageId);

        // ws broadcast — 整隊看到合照已完成
        if (state) {
          ctx.broadcastToTeam(teamId, {
            type: "photo_gather_updated",
            state,
          });
        }

        res.json({ state });
      } catch (err) {
        console.error("[team-photo-gather] complete 失敗:", err);
        res.status(500).json({ message: "寫入合照失敗" });
      }
    },
  );
}
