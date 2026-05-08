// 🎬 Admin Session Replay — 從 ws_event_log + db_write_log 取出時間軸（Phase 0.3 / 2026-05-08）
//
// 對應規劃：docs/changes/2026-05-08-multi-stability-refactor-plan.md §3.4
//
// 端點：
//   GET /api/admin/sessions/:sessionId/replay
//     query: from, to, userId, eventType, messageType, limit, offset
//     回傳：{ events: WsEvent[], dbWrites: DbWrite[], summary: {...} }
//
//   GET /api/admin/sessions/:sessionId/export.csv
//     query: 同上、但無 limit / offset
//     回傳：text/csv（爭議仲裁存檔用）
//
// 用途：
//   - 玩家爭議：「為什麼我兒子那場沒分數」→ 看時間軸給依據
//   - debug 多人遊戲斷線根因
//   - 重構前後對比效果

import type { Express, Request, Response } from "express";
import { db } from "../db";
import { wsEventLog, dbWriteLog, gameSessions, games } from "@shared/schema";
import { sql, eq, and, gte, lte, desc, asc, count } from "drizzle-orm";
import { requireAdminAuth, requirePermission } from "../adminAuth";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 2000;
const MAX_EXPORT_ROWS = 50000;

interface ReplayFilters {
  sessionId: string;
  from?: Date;
  to?: Date;
  userId?: string;
  eventType?: string;
  messageType?: string;
  limit?: number;
  offset?: number;
}

function parseFilters(req: Request): ReplayFilters {
  const { sessionId } = req.params;
  const q = req.query;

  const fromStr = typeof q.from === "string" ? q.from : null;
  const toStr = typeof q.to === "string" ? q.to : null;
  const limit = Math.min(Number(q.limit) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(Number(q.offset) || 0, 0);

  return {
    sessionId,
    from: fromStr ? new Date(fromStr) : undefined,
    to: toStr ? new Date(toStr) : undefined,
    userId: typeof q.userId === "string" ? q.userId : undefined,
    eventType: typeof q.eventType === "string" ? q.eventType : undefined,
    messageType: typeof q.messageType === "string" ? q.messageType : undefined,
    limit,
    offset,
  };
}

async function checkSessionAccess(sessionId: string, admin: NonNullable<Request["admin"]>) {
  const [session] = await db
    .select({ gameId: gameSessions.gameId })
    .from(gameSessions)
    .where(eq(gameSessions.id, sessionId));
  if (!session) return { ok: false as const, status: 404, message: "Session 不存在" };
  if (!session.gameId) return { ok: false as const, status: 404, message: "Session 無對應 game" };

  const [game] = await db.select({ fieldId: games.fieldId }).from(games).where(eq(games.id, session.gameId));
  if (!game) return { ok: false as const, status: 404, message: "Game 不存在" };

  if (admin.systemRole !== "super_admin" && game.fieldId !== admin.fieldId) {
    return { ok: false as const, status: 403, message: "無權限" };
  }
  return { ok: true as const };
}

function buildWsConditions(f: ReplayFilters) {
  const conds = [eq(wsEventLog.sessionId, f.sessionId)];
  if (f.from) conds.push(gte(wsEventLog.timestamp, f.from));
  if (f.to) conds.push(lte(wsEventLog.timestamp, f.to));
  if (f.userId) conds.push(eq(wsEventLog.userId, f.userId));
  if (f.eventType) conds.push(eq(wsEventLog.eventType, f.eventType));
  if (f.messageType) conds.push(eq(wsEventLog.messageType, f.messageType));
  return and(...conds);
}

function buildDbConditions(f: ReplayFilters) {
  const conds = [eq(dbWriteLog.sessionId, f.sessionId)];
  if (f.from) conds.push(gte(dbWriteLog.timestamp, f.from));
  if (f.to) conds.push(lte(dbWriteLog.timestamp, f.to));
  if (f.userId) conds.push(eq(dbWriteLog.userId, f.userId));
  return and(...conds);
}

async function loadReplayData(filters: ReplayFilters) {
  const wsConds = buildWsConditions(filters);
  const dbConds = buildDbConditions(filters);

  const [events, totalEvents, dbWrites] = await Promise.all([
    db
      .select()
      .from(wsEventLog)
      .where(wsConds)
      .orderBy(asc(wsEventLog.timestamp))
      .limit(filters.limit ?? DEFAULT_LIMIT)
      .offset(filters.offset ?? 0),
    db
      .select({ c: count() })
      .from(wsEventLog)
      .where(wsConds),
    db
      .select()
      .from(dbWriteLog)
      .where(dbConds)
      .orderBy(asc(dbWriteLog.timestamp))
      .limit(1000),
  ]);

  return {
    events,
    dbWrites,
    totalEvents: Number(totalEvents[0]?.c ?? 0),
  };
}

async function loadSummary(sessionId: string) {
  // 各 eventType 計數（給篩選 UI 用）
  const eventTypeStats = await db
    .select({
      eventType: wsEventLog.eventType,
      cnt: count(),
    })
    .from(wsEventLog)
    .where(eq(wsEventLog.sessionId, sessionId))
    .groupBy(wsEventLog.eventType);

  // 各 user 計數
  const userStats = await db.execute<{ user_id: string; user_name: string; cnt: number }>(sql`
    SELECT user_id, MAX(user_name) as user_name, COUNT(*)::int as cnt
    FROM ws_event_log
    WHERE session_id = ${sessionId} AND user_id IS NOT NULL
    GROUP BY user_id
    ORDER BY cnt DESC
    LIMIT 50
  `);

  // session 時間範圍
  const range = await db
    .select({
      first: sql<Date>`MIN(${wsEventLog.timestamp})`,
      last: sql<Date>`MAX(${wsEventLog.timestamp})`,
    })
    .from(wsEventLog)
    .where(eq(wsEventLog.sessionId, sessionId));

  const userRows =
    (userStats as unknown as { rows?: Array<{ user_id: string; user_name: string; cnt: number }> }).rows ?? [];

  return {
    eventTypeStats: eventTypeStats.map((r) => ({ eventType: r.eventType, count: Number(r.cnt) })),
    users: userRows.map((r) => ({ userId: r.user_id, userName: r.user_name, eventCount: Number(r.cnt) })),
    timeRange: {
      first: range[0]?.first ?? null,
      last: range[0]?.last ?? null,
    },
  };
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function registerAdminSessionReplayRoutes(app: Express) {
  // ========== JSON replay ==========
  app.get(
    "/api/admin/sessions/:sessionId/replay",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req: Request, res: Response) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });
        const filters = parseFilters(req);

        const access = await checkSessionAccess(filters.sessionId, req.admin);
        if (!access.ok) return res.status(access.status).json({ error: access.message });

        const [data, summary] = await Promise.all([
          loadReplayData(filters),
          loadSummary(filters.sessionId),
        ]);

        res.json({
          sessionId: filters.sessionId,
          filters: {
            from: filters.from?.toISOString() ?? null,
            to: filters.to?.toISOString() ?? null,
            userId: filters.userId ?? null,
            eventType: filters.eventType ?? null,
            messageType: filters.messageType ?? null,
            limit: filters.limit,
            offset: filters.offset,
          },
          events: data.events,
          dbWrites: data.dbWrites,
          totalEvents: data.totalEvents,
          summary,
          generatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[admin-session-replay] failed:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "查詢失敗" });
      }
    },
  );

  // ========== CSV export ==========
  app.get(
    "/api/admin/sessions/:sessionId/export.csv",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req: Request, res: Response) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });
        const filters = parseFilters(req);
        filters.limit = MAX_EXPORT_ROWS;
        filters.offset = 0;

        const access = await checkSessionAccess(filters.sessionId, req.admin);
        if (!access.ok) return res.status(access.status).json({ error: access.message });

        const wsConds = buildWsConditions(filters);
        const events = await db
          .select()
          .from(wsEventLog)
          .where(wsConds)
          .orderBy(asc(wsEventLog.timestamp))
          .limit(MAX_EXPORT_ROWS);

        const headers = [
          "timestamp",
          "eventType",
          "direction",
          "messageType",
          "userId",
          "userName",
          "teamId",
          "recipientCount",
          "closeCode",
          "reason",
          "clientIp",
          "payload",
        ];
        const rows = events.map((e) =>
          [
            e.timestamp?.toISOString?.() ?? "",
            e.eventType,
            e.direction ?? "",
            e.messageType ?? "",
            e.userId ?? "",
            e.userName ?? "",
            e.teamId ?? "",
            e.recipientCount ?? "",
            e.closeCode ?? "",
            e.reason ?? "",
            e.clientIp ?? "",
            JSON.stringify(e.payload ?? null),
          ]
            .map(csvEscape)
            .join(","),
        );
        const csv = [headers.join(","), ...rows].join("\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="session-${filters.sessionId.slice(0, 12)}-replay.csv"`,
        );
        res.send("﻿" + csv); // UTF-8 BOM 給 Excel 認得
      } catch (err) {
        console.error("[admin-session-replay export] failed:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "匯出失敗" });
      }
    },
  );
}
