// 🎫 場域會員 API 路由
// 玩家端：/api/me/memberships — 查自己的所有場域會員身份
// 管理員端：/api/admin/memberships/* — 場域內的成員管理（嚴格隔離）
import type { Express } from "express";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest } from "./types";
import {
  getMembershipsForUser,
  listFieldMembers,
  getMembership,
  ensureMembership,
  grantAdmin,
  revokeAdmin,
  suspendPlayer,
} from "../services/field-memberships";
import { z } from "zod";

export function registerFieldMembershipRoutes(app: Express) {
  // ============================================================================
  // 玩家端：查自己的場域會員身份
  // ============================================================================
  app.get(
    "/api/me/memberships",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      if (!req.user) return res.status(401).json({ error: "未認證" });
      const memberships = await getMembershipsForUser(req.user.dbUser.id);
      res.json({ memberships });
    }
  );

  // ============================================================================
  // 玩家端：進入場域（自動加入，冪等）
  // 呼叫時機：玩家掃 QR 進入 /g/:slug 或場域首頁時自動觸發
  // ============================================================================
  app.post(
    "/api/me/memberships/join",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      if (!req.user) return res.status(401).json({ error: "未認證" });
      const { fieldId } = req.body as { fieldId?: string };
      if (!fieldId) return res.status(400).json({ error: "需指定 fieldId" });

      const membership = await ensureMembership(req.user.dbUser.id, fieldId);
      if (membership.playerStatus !== "active") {
        return res.status(403).json({
          error: "該場域已暫停您的參與權限",
          status: membership.playerStatus,
        });
      }
      res.json({ membership });
    }
  );

  // ============================================================================
  // 管理員端：列出本場域所有成員（自動限定 fieldId）
  // ============================================================================
  app.get(
    "/api/admin/memberships",
    requireAdminAuth,
    requirePermission("user:view"),
    async (req, res) => {
      if (!req.admin) return res.status(401).json({ error: "未認證" });

      // 🔒 super_admin 可透過 query 指定場域，其他人強制自己的 fieldId
      const fieldId =
        req.admin.systemRole === "super_admin"
          ? (req.query.fieldId as string) || req.admin.fieldId
          : req.admin.fieldId;

      const isAdminFilter =
        req.query.isAdmin === "true"
          ? true
          : req.query.isAdmin === "false"
            ? false
            : undefined;

      const members = await listFieldMembers(fieldId, {
        isAdmin: isAdminFilter,
      });
      res.json({ members });
    }
  );

  // ============================================================================
  // 管理員端：授權指定玩家為管理員
  // ============================================================================
  const grantSchema = z.object({
    userId: z.string().min(1),
    roleId: z.string().min(1),
  });

  app.post(
    "/api/admin/memberships/grant",
    requireAdminAuth,
    requirePermission("admin:manage_accounts"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });
        const parsed = grantSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "格式錯誤", details: parsed.error.errors });
        }

        const fieldId = req.admin.fieldId;
        const result = await grantAdmin(
          parsed.data.userId,
          fieldId,
          parsed.data.roleId,
          req.admin.accountId
        );
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        await logAuditAction({
          actorAdminId: req.admin.id,
          action: "membership:grant_admin",
          targetType: "user",
          targetId: parsed.data.userId,
          fieldId,
          metadata: { roleId: parsed.data.roleId },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({ success: true });
      } catch (err) {
        console.error("[grant] 授權失敗:", err);
        res.status(500).json({
          error: err instanceof Error ? err.message : "授權失敗",
        });
      }
    }
  );

  // ============================================================================
  // 管理員端：撤銷管理員授權（開關 OFF）— 立即失效 JWT
  // ============================================================================
  app.post(
    "/api/admin/memberships/revoke",
    requireAdminAuth,
    requirePermission("admin:manage_accounts"),
    async (req, res) => {
      if (!req.admin) return res.status(401).json({ error: "未認證" });
      const { userId } = req.body as { userId?: string };
      if (!userId) return res.status(400).json({ error: "需指定 userId" });

      const fieldId = req.admin.fieldId;

      // 🛡️ 防呆：不可撤銷自己（避免鎖自己出局）
      if (userId === req.admin.accountId) {
        return res.status(400).json({ error: "不能撤銷自己的管理權限" });
      }

      const result = await revokeAdmin(userId, fieldId, req.admin.accountId);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "membership:revoke_admin",
        targetType: "user",
        targetId: userId,
        fieldId,
        metadata: { revokedSessions: result.revokedSessions },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ success: true, revokedSessions: result.revokedSessions });
    }
  );

  // ============================================================================
  // 管理員端：暫停/解除暫停玩家
  // ============================================================================
  const suspendSchema = z.object({
    userId: z.string().min(1),
    status: z.enum(["active", "suspended", "banned"]),
    reason: z.string().max(500).optional(),
  });

  app.post(
    "/api/admin/memberships/suspend",
    requireAdminAuth,
    requirePermission("user:manage"),
    async (req, res) => {
      if (!req.admin) return res.status(401).json({ error: "未認證" });
      const parsed = suspendSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "格式錯誤" });

      // 暫停/停權時強制要求理由
      if (
        (parsed.data.status === "suspended" || parsed.data.status === "banned") &&
        !parsed.data.reason?.trim()
      ) {
        return res.status(400).json({ error: "暫停/停權時必須填寫理由" });
      }

      const result = await suspendPlayer(
        parsed.data.userId,
        req.admin.fieldId,
        parsed.data.status,
        parsed.data.reason
      );
      if (!result.success) return res.status(400).json({ error: result.error });

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "membership:suspend",
        targetType: "user",
        targetId: parsed.data.userId,
        fieldId: req.admin.fieldId,
        metadata: { status: parsed.data.status, reason: parsed.data.reason },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ success: true });
    }
  );
}
