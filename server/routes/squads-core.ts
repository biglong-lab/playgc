// Squad 主表 CRUD — Phase 14.1
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §18 §20.1 §20.2
//
// 端點：
//   POST   /api/squads                   — 建立新 Squad（含名稱檢查 + 鎖名查詢）
//   GET    /api/squads/:id               — 取得 Squad 詳情（公開）
//   PATCH  /api/squads/:id                — 更新 Squad（隊長 / officer）含改名冷卻
//   DELETE /api/squads/:id               — 隊長解散（180 天鎖名）
//   POST   /api/squads/:id/members       — 加成員（隊長邀請或玩家自加）
//   DELETE /api/squads/:id/members/:uid  — 移除成員（離開 / 踢出）
//   PATCH  /api/squads/:id/members/:uid  — 改成員角色（隊長轉讓）
//   GET    /api/me/squads                — 我所屬的所有 Squad
//
import type { Express } from "express";
import { db } from "../db";
import {
  squads,
  squadMembers,
  squadStats,
  squadNameLocks,
} from "@shared/schema";
import { eq, and, desc, isNull, gt, sql } from "drizzle-orm";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest } from "./types";
import { z } from "zod";
import {
  validateSquadName,
  checkRenameCooldown,
  computeDissolveLockUntil,
} from "../services/squad-rename";

const createSquadSchema = z.object({
  name: z.string().min(2).max(50),
  tag: z.string().min(1).max(10).regex(/^[A-Za-z0-9\u4e00-\u9fff]+$/, "標籤只能包含字母、數字、中文"),
  description: z.string().max(500).optional(),
  emblemUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  homeFieldId: z.string().optional(),
});

const updateSquadSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  tag: z.string().min(1).max(10).optional(),
  description: z.string().max(500).nullable().optional(),
  emblemUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  isPublic: z.boolean().optional(),
});

const addMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(["leader", "officer", "member"]).default("member"),
  joinSource: z.enum(["self", "invite", "admin"]).default("self"),
  inviteId: z.string().optional(),
});

const updateMemberSchema = z.object({
  role: z.enum(["leader", "officer", "member"]),
});

export function registerSquadsCoreRoutes(app: Express) {
  // ============================================================================
  // POST /api/squads — 建立 Squad
  // ============================================================================
  app.post(
    "/api/squads",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const parsed = createSquadSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "驗證失敗" });
        }

        // 名稱合法性檢查（系統保留字）
        const nameCheck = validateSquadName(parsed.data.name);
        if (!nameCheck.valid) {
          return res.status(400).json({ error: nameCheck.reason });
        }

        // 解散後鎖名查詢（180 天內）
        const [lock] = await db
          .select()
          .from(squadNameLocks)
          .where(
            and(
              eq(squadNameLocks.name, parsed.data.name),
              gt(squadNameLocks.lockedUntil, new Date()),
            ),
          )
          .limit(1);
        if (lock) {
          return res.status(409).json({
            error: `此隊名於 ${lock.lockedUntil.toISOString().slice(0, 10)} 前不可使用（曾解散）`,
          });
        }

        // 建立 squad
        const [created] = await db
          .insert(squads)
          .values({
            name: parsed.data.name,
            tag: parsed.data.tag,
            description: parsed.data.description,
            emblemUrl: parsed.data.emblemUrl,
            primaryColor: parsed.data.primaryColor,
            leaderId: userId,
            homeFieldId: parsed.data.homeFieldId,
          })
          .returning();

        // 隊長自動成為成員
        await db.insert(squadMembers).values({
          squadId: created.id,
          userId,
          role: "leader",
        });

        // 自動建立 squadStats
        await db.insert(squadStats).values({
          squadId: created.id,
          squadType: "squad",
          firstActiveAt: new Date(),
        });

        res.status(201).json(created);
      } catch (err: any) {
        if (err.message?.includes("uq_squad_name")) {
          return res.status(409).json({ error: "隊名已被使用" });
        }
        if (err.message?.includes("uq_squad_tag")) {
          return res.status(409).json({ error: "Tag 已被使用" });
        }
        console.error("[squads] POST 失敗:", err);
        res.status(500).json({ error: "建立 Squad 失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/squads/:id — 取 Squad 詳情（公開）
  // ============================================================================
  app.get("/api/squads/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const [squad] = await db.select().from(squads).where(eq(squads.id, id));
      if (!squad) return res.status(404).json({ error: "Squad 不存在" });

      // 取成員
      const members = await db
        .select()
        .from(squadMembers)
        .where(and(eq(squadMembers.squadId, id), isNull(squadMembers.leftAt)))
        .orderBy(squadMembers.joinedAt);

      // 取 stats
      const [stats] = await db
        .select()
        .from(squadStats)
        .where(eq(squadStats.squadId, id));

      // 私隊只回基本資料（不曝光成員清單）
      if (!squad.isPublic) {
        return res.json({
          squad,
          memberCount: members.length,
          stats: stats ?? null,
        });
      }

      res.json({ squad, members, stats: stats ?? null });
    } catch (err) {
      console.error("[squads] GET 失敗:", err);
      res.status(500).json({ error: "取得 Squad 失敗" });
    }
  });

  // ============================================================================
  // PATCH /api/squads/:id — 更新 Squad（隊長 / officer 限定 + 改名冷卻）
  // ============================================================================
  app.patch(
    "/api/squads/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const id = req.params.id;
        const [squad] = await db.select().from(squads).where(eq(squads.id, id));
        if (!squad) return res.status(404).json({ error: "Squad 不存在" });
        if (squad.status === "dissolved") {
          return res.status(409).json({ error: "Squad 已解散" });
        }

        // 權限：隊長 / officer
        const [member] = await db
          .select()
          .from(squadMembers)
          .where(
            and(
              eq(squadMembers.squadId, id),
              eq(squadMembers.userId, userId),
              isNull(squadMembers.leftAt),
            ),
          );
        if (!member || (member.role !== "leader" && member.role !== "officer")) {
          return res.status(403).json({ error: "只有隊長或 officer 可修改" });
        }

        const parsed = updateSquadSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "驗證失敗" });
        }

        // 改名冷卻
        const willChangeName = parsed.data.name && parsed.data.name !== squad.name;
        const willChangeTag = parsed.data.tag && parsed.data.tag !== squad.tag;
        if (willChangeName || willChangeTag) {
          if (willChangeName) {
            const nameCheck = validateSquadName(parsed.data.name!);
            if (!nameCheck.valid) {
              return res.status(400).json({ error: nameCheck.reason });
            }
          }

          const cooldown = checkRenameCooldown({
            createdAt: squad.createdAt,
            nameChangedAt: squad.nameChangedAt,
          });
          if (!cooldown.allowed) {
            return res.status(429).json({
              error: cooldown.reason,
              nextAvailableAt: cooldown.nextAvailableAt?.toISOString(),
            });
          }
        }

        // 執行更新
        const updateValue: Record<string, unknown> = {
          ...parsed.data,
          updatedAt: new Date(),
        };
        if (willChangeName || willChangeTag) {
          updateValue.nameChangedAt = new Date();
        }
        const [updated] = await db
          .update(squads)
          .set(updateValue)
          .where(eq(squads.id, id))
          .returning();

        // 寫改名歷史
        if (willChangeName || willChangeTag) {
          try {
            const { squadNameHistory } = await import("@shared/schema");
            await db.insert(squadNameHistory).values({
              squadId: id,
              oldName: squad.name,
              newName: parsed.data.name ?? squad.name,
              oldTag: squad.tag,
              newTag: parsed.data.tag ?? squad.tag,
              changedByUserId: userId,
            });
          } catch (e) {
            console.warn("[squads] 寫改名歷史失敗:", e);
          }
        }

        res.json(updated);
      } catch (err: any) {
        if (err.message?.includes("uq_squad_name")) {
          return res.status(409).json({ error: "隊名已被使用" });
        }
        if (err.message?.includes("uq_squad_tag")) {
          return res.status(409).json({ error: "Tag 已被使用" });
        }
        console.error("[squads] PATCH 失敗:", err);
        res.status(500).json({ error: "更新 Squad 失敗" });
      }
    },
  );

  // ============================================================================
  // DELETE /api/squads/:id — 隊長解散（180 天鎖名）
  // ============================================================================
  app.delete(
    "/api/squads/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const id = req.params.id;
        const [squad] = await db.select().from(squads).where(eq(squads.id, id));
        if (!squad) return res.status(404).json({ error: "Squad 不存在" });
        if (squad.status === "dissolved") {
          return res.status(409).json({ error: "Squad 已解散" });
        }
        if (squad.leaderId !== userId) {
          return res.status(403).json({ error: "只有隊長可解散" });
        }

        const lockUntil = computeDissolveLockUntil();

        // 1. 標記解散
        await db
          .update(squads)
          .set({
            status: "dissolved",
            dissolvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(squads.id, id));

        // 2. 鎖隊名 180 天
        await db.insert(squadNameLocks).values({
          name: squad.name,
          tag: squad.tag,
          fieldId: squad.homeFieldId,
          lockedUntil: lockUntil,
          reason: "dissolved",
          originalSquadId: id,
        });

        // 3. 所有成員 soft-delete
        await db
          .update(squadMembers)
          .set({ leftAt: new Date() })
          .where(
            and(eq(squadMembers.squadId, id), isNull(squadMembers.leftAt)),
          );

        res.json({
          success: true,
          dissolvedAt: new Date().toISOString(),
          nameLockedUntil: lockUntil.toISOString(),
          message: `Squad「${squad.name}」已解散，隊名鎖定至 ${lockUntil.toISOString().slice(0, 10)}`,
        });
      } catch (err) {
        console.error("[squads] DELETE 失敗:", err);
        res.status(500).json({ error: "解散失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/squads/:id/members — 加成員
  // ============================================================================
  app.post(
    "/api/squads/:id/members",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const callerId = req.user?.claims?.sub;
        if (!callerId) return res.status(401).json({ error: "Unauthorized" });

        const squadId = req.params.id;
        const parsed = addMemberSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "驗證失敗" });
        }

        const [squad] = await db.select().from(squads).where(eq(squads.id, squadId));
        if (!squad) return res.status(404).json({ error: "Squad 不存在" });
        if (squad.status === "dissolved") {
          return res.status(409).json({ error: "Squad 已解散" });
        }

        // 權限：自己加 / 隊長邀請（self 或 caller is leader/officer）
        const isSelfJoin =
          parsed.data.joinSource === "self" && parsed.data.userId === callerId;
        if (!isSelfJoin) {
          const [callerMember] = await db
            .select()
            .from(squadMembers)
            .where(
              and(
                eq(squadMembers.squadId, squadId),
                eq(squadMembers.userId, callerId),
                isNull(squadMembers.leftAt),
              ),
            );
          if (
            !callerMember ||
            (callerMember.role !== "leader" && callerMember.role !== "officer")
          ) {
            return res.status(403).json({ error: "只有隊長或 officer 可加成員" });
          }
        }

        // 防重複（同 user 還沒離開）
        const [existing] = await db
          .select()
          .from(squadMembers)
          .where(
            and(
              eq(squadMembers.squadId, squadId),
              eq(squadMembers.userId, parsed.data.userId),
              isNull(squadMembers.leftAt),
            ),
          );
        if (existing) {
          return res.status(409).json({ error: "玩家已是隊伍成員" });
        }

        const [created] = await db
          .insert(squadMembers)
          .values({
            squadId,
            userId: parsed.data.userId,
            role: parsed.data.role,
            joinSource: parsed.data.joinSource,
            inviteId: parsed.data.inviteId,
          })
          .returning();

        res.status(201).json(created);
      } catch (err) {
        console.error("[squads] POST member 失敗:", err);
        res.status(500).json({ error: "加成員失敗" });
      }
    },
  );

  // ============================================================================
  // DELETE /api/squads/:id/members/:userId — 離開 / 踢出
  // ============================================================================
  app.delete(
    "/api/squads/:id/members/:userId",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const callerId = req.user?.claims?.sub;
        if (!callerId) return res.status(401).json({ error: "Unauthorized" });

        const squadId = req.params.id;
        const targetUserId = req.params.userId;

        const [squad] = await db.select().from(squads).where(eq(squads.id, squadId));
        if (!squad) return res.status(404).json({ error: "Squad 不存在" });

        // 權限：自己離開 / 隊長踢人
        const isSelfLeave = targetUserId === callerId;
        if (!isSelfLeave) {
          if (squad.leaderId !== callerId) {
            return res.status(403).json({ error: "只有隊長可踢人" });
          }
          if (squad.leaderId === targetUserId) {
            return res.status(400).json({ error: "不可踢隊長（請先轉讓）" });
          }
        }

        // 隊長離開要先轉讓
        if (isSelfLeave && squad.leaderId === callerId) {
          return res.status(400).json({
            error: "隊長不可直接離開，請先轉讓給其他成員或解散隊伍",
          });
        }

        await db
          .update(squadMembers)
          .set({ leftAt: new Date() })
          .where(
            and(
              eq(squadMembers.squadId, squadId),
              eq(squadMembers.userId, targetUserId),
              isNull(squadMembers.leftAt),
            ),
          );

        res.json({ success: true });
      } catch (err) {
        console.error("[squads] DELETE member 失敗:", err);
        res.status(500).json({ error: "離開失敗" });
      }
    },
  );

  // ============================================================================
  // PATCH /api/squads/:id/members/:userId — 改角色（含隊長轉讓）
  // ============================================================================
  app.patch(
    "/api/squads/:id/members/:userId",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const callerId = req.user?.claims?.sub;
        if (!callerId) return res.status(401).json({ error: "Unauthorized" });

        const squadId = req.params.id;
        const targetUserId = req.params.userId;
        const parsed = updateMemberSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "驗證失敗" });
        }

        const [squad] = await db.select().from(squads).where(eq(squads.id, squadId));
        if (!squad) return res.status(404).json({ error: "Squad 不存在" });
        if (squad.leaderId !== callerId) {
          return res.status(403).json({ error: "只有隊長可改角色" });
        }

        // 改成 leader → 隊長轉讓
        const newRole = parsed.data.role;
        if (newRole === "leader" && targetUserId !== callerId) {
          // 1. 把舊隊長降為 officer
          await db
            .update(squadMembers)
            .set({ role: "officer" })
            .where(
              and(
                eq(squadMembers.squadId, squadId),
                eq(squadMembers.userId, callerId),
                isNull(squadMembers.leftAt),
              ),
            );

          // 2. 新隊長
          await db
            .update(squadMembers)
            .set({ role: "leader" })
            .where(
              and(
                eq(squadMembers.squadId, squadId),
                eq(squadMembers.userId, targetUserId),
                isNull(squadMembers.leftAt),
              ),
            );

          // 3. squad.leaderId 同步更新
          await db
            .update(squads)
            .set({ leaderId: targetUserId, updatedAt: new Date() })
            .where(eq(squads.id, squadId));

          return res.json({ success: true, transferredTo: targetUserId });
        }

        // 一般改 officer / member
        await db
          .update(squadMembers)
          .set({ role: newRole })
          .where(
            and(
              eq(squadMembers.squadId, squadId),
              eq(squadMembers.userId, targetUserId),
              isNull(squadMembers.leftAt),
            ),
          );

        res.json({ success: true });
      } catch (err) {
        console.error("[squads] PATCH member 失敗:", err);
        res.status(500).json({ error: "更新角色失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/me/squads — 我所屬的所有 Squad
  // ============================================================================
  app.get(
    "/api/me/squads",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const memberships = await db
          .select({
            membership: squadMembers,
            squad: squads,
          })
          .from(squadMembers)
          .innerJoin(squads, eq(squads.id, squadMembers.squadId))
          .where(
            and(
              eq(squadMembers.userId, userId),
              isNull(squadMembers.leftAt),
            ),
          )
          .orderBy(desc(squadMembers.joinedAt));

        res.json({
          memberships: memberships.map((m) => ({
            ...m.squad,
            myRole: m.membership.role,
            joinedAt: m.membership.joinedAt,
          })),
        });
      } catch (err) {
        console.error("[squads] GET me 失敗:", err);
        res.status(500).json({ error: "取得隊伍失敗" });
      }
    },
  );
}
