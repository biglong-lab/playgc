// 🎫 客服工單 API（P0-2）
// platform-level：跨場域看所有工單、分派、處理
import type { Express } from "express";
import { db } from "../db";
import {
  supportTickets,
  supportTicketMessages,
  fields,
  adminAccounts,
  publicCreateTicketSchema,
  ticketStatusEnum,
  ticketPriorityEnum,
  ticketCategoryEnum,
} from "@shared/schema";
import { requirePlatformAdmin } from "../platformAuth";
import { logAuditAction } from "../adminAuth";
import { eq, sql, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";

export function registerPlatformTicketRoutes(app: Express): void {
  // ============================================================================
  // GET /api/platform/tickets — 列出工單
  // Query: status, category, priority, fieldId, assignedAdminId, q（搜尋）, limit
  // ============================================================================
  app.get("/api/platform/tickets", requirePlatformAdmin, async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : null;
      const category = typeof req.query.category === "string" ? req.query.category : null;
      const priority = typeof req.query.priority === "string" ? req.query.priority : null;
      const fieldId = typeof req.query.fieldId === "string" ? req.query.fieldId : null;
      const assignedAdminId = typeof req.query.assignedAdminId === "string" ? req.query.assignedAdminId : null;
      const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);

      const conditions = [];
      if (status) conditions.push(eq(supportTickets.status, status));
      if (category) conditions.push(eq(supportTickets.category, category));
      if (priority) conditions.push(eq(supportTickets.priority, priority));
      if (fieldId) conditions.push(eq(supportTickets.fieldId, fieldId));
      if (assignedAdminId) conditions.push(eq(supportTickets.assignedAdminId, assignedAdminId));

      const tickets = await db.query.supportTickets.findMany({
        where: conditions.length ? and(...conditions) : undefined,
        orderBy: [desc(supportTickets.createdAt)],
        limit,
      });

      // join fields + assigned admins
      const fieldIds = Array.from(new Set(tickets.map((t) => t.fieldId).filter(Boolean) as string[]));
      const adminIds = Array.from(new Set(tickets.map((t) => t.assignedAdminId).filter(Boolean) as string[]));

      const [fieldList, adminList] = await Promise.all([
        fieldIds.length
          ? db.query.fields.findMany({
              where: inArray(fields.id, fieldIds),
              columns: { id: true, name: true, code: true },
            })
          : Promise.resolve([]),
        adminIds.length
          ? db.query.adminAccounts.findMany({
              where: inArray(adminAccounts.id, adminIds),
              columns: { id: true, username: true, displayName: true },
            })
          : Promise.resolve([]),
      ]);

      const fieldMap = new Map(fieldList.map((f) => [f.id, f]));
      const adminMap = new Map(adminList.map((a) => [a.id, a]));

      const enriched = tickets.map((t) => ({
        ...t,
        field: t.fieldId ? fieldMap.get(t.fieldId) ?? null : null,
        assignedAdmin: t.assignedAdminId ? adminMap.get(t.assignedAdminId) ?? null : null,
      }));

      res.json({ items: enriched, total: enriched.length });
    } catch (error) {
      console.error("[platform/tickets] list failed:", error);
      res.status(500).json({ message: "取得工單列表失敗" });
    }
  });

  // ============================================================================
  // GET /api/platform/tickets/stats — 工單統計
  // ============================================================================
  app.get("/api/platform/tickets/stats", requirePlatformAdmin, async (_req, res) => {
    try {
      const result = await db.execute<{
        status: string;
        priority: string;
        category: string;
        count: number;
      }>(sql`
        SELECT status, priority, category, COUNT(*)::int AS count
        FROM support_tickets
        GROUP BY ROLLUP (status, priority, category)
      `);

      // 簡化：分別算 status / priority / category 的計數
      const stats = {
        byStatus: {} as Record<string, number>,
        byPriority: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
        total: 0,
        openCount: 0,
        urgentCount: 0,
      };

      const rawTickets = await db.query.supportTickets.findMany({
        columns: { status: true, priority: true, category: true },
      });
      stats.total = rawTickets.length;
      rawTickets.forEach((t) => {
        stats.byStatus[t.status] = (stats.byStatus[t.status] || 0) + 1;
        stats.byPriority[t.priority] = (stats.byPriority[t.priority] || 0) + 1;
        stats.byCategory[t.category] = (stats.byCategory[t.category] || 0) + 1;
        if (t.status === "open") stats.openCount++;
        if (t.priority === "urgent") stats.urgentCount++;
      });

      res.json(stats);
    } catch (error) {
      console.error("[platform/tickets/stats] failed:", error);
      res.status(500).json({ message: "取得統計失敗" });
    }
  });

  // ============================================================================
  // GET /api/platform/tickets/:id — 工單詳情 + 留言列表
  // ============================================================================
  app.get("/api/platform/tickets/:id", requirePlatformAdmin, async (req, res) => {
    try {
      const ticket = await db.query.supportTickets.findFirst({
        where: eq(supportTickets.id, req.params.id),
      });
      if (!ticket) return res.status(404).json({ message: "工單不存在" });

      // 留言列表
      const messages = await db.query.supportTicketMessages.findMany({
        where: eq(supportTicketMessages.ticketId, ticket.id),
        orderBy: [supportTicketMessages.createdAt],
      });

      // join 留言作者 admin
      const adminIds = Array.from(new Set(messages.map((m) => m.authorAdminId).filter(Boolean) as string[]));
      const adminList = adminIds.length
        ? await db.query.adminAccounts.findMany({
            where: inArray(adminAccounts.id, adminIds),
            columns: { id: true, username: true, displayName: true },
          })
        : [];
      const adminMap = new Map(adminList.map((a) => [a.id, a]));

      // join 場域
      const field = ticket.fieldId
        ? await db.query.fields.findFirst({
            where: eq(fields.id, ticket.fieldId),
            columns: { id: true, name: true, code: true },
          })
        : null;

      res.json({
        ticket: { ...ticket, field },
        messages: messages.map((m) => ({
          ...m,
          author: m.authorAdminId ? adminMap.get(m.authorAdminId) ?? null : null,
        })),
      });
    } catch (error) {
      console.error("[platform/tickets] detail failed:", error);
      res.status(500).json({ message: "取得工單詳情失敗" });
    }
  });

  // ============================================================================
  // POST /api/platform/tickets — 新增工單（platform admin 主動建立）
  // ============================================================================
  app.post("/api/platform/tickets", requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = publicCreateTicketSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "資料格式錯誤",
          errors: parsed.error.errors,
        });
      }

      const [created] = await db
        .insert(supportTickets)
        .values({
          ...parsed.data,
          submittedIp: req.ip,
          referrer: req.headers["referer"] ?? null,
        })
        .returning();

      await logAuditAction({
        actorAdminId: req.platform?.adminAccountId ?? undefined,
        action: "platform:ticket_create",
        targetType: "support_ticket",
        targetId: created.id,
        fieldId: created.fieldId ?? undefined,
        metadata: {
          category: created.category,
          priority: created.priority,
          title: created.title,
          actorRole: req.platform?.role,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(created);
    } catch (error) {
      console.error("[platform/tickets] create failed:", error);
      res.status(500).json({ message: "建立工單失敗" });
    }
  });

  // ============================================================================
  // PATCH /api/platform/tickets/:id — 更新工單（status / priority / assigned / resolution）
  // ============================================================================
  const patchTicketSchema = z.object({
    status: z.enum(ticketStatusEnum).optional(),
    priority: z.enum(ticketPriorityEnum).optional(),
    category: z.enum(ticketCategoryEnum).optional(),
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(5000).optional(),
    assignedAdminId: z.string().uuid().nullable().optional(),
    resolutionNote: z.string().max(5000).optional(),
  });

  app.patch("/api/platform/tickets/:id", requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = patchTicketSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.errors });
      }

      const existing = await db.query.supportTickets.findFirst({
        where: eq(supportTickets.id, req.params.id),
      });
      if (!existing) return res.status(404).json({ message: "工單不存在" });

      // 若 status 變 resolved → 自動填寫 resolvedAt + resolvedByAdminId
      const updateData: Record<string, unknown> = {
        ...parsed.data,
        updatedAt: new Date(),
      };
      if (
        parsed.data.status &&
        parsed.data.status === "resolved" &&
        existing.status !== "resolved"
      ) {
        updateData.resolvedAt = new Date();
        updateData.resolvedByAdminId = req.platform?.adminAccountId ?? null;
      }

      const [updated] = await db
        .update(supportTickets)
        .set(updateData)
        .where(eq(supportTickets.id, req.params.id))
        .returning();

      await logAuditAction({
        actorAdminId: req.platform?.adminAccountId ?? undefined,
        action: "platform:ticket_update",
        targetType: "support_ticket",
        targetId: updated.id,
        fieldId: updated.fieldId ?? undefined,
        metadata: {
          changes: parsed.data,
          oldStatus: existing.status,
          oldPriority: existing.priority,
          oldAssignedAdminId: existing.assignedAdminId,
          actorRole: req.platform?.role,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updated);
    } catch (error) {
      console.error("[platform/tickets] patch failed:", error);
      res.status(500).json({ message: "更新工單失敗" });
    }
  });

  // ============================================================================
  // POST /api/platform/tickets/:id/messages — 加留言
  // ============================================================================
  const addMessageSchema = z.object({
    body: z.string().min(1, "留言不能為空").max(5000),
    internal: z.boolean().optional(),
  });

  app.post("/api/platform/tickets/:id/messages", requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = addMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤" });
      }

      const ticket = await db.query.supportTickets.findFirst({
        where: eq(supportTickets.id, req.params.id),
      });
      if (!ticket) return res.status(404).json({ message: "工單不存在" });

      const [message] = await db
        .insert(supportTicketMessages)
        .values({
          ticketId: ticket.id,
          body: parsed.data.body,
          authorAdminId: req.platform?.adminAccountId ?? null,
          authorIsSubmitter: "no",
          internal: parsed.data.internal ? "yes" : "no",
        })
        .returning();

      // 留言後自動把 ticket updatedAt 推進（保持列表排序）
      await db
        .update(supportTickets)
        .set({ updatedAt: new Date() })
        .where(eq(supportTickets.id, ticket.id));

      await logAuditAction({
        actorAdminId: req.platform?.adminAccountId ?? undefined,
        action: "platform:ticket_message",
        targetType: "support_ticket",
        targetId: ticket.id,
        fieldId: ticket.fieldId ?? undefined,
        metadata: {
          messageId: message.id,
          internal: parsed.data.internal,
          length: parsed.data.body.length,
          actorRole: req.platform?.role,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(message);
    } catch (error) {
      console.error("[platform/tickets/messages] failed:", error);
      res.status(500).json({ message: "新增留言失敗" });
    }
  });
}
