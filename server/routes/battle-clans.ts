// 水彈對戰 PK 擂台 — 戰隊路由
import type { Express } from "express";
import { isAuthenticated } from "../firebaseAuth";
import { battleStorageMethods } from "../storage/battle-storage";
import type { AuthenticatedRequest } from "./types";
import {
  insertBattleClanSchema,
  updateBattleClanSchema,
  clanRoleEnum,
} from "@shared/schema";

/** 組合顯示名稱 */
function buildDisplayName(firstName: string | null, lastName: string | null, odId: string): string {
  if (firstName || lastName) return [lastName, firstName].filter(Boolean).join("");
  return `玩家${odId.slice(0, 6)}`;
}

export function registerBattleClanRoutes(app: Express) {
  // ============================================================================
  // GET /api/battle/clans — 場域戰隊列表
  // ============================================================================
  app.get("/api/battle/clans", async (req, res) => {
    try {
      const fieldId = req.query.fieldId as string;
      if (!fieldId) {
        return res.status(400).json({ error: "缺少 fieldId 參數" });
      }
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const clans = await battleStorageMethods.getClansByField(fieldId, limit);
      res.json(clans);
    } catch {
      res.status(500).json({ error: "取得戰隊列表失敗" });
    }
  });

  // ============================================================================
  // GET /api/battle/clans/:id — 戰隊詳情（含成員）
  // ============================================================================
  app.get("/api/battle/clans/:id", async (req, res) => {
    try {
      const clan = await battleStorageMethods.getClan(req.params.id);
      if (!clan) {
        return res.status(404).json({ error: "戰隊不存在" });
      }
      const members = await battleStorageMethods.getClanMembers(clan.id);
      res.json({ ...clan, members });
    } catch {
      res.status(500).json({ error: "取得戰隊詳情失敗" });
    }
  });

  // ============================================================================
  // GET /api/battle/my/clan — 我的戰隊
  // ============================================================================
  app.get(
    "/api/battle/my/clan",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) return res.status(401).json({ error: "未認證" });

        const fieldId = req.query.fieldId as string;
        if (!fieldId) {
          return res.status(400).json({ error: "缺少 fieldId 參數" });
        }

        const result = await battleStorageMethods.getUserClan(req.user.dbUser.id, fieldId);
        if (!result) {
          return res.json(null);
        }

        const members = await battleStorageMethods.getClanMembers(result.clan.id);
        res.json({ ...result.clan, myRole: result.membership.role, members });
      } catch {
        res.status(500).json({ error: "取得我的戰隊失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/battle/clans — 建立戰隊
  // ============================================================================
  app.post(
    "/api/battle/clans",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) return res.status(401).json({ error: "未認證" });

        const fieldId = req.query.fieldId as string;
        if (!fieldId) {
          return res.status(400).json({ error: "缺少 fieldId 參數" });
        }

        // 檢查是否已有戰隊
        const existing = await battleStorageMethods.getUserClan(req.user.dbUser.id, fieldId);
        if (existing) {
          return res.status(409).json({ error: "你已經有戰隊了，請先離開現有戰隊" });
        }

        const parsed = insertBattleClanSchema.safeParse(req.body);
        if (!parsed.success) {
          const firstError = parsed.error.errors[0];
          return res.status(400).json({ error: `欄位驗證失敗：${firstError?.path.join(".")} ${firstError?.message}` });
        }

        // 使用事務確保建立戰隊 + 加入隊長的原子性
        const clan = await battleStorageMethods.createClanWithLeader({
          ...parsed.data,
          fieldId,
          leaderId: req.user.dbUser.id,
        });

        res.status(201).json(clan);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes("uq_battle_clan_field_name")) {
            return res.status(409).json({ error: "此場域已有同名戰隊" });
          }
          if (error.message.includes("uq_battle_clan_field_tag")) {
            return res.status(409).json({ error: "此場域已有相同標籤的戰隊" });
          }
          if (error.message.includes("battle_clans_field_id_fields_id_fk")) {
            return res.status(400).json({ error: "無效的場域 ID" });
          }
        }
        res.status(500).json({ error: "建立戰隊失敗" });
      }
    },
  );

  // ============================================================================
  // PATCH /api/battle/clans/:id — 更新戰隊（隊長/幹部限定）
  // ============================================================================
  app.patch(
    "/api/battle/clans/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) return res.status(401).json({ error: "未認證" });

        const clan = await battleStorageMethods.getClan(req.params.id);
        if (!clan) return res.status(404).json({ error: "戰隊不存在" });

        // 檢查權限（隊長或幹部）
        const userClan = await battleStorageMethods.getUserClan(req.user.dbUser.id, clan.fieldId);
        if (!userClan || userClan.clan.id !== clan.id) {
          return res.status(403).json({ error: "你不是此戰隊成員" });
        }
        if (userClan.membership.role === "member") {
          return res.status(403).json({ error: "只有隊長或幹部可以修改戰隊資訊" });
        }

        const parsed = updateBattleClanSchema.parse(req.body);
        const updated = await battleStorageMethods.updateClan(clan.id, parsed);
        res.json(updated);
      } catch {
        res.status(500).json({ error: "更新戰隊失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/battle/clans/:id/join — 加入戰隊
  // ============================================================================
  app.post(
    "/api/battle/clans/:id/join",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) return res.status(401).json({ error: "未認證" });

        const clan = await battleStorageMethods.getClan(req.params.id);
        if (!clan) return res.status(404).json({ error: "戰隊不存在" });
        if (!clan.isActive) return res.status(400).json({ error: "戰隊已停用" });

        // 檢查是否已有戰隊
        const existing = await battleStorageMethods.getUserClan(req.user.dbUser.id, clan.fieldId);
        if (existing) {
          return res.status(409).json({ error: "你已經有戰隊了，請先離開現有戰隊" });
        }

        // 檢查人數上限
        if (clan.memberCount >= clan.maxMembers) {
          return res.status(400).json({ error: "戰隊人數已滿" });
        }

        const member = await battleStorageMethods.addClanMember({
          clanId: clan.id,
          userId: req.user.dbUser.id,
          role: "member",
        });

        res.status(201).json(member);
      } catch (error) {
        if (error instanceof Error && error.message.includes("uq_battle_clan_member")) {
          return res.status(409).json({ error: "你已經是此戰隊成員" });
        }
        res.status(500).json({ error: "加入戰隊失敗" });
      }
    },
  );

  // ============================================================================
  // DELETE /api/battle/clans/:id/leave — 離開戰隊
  // ============================================================================
  app.delete(
    "/api/battle/clans/:id/leave",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) return res.status(401).json({ error: "未認證" });

        const clan = await battleStorageMethods.getClan(req.params.id);
        if (!clan) return res.status(404).json({ error: "戰隊不存在" });

        // 隊長不能直接離開，必須先轉讓
        if (clan.leaderId === req.user.dbUser.id) {
          return res.status(400).json({ error: "隊長不能直接離開，請先轉讓隊長給其他成員" });
        }

        await battleStorageMethods.removeClanMember(clan.id, req.user.dbUser.id);
        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "離開戰隊失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/battle/clans/:id/transfer — 轉讓隊長
  // ============================================================================
  app.post(
    "/api/battle/clans/:id/transfer",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) return res.status(401).json({ error: "未認證" });

        const clan = await battleStorageMethods.getClan(req.params.id);
        if (!clan) return res.status(404).json({ error: "戰隊不存在" });

        // 只有隊長能轉讓
        if (clan.leaderId !== req.user.dbUser.id) {
          return res.status(403).json({ error: "只有隊長可以轉讓" });
        }

        const { newLeaderId } = req.body as { newLeaderId?: string };
        if (!newLeaderId) {
          return res.status(400).json({ error: "缺少 newLeaderId" });
        }

        // 確認新隊長是戰隊成員
        const members = await battleStorageMethods.getClanMembers(clan.id);
        const newLeader = members.find((m) => m.userId === newLeaderId);
        if (!newLeader) {
          return res.status(400).json({ error: "目標使用者不是戰隊成員" });
        }

        // 更新角色
        await battleStorageMethods.updateClanMemberRole(clan.id, req.user.dbUser.id, "member");
        await battleStorageMethods.updateClanMemberRole(clan.id, newLeaderId, "leader");
        await battleStorageMethods.updateClan(clan.id, { leaderId: newLeaderId });

        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "轉讓隊長失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/battle/clans/:id/role — 設定成員角色（隊長限定）
  // ============================================================================
  app.post(
    "/api/battle/clans/:id/role",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) return res.status(401).json({ error: "未認證" });

        const clan = await battleStorageMethods.getClan(req.params.id);
        if (!clan) return res.status(404).json({ error: "戰隊不存在" });

        if (clan.leaderId !== req.user.dbUser.id) {
          return res.status(403).json({ error: "只有隊長可以變更角色" });
        }

        const { userId, role } = req.body as { userId?: string; role?: string };
        if (!userId || !role) {
          return res.status(400).json({ error: "缺少 userId 或 role" });
        }
        if (!clanRoleEnum.includes(role as typeof clanRoleEnum[number])) {
          return res.status(400).json({ error: "無效角色" });
        }
        if (role === "leader") {
          return res.status(400).json({ error: "請使用轉讓功能指定新隊長" });
        }

        const updated = await battleStorageMethods.updateClanMemberRole(clan.id, userId, role);
        if (!updated) {
          return res.status(404).json({ error: "使用者不是戰隊成員" });
        }

        res.json(updated);
      } catch {
        res.status(500).json({ error: "變更角色失敗" });
      }
    },
  );
}
