// 🔐 team-lock-coop — 隊伍協作解鎖持久化（2026-05-05）
//
// 端點：
//   GET  /api/team-lock-coop/state   ?teamId=&sessionId=&pageId=
//   POST /api/team-lock-coop/update  (teamId, sessionId, pageId, action, payload)
//
// WS：lock_coop_updated { state }   全隊廣播

import type { Express, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../firebaseAuth";
import { db } from "../db";
import { teamMembers } from "@shared/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { RouteContext, AuthenticatedRequest } from "./types";

export async function ensureTeamLockCoopSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_lock_states (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      team_id VARCHAR NOT NULL,
      session_id VARCHAR NOT NULL,
      page_id VARCHAR NOT NULL,
      shared_code VARCHAR NOT NULL DEFAULT '',
      attempts INTEGER NOT NULL DEFAULT 0,
      is_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
      is_failed BOOLEAN NOT NULL DEFAULT FALSE,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  // 🆕 2026-05-07：A1 加 version 欄位（樂觀鎖、解 R1 race condition）
  // 既有 table 沒此欄位、ALTER 補上（IF NOT EXISTS）
  await db.execute(sql`
    ALTER TABLE team_lock_states ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_team_lock_states
    ON team_lock_states (team_id, session_id, page_id)
  `);
}

async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const m = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId), isNull(teamMembers.leftAt)))
    .limit(1);
  return m.length > 0;
}

type LockStateRow = {
  id: string;
  team_id: string;
  session_id: string;
  page_id: string;
  shared_code: string;
  attempts: number;
  is_unlocked: boolean;
  is_failed: boolean;
  version: number;
  updated_at: string;
} & Record<string, unknown>;

const keySchema = z.object({
  teamId: z.string().min(1),
  sessionId: z.string().min(1),
  pageId: z.string().min(1),
});

const updateSchema = keySchema.extend({
  action: z.enum(["code", "attempt", "unlocked", "failed"]),
  payload: z.object({
    code: z.string().optional(),
    attempts: z.number().int().min(0).optional(),
  }).optional(),
  // 🆕 2026-05-07 A1：client 帶當前 version、server 樂觀鎖
  // 沒帶（舊 client）→ 退回原邏輯（盲寫）但 server log 警告
  expectedVersion: z.number().int().min(1).optional(),
});

async function fetchState(teamId: string, sessionId: string, pageId: string): Promise<LockStateRow | null> {
  const result = await db.execute<LockStateRow>(
    sql`SELECT * FROM team_lock_states WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId} LIMIT 1`,
  );
  const rows = (result as unknown as { rows?: LockStateRow[] }).rows ?? [];
  return rows[0] ?? null;
}

export function registerTeamLockCoopRoutes(app: Express, ctx: RouteContext): void {
  app.get(
    "/api/team-lock-coop/state",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = keySchema.safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ message: "參數錯誤" });
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "請先登入" });
        const { teamId, sessionId, pageId } = parsed.data;
        if (!(await isTeamMember(teamId, userId))) return res.status(403).json({ message: "非隊伍成員" });
        const state = await fetchState(teamId, sessionId, pageId);
        res.json({ state });
      } catch (err) {
        console.error("[team-lock-coop] state get 失敗:", err);
        res.status(500).json({ message: "讀取狀態失敗" });
      }
    },
  );

  app.post(
    "/api/team-lock-coop/update",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = updateSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: "參數錯誤" });
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "請先登入" });
        const { teamId, sessionId, pageId, action, payload, expectedVersion } = parsed.data;
        if (!(await isTeamMember(teamId, userId))) return res.status(403).json({ message: "非隊伍成員" });

        // 先確保記錄存在
        await db.execute(sql`
          INSERT INTO team_lock_states (team_id, session_id, page_id)
          VALUES (${teamId}, ${sessionId}, ${pageId})
          ON CONFLICT (team_id, session_id, page_id) DO NOTHING
        `);

        // 🆕 2026-05-07 A1：樂觀鎖
        //   - 帶 expectedVersion → WHERE version=expectedVersion 防 race
        //   - 沒帶（舊 client）→ 走原邏輯（盲寫）但 log warn
        //   - UPDATE 影響 0 row 表示 version 不對 → 回 409 + currentState
        let updateResult: { rowCount?: number | null } | undefined;

        if (action === "code" && payload?.code !== undefined) {
          if (expectedVersion !== undefined) {
            updateResult = await db.execute(sql`
              UPDATE team_lock_states SET shared_code=${payload.code}, version=version+1, updated_at=NOW()
              WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId}
                AND version=${expectedVersion}
            `);
          } else {
            console.warn("[team-lock-coop] update 沒帶 expectedVersion、舊 client 盲寫 race risk");
            updateResult = await db.execute(sql`
              UPDATE team_lock_states SET shared_code=${payload.code}, version=version+1, updated_at=NOW()
              WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId}
            `);
          }
        } else if (action === "attempt" && payload?.attempts !== undefined) {
          if (expectedVersion !== undefined) {
            updateResult = await db.execute(sql`
              UPDATE team_lock_states SET attempts=${payload.attempts}, version=version+1, updated_at=NOW()
              WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId}
                AND version=${expectedVersion}
            `);
          } else {
            updateResult = await db.execute(sql`
              UPDATE team_lock_states SET attempts=${payload.attempts}, version=version+1, updated_at=NOW()
              WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId}
            `);
          }
        } else if (action === "unlocked") {
          // unlocked / failed 是 terminal state、不檢樂觀鎖（誰先到誰算）
          updateResult = await db.execute(sql`
            UPDATE team_lock_states SET is_unlocked=TRUE, version=version+1, updated_at=NOW()
            WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId}
          `);
        } else if (action === "failed") {
          updateResult = await db.execute(sql`
            UPDATE team_lock_states SET is_failed=TRUE, version=version+1, updated_at=NOW()
            WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId}
          `);
        }

        // 🆕 樂觀鎖衝突檢查：UPDATE 0 row 表示 version 不對
        const rowCount = updateResult?.rowCount ?? 0;
        if (
          expectedVersion !== undefined &&
          (action === "code" || action === "attempt") &&
          rowCount === 0
        ) {
          const latest = await fetchState(teamId, sessionId, pageId);
          return res.status(409).json({
            message: "狀態已被隊友更新、請拉取最新狀態後重試",
            state: latest,
            conflict: true,
          });
        }

        const state = await fetchState(teamId, sessionId, pageId);
        if (state) ctx.broadcastToTeam(teamId, { type: "lock_coop_updated", state });
        res.json({ state });
      } catch (err) {
        console.error("[team-lock-coop] update 失敗:", err);
        res.status(500).json({ message: "更新狀態失敗" });
      }
    },
  );
}
