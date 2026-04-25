// 水彈對戰玩家自評（Mode B）— Phase 14.6
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §11.2
//
// 流程：
//   1. 雙方隊長按「我們贏 / 我們輸 / 平手」
//   2. 雙方一致 → 系統自動結算（內部呼叫 admin 結算邏輯）
//   3. 不一致 → 標記爭議，通知場域裁判仲裁
//
// 端點：
//   POST /api/battle/slots/:slotId/self-report
//     body: { result: "win" | "loss" | "draw" }
//   GET  /api/battle/slots/:slotId/self-reports
//     回傳雙方目前的 self-report 狀態
//
import type { Express } from "express";
import { db } from "../db";
import {
  battleSlots,
  battleClans,
  battleClanMembers,
  battleResults,
  notificationEvents,
} from "@shared/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest } from "./types";
import { z } from "zod";
import { checkConsensus, type SelfReport } from "../services/battle-consensus";

const reportSchema = z.object({
  result: z.enum(["win", "loss", "draw"]),
});

/**
 * 用 notification_events 表暫存 self-report
 * （eventType: "battle_self_report"，payload 含 result + reportedBy）
 *
 * 設計考量：
 *   - 不另開表（避免 schema 過度膨脹）
 *   - 一個 slot 最多 2 筆 (紅隊長 + 藍隊長)
 *   - 達成共識後寫入 battle_results
 */
const SELF_REPORT_EVENT_TYPE = "battle_self_report";

async function getSelfReports(slotId: string): Promise<SelfReport[]> {
  const events = await db
    .select()
    .from(notificationEvents)
    .where(
      and(
        eq(notificationEvents.eventType, SELF_REPORT_EVENT_TYPE),
        eq(notificationEvents.channelType, "in_app"),
      ),
    )
    .orderBy(desc(notificationEvents.createdAt))
    .limit(50);

  return events
    .filter((e) => {
      const payload = e.payload as Record<string, unknown>;
      return payload?.slotId === slotId;
    })
    .map((e) => {
      const payload = e.payload as {
        slotId: string;
        result: "win" | "loss" | "draw";
        team: string;
        reporterUserId: string;
      };
      return {
        reporterUserId: payload.reporterUserId,
        team: payload.team,
        result: payload.result,
        reportedAt: e.createdAt,
      };
    });
}

export function registerBattleSelfReportRoutes(app: Express) {
  // ============================================================================
  // POST /api/battle/slots/:slotId/self-report
  // ============================================================================
  app.post(
    "/api/battle/slots/:slotId/self-report",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const slotId = req.params.slotId;
        const parsed = reportSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "驗證失敗" });
        }

        // 取 slot
        const [slot] = await db
          .select()
          .from(battleSlots)
          .where(eq(battleSlots.id, slotId));
        if (!slot) return res.status(404).json({ error: "對戰不存在" });
        if (slot.status === "completed") {
          return res.status(409).json({ error: "對戰已結算" });
        }

        // 已有 admin 結算過？
        const [existing] = await db
          .select()
          .from(battleResults)
          .where(eq(battleResults.slotId, slotId));
        if (existing) {
          return res.status(409).json({ error: "對戰已由 admin 結算" });
        }

        // 取 user 所屬戰隊
        const [userClan] = await db
          .select({ clan: battleClans, membership: battleClanMembers })
          .from(battleClanMembers)
          .innerJoin(battleClans, eq(battleClans.id, battleClanMembers.clanId))
          .where(
            and(
              eq(battleClanMembers.userId, userId),
              isNull(battleClanMembers.leftAt),
            ),
          );

        if (!userClan) {
          return res.status(403).json({ error: "你沒有戰隊，無法回報" });
        }
        // 限隊長/officer
        if (
          userClan.membership.role !== "leader" &&
          userClan.membership.role !== "officer"
        ) {
          return res.status(403).json({ error: "只有隊長或 officer 可回報" });
        }

        // 取該玩家所屬 team（從 player_results / 或自動推算）
        // 簡化：用 user clan name 當 team identifier
        const team = userClan.clan.name;

        // 寫入 self-report event
        await db.insert(notificationEvents).values({
          fieldId: userClan.clan.fieldId,
          userId,
          eventType: SELF_REPORT_EVENT_TYPE,
          channelType: "in_app",
          status: "sent",
          payload: {
            slotId,
            result: parsed.data.result,
            team,
            reporterUserId: userId,
            reportedAt: new Date().toISOString(),
          },
          sentAt: new Date(),
        });

        // 檢查共識
        const reports = await getSelfReports(slotId);
        const consensus = checkConsensus(reports);

        if (!consensus.consistent) {
          // 還沒共識（缺一方 / 不一致）
          return res.json({
            success: true,
            consensus: false,
            reportsCount: reports.length,
            message:
              reports.length < 2
                ? "等待對方隊長回報"
                : "🟡 雙方意見不一致，已通知場域裁判仲裁",
            disputed: reports.length >= 2,
          });
        }

        // 達成共識 → 自動結算
        const winningTeam = consensus.isDraw ? null : consensus.winningTeam;
        const isDraw = consensus.isDraw ?? false;

        const [created] = await db
          .insert(battleResults)
          .values({
            slotId,
            venueId: slot.venueId,
            winningTeam,
            isDraw,
            recordedBy: userId, // 標記是玩家自評
            notes: "玩家自評（Mode B）",
          })
          .returning();

        // 更新 slot status
        await db
          .update(battleSlots)
          .set({ status: "completed" })
          .where(eq(battleSlots.id, slotId));

        res.status(201).json({
          success: true,
          consensus: true,
          winningTeam,
          isDraw,
          resultId: created.id,
        });
      } catch (err) {
        console.error("[battle-self-report] POST 失敗:", err);
        res.status(500).json({ error: "回報失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/battle/slots/:slotId/self-reports — 看雙方自評狀態
  // ============================================================================
  app.get(
    "/api/battle/slots/:slotId/self-reports",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const slotId = req.params.slotId;
        const reports = await getSelfReports(slotId);
        const consensus = checkConsensus(reports);

        res.json({
          slotId,
          reports,
          consensus,
        });
      } catch (err) {
        console.error("[battle-self-report] GET 失敗:", err);
        res.status(500).json({ error: "取得回報狀態失敗" });
      }
    },
  );
}

