// 🆘 Admin 排解中心 API（2026-05-19 Phase E）
//
// 端點：
//   GET /api/admin/troubleshoot/dashboard
//     - 今日異常 sessions / bookings / 已重置場次
//     - 最近 50 筆排解類 audit_logs
//
// 排解類 action 定義：force_checkin / reschedule / reset / refund /
//   manual_issue / bulk_abandon / cancel_admin

import type { Express } from "express";
import { db } from "../db";
import {
  gameSessions,
  games,
  bookings,
  auditLogs,
  fields,
  adminAccounts,
  refunds,
  posTransactions,
} from "@shared/schema";
import { and, eq, gte, lte, or, inArray, desc, sql, gt, isNotNull } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import { z } from "zod";

// 排解類 action key（要過濾顯示在「最近排解操作」）
const TROUBLESHOOT_ACTIONS = [
  "pos:force_checkin",
  "booking:reschedule",
  "booking:cancel_admin",
  "booking:mark_no_show_admin",
  "session:reset",
  "session:bulk_abandon",
  "purchase:refund",
  "refund:create",
  "reward:manual_issue",
  "activity:deactivate",
  "redeem_code:delete",
];

/** 取場域識別碼（UUID + code 雙容、延用 POS pattern）*/
async function resolveFieldScope(
  fieldId: string,
): Promise<{ id: string; code: string; identifiers: string[] } | null> {
  const [row] = await db
    .select({ id: fields.id, code: fields.code })
    .from(fields)
    .where(or(eq(fields.id, fieldId), eq(fields.code, fieldId)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    identifiers: Array.from(new Set([row.id, row.code].filter(Boolean) as string[])),
  };
}

function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const taipeiOffset = 8 * 60;
  const taipeiMs = now.getTime() + taipeiOffset * 60 * 1000;
  const taipeiDate = new Date(taipeiMs);
  const dayStart = new Date(
    Date.UTC(taipeiDate.getUTCFullYear(), taipeiDate.getUTCMonth(), taipeiDate.getUTCDate()),
  );
  const start = new Date(dayStart.getTime() - taipeiOffset * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

export function registerAdminTroubleshootRoutes(app: Express) {
  // GET /api/admin/troubleshoot/dashboard
  app.get(
    "/api/admin/troubleshoot/dashboard",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });
        const isSuper = req.admin.systemRole === "super_admin";
        const adminFieldId = req.admin.fieldId;
        if (!adminFieldId && !isSuper) {
          return res.status(400).json({ error: "no_field" });
        }

        const scope = adminFieldId ? await resolveFieldScope(adminFieldId) : null;
        const fieldIdentifiers = scope ? scope.identifiers : null;
        const { start, end } = getTodayRange();

        // 1. 今日異常 bookings
        //    - cancelled 但 paid（客人取消但已付款 → 需處理退款）
        //    - no_show 但 paid（沒到但已付款）
        //    - confirmed 但已過時段未報到
        const bookingWhere = [
          gte(bookings.slotStart, new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000)), // 近 7 天
          lte(bookings.slotStart, end),
        ];
        if (fieldIdentifiers) {
          bookingWhere.push(inArray(bookings.fieldId, fieldIdentifiers));
        }
        const recentBookings = await db
          .select({
            id: bookings.id,
            bookingCode: bookings.bookingCode,
            displayName: bookings.displayName,
            phone: bookings.phone,
            slotStart: bookings.slotStart,
            status: bookings.status,
            paymentStatus: bookings.paymentStatus,
            paidAt: bookings.paidAt,
            amountCents: bookings.amountCents,
            checkedInAt: bookings.checkedInAt,
            fieldId: bookings.fieldId,
          })
          .from(bookings)
          .where(and(...bookingWhere))
          .orderBy(desc(bookings.slotStart))
          .limit(200);

        const now = new Date();
        const abnormalBookings = recentBookings.filter((b) => {
          // 異常 1：cancelled / no_show 但有付款
          if ((b.status === "cancelled" || b.status === "no_show") && b.paidAt) {
            return true;
          }
          // 異常 2：confirmed 但已超過時段 2 小時未報到 + 已付款
          if (b.status === "confirmed" && !b.checkedInAt && b.paidAt) {
            const slotStart = new Date(b.slotStart);
            if (now.getTime() - slotStart.getTime() > 2 * 60 * 60 * 1000) return true;
          }
          return false;
        });

        // 2. 重置過的 sessions（近 7 天）
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const sessionWhere = [
          gt(gameSessions.resetCount, 0),
          gte(gameSessions.startedAt, sevenDaysAgo),
        ];
        if (fieldIdentifiers) {
          // sessions 沒直接 fieldId、走 games join
          // 用 sql.raw 防 SQL injection（已 inArray）
        }
        let resetSessionsQuery = db
          .select({
            id: gameSessions.id,
            teamName: gameSessions.teamName,
            playerName: gameSessions.playerName,
            status: gameSessions.status,
            resetCount: gameSessions.resetCount,
            startedAt: gameSessions.startedAt,
            gameName: games.title,
            gameFieldId: games.fieldId,
          })
          .from(gameSessions)
          .leftJoin(games, eq(gameSessions.gameId, games.id))
          .where(and(...sessionWhere))
          .orderBy(desc(gameSessions.startedAt))
          .limit(50);
        const resetSessionsRaw = await resetSessionsQuery;
        const resetSessions = fieldIdentifiers
          ? resetSessionsRaw.filter((s) => s.gameFieldId && fieldIdentifiers.includes(s.gameFieldId))
          : resetSessionsRaw;

        // 3. 卡住的 sessions（status=playing、開始超過 24 小時、沒 completedAt）
        //    這些可能需要 bulk_abandon 或 reset
        const stuckCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const stuckRaw = await db
          .select({
            id: gameSessions.id,
            teamName: gameSessions.teamName,
            playerName: gameSessions.playerName,
            startedAt: gameSessions.startedAt,
            gameName: games.title,
            gameFieldId: games.fieldId,
          })
          .from(gameSessions)
          .leftJoin(games, eq(gameSessions.gameId, games.id))
          .where(
            and(
              eq(gameSessions.status, "playing"),
              lte(gameSessions.startedAt, stuckCutoff),
            ),
          )
          .orderBy(desc(gameSessions.startedAt))
          .limit(50);
        const stuckSessions = fieldIdentifiers
          ? stuckRaw.filter((s) => s.gameFieldId && fieldIdentifiers.includes(s.gameFieldId))
          : stuckRaw;

        // 4. 最近排解類 audit logs（近 50 筆）
        const auditWhere = [inArray(auditLogs.action, TROUBLESHOOT_ACTIONS)];
        if (fieldIdentifiers && !isSuper) {
          // field admin 只看自己場域、super admin 看全部
          auditWhere.push(inArray(auditLogs.fieldId, fieldIdentifiers));
        }
        const recentAudit = await db
          .select({
            id: auditLogs.id,
            action: auditLogs.action,
            targetType: auditLogs.targetType,
            targetId: auditLogs.targetId,
            fieldId: auditLogs.fieldId,
            metadata: auditLogs.metadata,
            createdAt: auditLogs.createdAt,
            adminUsername: adminAccounts.username,
            adminDisplayName: adminAccounts.displayName,
          })
          .from(auditLogs)
          .leftJoin(adminAccounts, eq(auditLogs.actorAdminId, adminAccounts.id))
          .where(and(...auditWhere))
          .orderBy(desc(auditLogs.createdAt))
          .limit(50);

        res.json({
          stats: {
            abnormalBookings: abnormalBookings.length,
            resetSessions: resetSessions.length,
            stuckSessions: stuckSessions.length,
            recentTroubleshootActions: recentAudit.length,
          },
          abnormalBookings,
          resetSessions,
          stuckSessions,
          recentAudit,
        });
      } catch (err) {
        console.error("[admin-troubleshoot] dashboard failed:", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════
  // 🆕 2026-05-19 Phase D：退款管理（cash 部分實作、線上等金流帳號）
  // ═══════════════════════════════════════════════════════════════

  // GET /api/admin/refunds — 列出退款
  app.get(
    "/api/admin/refunds",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });
        const isSuper = req.admin.systemRole === "super_admin";
        const scope = req.admin.fieldId ? await resolveFieldScope(req.admin.fieldId) : null;

        const conditions = [];
        if (!isSuper && scope) {
          conditions.push(inArray(refunds.fieldId, scope.identifiers));
        }
        if (req.query.status) {
          conditions.push(eq(refunds.status, String(req.query.status)));
        }

        const rows = await db
          .select({
            refund: refunds,
            staffUsername: adminAccounts.username,
            staffDisplayName: adminAccounts.displayName,
          })
          .from(refunds)
          .leftJoin(adminAccounts, eq(refunds.processedByStaffId, adminAccounts.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(refunds.createdAt))
          .limit(200);

        res.json({
          refunds: rows.map((r) => ({
            ...r.refund,
            staffName: r.staffDisplayName ?? r.staffUsername ?? null,
          })),
        });
      } catch (err) {
        console.error("[admin-refunds] list failed:", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // POST /api/admin/refunds — 建立退款
  // cash 模式：立即 completed（業主自己手動退錢）
  // 線上模式：先 pending、等 callback（本期不串接）
  const createRefundSchema = z.object({
    sourceType: z.enum(["pos_transaction", "booking"]),
    sourceId: z.string().min(1).max(100),
    bookingId: z.number().int().optional(),
    amountCents: z.number().int().min(1),
    reason: z.string().min(5, "原因至少 5 字").max(500),
    refundMethod: z.enum(["cash", "recur", "stripe", "linepay", "manual_adjust"]),
    customerName: z.string().max(100).optional(),
    customerPhone: z.string().max(20).optional(),
  });

  app.post(
    "/api/admin/refunds",
    requireAdminAuth,
    requirePermission("field:manage"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });

        const parsed = createRefundSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "validation",
            message: parsed.error.errors[0]?.message ?? "請求格式錯誤",
          });
        }

        const adminFieldId = req.admin.fieldId;
        if (!adminFieldId && req.admin.systemRole !== "super_admin") {
          return res.status(400).json({ error: "no_field" });
        }

        // 找出原交易確認可退（avoid 退超過原額）
        let sourceFieldId: string | undefined = adminFieldId;
        if (parsed.data.sourceType === "pos_transaction") {
          const [tx] = await db
            .select()
            .from(posTransactions)
            .where(eq(posTransactions.id, parsed.data.sourceId))
            .limit(1);
          if (!tx) return res.status(404).json({ error: "transaction_not_found" });
          sourceFieldId = tx.fieldId;

          // 已退過的累計
          const previousRefunds = await db
            .select({ total: sql<number>`COALESCE(SUM(${refunds.amountCents}), 0)::int` })
            .from(refunds)
            .where(
              and(
                eq(refunds.sourceType, "pos_transaction"),
                eq(refunds.sourceId, parsed.data.sourceId),
                inArray(refunds.status, ["pending", "completed"]),
              ),
            );
          const refunded = previousRefunds[0]?.total ?? 0;
          const remaining = (tx.paidAmountCents ?? 0) - refunded;
          if (parsed.data.amountCents > remaining) {
            return res.status(400).json({
              error: "exceeds_refundable",
              message: `可退金額：NT$${(remaining / 100).toFixed(0)}（原額 NT$${((tx.paidAmountCents ?? 0) / 100).toFixed(0)}、已退 NT$${(refunded / 100).toFixed(0)}）`,
            });
          }
        }

        // 場域權限檢查：非 super 不能退別場
        const isSuper = req.admin.systemRole === "super_admin";
        if (!isSuper && sourceFieldId !== adminFieldId) {
          const scope = adminFieldId ? await resolveFieldScope(adminFieldId) : null;
          if (!scope || !scope.identifiers.includes(sourceFieldId ?? "")) {
            return res.status(403).json({ error: "wrong_field", message: "不能退別場域的款" });
          }
        }

        // cash 立即 completed、其他先 pending
        const now = new Date();
        const status = parsed.data.refundMethod === "cash" || parsed.data.refundMethod === "manual_adjust"
          ? "completed"
          : "pending";

        const [created] = await db
          .insert(refunds)
          .values({
            fieldId: sourceFieldId ?? adminFieldId!,
            sourceType: parsed.data.sourceType,
            sourceId: parsed.data.sourceId,
            bookingId: parsed.data.bookingId ?? null,
            amountCents: parsed.data.amountCents,
            reason: parsed.data.reason,
            refundMethod: parsed.data.refundMethod,
            status,
            processedByStaffId: req.admin.id,
            processedAt: status === "completed" ? now : null,
            customerName: parsed.data.customerName ?? null,
            customerPhone: parsed.data.customerPhone ?? null,
          })
          .returning();

        // booking 連動：標 paymentStatus = refunded
        if (parsed.data.bookingId && status === "completed") {
          await db
            .update(bookings)
            .set({ paymentStatus: "refunded", updatedAt: now })
            .where(eq(bookings.id, parsed.data.bookingId));
        }

        // audit
        logAuditAction({
          actorAdminId: req.admin.id,
          action: "refund:create",
          targetType: "refund",
          targetId: String(created.id),
          fieldId: sourceFieldId,
          metadata: {
            sourceType: parsed.data.sourceType,
            sourceId: parsed.data.sourceId,
            amountCents: parsed.data.amountCents,
            refundMethod: parsed.data.refundMethod,
            status,
            reason: parsed.data.reason,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.status(201).json({ refund: created });
      } catch (err) {
        console.error("[admin-refunds] create failed:", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // GET /api/admin/refunds/lookup-tx?id=xxx — 查 pos_transaction 給退款表單預填
  app.get(
    "/api/admin/refunds/lookup-tx",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });
        const id = String(req.query.id ?? "");
        if (!id) return res.status(400).json({ error: "missing_id" });

        const [tx] = await db
          .select()
          .from(posTransactions)
          .where(eq(posTransactions.id, id))
          .limit(1);
        if (!tx) return res.status(404).json({ error: "transaction_not_found" });

        // 場域權限
        const isSuper = req.admin.systemRole === "super_admin";
        const scope = req.admin.fieldId ? await resolveFieldScope(req.admin.fieldId) : null;
        if (!isSuper && (!scope || !scope.identifiers.includes(tx.fieldId))) {
          return res.status(403).json({ error: "wrong_field" });
        }

        // 已退累計
        const previousRefunds = await db
          .select({ total: sql<number>`COALESCE(SUM(${refunds.amountCents}), 0)::int` })
          .from(refunds)
          .where(
            and(
              eq(refunds.sourceType, "pos_transaction"),
              eq(refunds.sourceId, id),
              inArray(refunds.status, ["pending", "completed"]),
            ),
          );
        const refunded = previousRefunds[0]?.total ?? 0;

        res.json({
          transaction: tx,
          refunded,
          remaining: (tx.paidAmountCents ?? 0) - refunded,
        });
      } catch (err) {
        console.error("[admin-refunds] lookup failed:", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );
}
