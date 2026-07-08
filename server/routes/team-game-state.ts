// 🗂️ team-game-state — 通用多人遊戲狀態持久化（2026-05-05）
//
// 解決問題：LockCoop、RelayMission、TerritoryCapture、CollectiveScore、RoleAssign、
//           QuestChain、JigsawPuzzle、TreasureHunt、GpsCascade 等元件重整後狀態遺失
//
// 設計：一張通用 JSONB 表，team+session+page+type 為 unique key
//       version 防止舊狀態覆蓋新狀態（樂觀並發控制）
//
// 端點：
//   GET  /api/team-state   ?teamId=&sessionId=&pageId=&type=
//   POST /api/team-state   (teamId, sessionId, pageId, type, state, version?)
//
// WS：
//   team_state_updated { type, state, version }   全隊廣播

import type { Express, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../firebaseAuth";
import { db } from "../db";
import { teamMembers } from "@shared/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { RouteContext, AuthenticatedRequest } from "./types";
// 🔐 2026-07-09 S2：isTeamMember 統一到 lib/team-membership（原 5 檔各自複製、易漏）
import { isTeamMember } from "../lib/team-membership";

export async function ensureTeamGameStateSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_game_states (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      team_id VARCHAR NOT NULL,
      session_id VARCHAR NOT NULL,
      page_id VARCHAR NOT NULL,
      component_type VARCHAR NOT NULL,
      state_json JSONB NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_team_game_states
    ON team_game_states (team_id, session_id, page_id, component_type)
  `);
}

type StateRow = {
  id: string;
  team_id: string;
  session_id: string;
  page_id: string;
  component_type: string;
  state_json: Record<string, unknown>;
  version: number;
  updated_at: string;
} & Record<string, unknown>;

const keySchema = z.object({
  teamId: z.string().min(1),
  sessionId: z.string().min(1),
  pageId: z.string().min(1),
  type: z.string().min(1).max(50),
});

const upsertSchema = keySchema.extend({
  state: z.record(z.unknown()),
  version: z.number().int().min(0).optional(),
});

async function fetchState(
  teamId: string, sessionId: string, pageId: string, type: string,
): Promise<StateRow | null> {
  const result = await db.execute<StateRow>(
    sql`SELECT * FROM team_game_states
        WHERE team_id=${teamId} AND session_id=${sessionId}
          AND page_id=${pageId} AND component_type=${type}
        LIMIT 1`,
  );
  const rows = (result as unknown as { rows?: StateRow[] }).rows ?? [];
  return rows[0] ?? null;
}

export function registerTeamGameStateRoutes(app: Express, ctx: RouteContext): void {
  /**
   * GET /api/team-state
   */
  app.get(
    "/api/team-state",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = keySchema.safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ message: "參數錯誤" });
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "請先登入" });
        const { teamId, sessionId, pageId, type } = parsed.data;
        if (!(await isTeamMember(teamId, userId))) return res.status(403).json({ message: "非隊伍成員" });
        const state = await fetchState(teamId, sessionId, pageId, type);
        res.json({ state });
      } catch (err) {
        console.error("[team-state] get 失敗:", err);
        res.status(500).json({ message: "讀取狀態失敗" });
      }
    },
  );

  /**
   * POST /api/team-state
   * INSERT ON CONFLICT → 只更新 version > 現有 version（防舊狀態覆蓋）
   */
  app.post(
    "/api/team-state",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = upsertSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: "參數錯誤" });
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "請先登入" });
        const { teamId, sessionId, pageId, type, state, version } = parsed.data;
        if (!(await isTeamMember(teamId, userId))) return res.status(403).json({ message: "非隊伍成員" });

        const stateJson = JSON.stringify(state);

        // 🆕 2026-05-07 A2：用 RETURNING 看是否真的更新、衝突時回 409
        let upsertResult: { rowCount?: number | null } | undefined;

        if (version !== undefined) {
          // 有 version：只在 version > current 時更新（防止舊狀態覆蓋）
          upsertResult = await db.execute(sql`
            INSERT INTO team_game_states (team_id, session_id, page_id, component_type, state_json, version)
            VALUES (${teamId}, ${sessionId}, ${pageId}, ${type}, ${stateJson}::jsonb, ${version})
            ON CONFLICT (team_id, session_id, page_id, component_type) DO UPDATE
              SET state_json = EXCLUDED.state_json,
                  version = EXCLUDED.version,
                  updated_at = NOW()
              WHERE team_game_states.version < EXCLUDED.version
            RETURNING id
          `);
        } else {
          // 沒有 version：直接覆寫 + version+1
          upsertResult = await db.execute(sql`
            INSERT INTO team_game_states (team_id, session_id, page_id, component_type, state_json, version)
            VALUES (${teamId}, ${sessionId}, ${pageId}, ${type}, ${stateJson}::jsonb, 1)
            ON CONFLICT (team_id, session_id, page_id, component_type) DO UPDATE
              SET state_json = EXCLUDED.state_json,
                  version = team_game_states.version + 1,
                  updated_at = NOW()
            RETURNING id
          `);
        }

        const saved = await fetchState(teamId, sessionId, pageId, type);

        // 🆕 A2 樂觀鎖衝突檢查：rowCount 0 表示 version 不夠新、UPDATE 被 WHERE 擋
        // 只在帶 version 時才檢（沒帶 version 是「直接覆寫」流程）
        const rowCount = upsertResult?.rowCount ?? 0;
        if (version !== undefined && rowCount === 0) {
          return res.status(409).json({
            message: "狀態已被隊友更新（version 過舊）、請拉取最新狀態後重試",
            state: saved,
            conflict: true,
          });
        }

        if (saved) {
          ctx.broadcastToTeam(teamId, {
            type: "team_state_updated",
            componentType: type,
            state: saved.state_json,
            version: saved.version,
          });
        }
        res.json({ state: saved });
      } catch (err) {
        console.error("[team-state] post 失敗:", err);
        res.status(500).json({ message: "更新狀態失敗" });
      }
    },
  );
}
