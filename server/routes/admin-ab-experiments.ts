// 🔬 A/B 實驗管理 — admin API
//
// 設計：
//   GET /api/admin/ab-experiments
//     列出所有實驗（支援 fieldId / status / gameId 過濾）
//   GET /api/admin/ab-experiments/:id
//     取單一實驗 metadata
//   POST /api/admin/ab-experiments
//     建立新實驗（draft 狀態）
//   PATCH /api/admin/ab-experiments/:id
//     更新（含啟動 status='running'、自動填 startedAt）
//   DELETE /api/admin/ab-experiments/:id
//     僅允許刪除 draft（其他狀態保留歷史不可刪）
//   GET /api/admin/ab-experiments/:id/results
//     計算統計顯著性（呼叫 ab-stats.ts.calculateSignificance）
//
// 權限：
//   - GET：game:view
//   - POST/PATCH/DELETE：game:edit
//   - super_admin 可看所有 field；其餘 admin 只能看自己 fieldId
import type { Express } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import { db } from "../db";
import {
  abExperiments,
  abExperimentStatusEnum,
  type AbExperimentStatus,
} from "@shared/schema";
import { calculateSignificance } from "../lib/ab-stats";
import { getGroupAssignmentCount } from "../lib/ab-test";

// ============================================================================
// 驗證 schema
// ============================================================================
const createExperimentSchema = z.object({
  fieldId: z.string().min(1).optional(),
  gameId: z.string().min(1).optional(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  experimentType: z.string().min(1).max(30).default("variant_pool"),
  targetPageId: z.string().min(1).max(50),
  targetVariantKey: z.string().min(1).max(20),
  variantAIndex: z.number().int().nonnegative(),
  variantBIndex: z.number().int().nonnegative(),
  minAssignmentsForConclusion: z.number().int().min(10).max(10000).optional(),
  significanceLevel: z.string().regex(/^0\.\d+$/).optional(),
});

const updateExperimentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  status: z.enum(abExperimentStatusEnum).optional(),
  variantAIndex: z.number().int().nonnegative().optional(),
  variantBIndex: z.number().int().nonnegative().optional(),
  minAssignmentsForConclusion: z.number().int().min(10).max(10000).optional(),
  significanceLevel: z.string().regex(/^0\.\d+$/).optional(),
});

// ============================================================================
export function registerAdminAbExperimentsRoutes(app: Express) {
  // --------------------------------------------------------------------------
  // GET /api/admin/ab-experiments
  // --------------------------------------------------------------------------
  app.get(
    "/api/admin/ab-experiments",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const { status, gameId, fieldId } = req.query as {
          status?: string;
          gameId?: string;
          fieldId?: string;
        };

        const filters = [];

        // super_admin 可看所有 / 其餘只能看自己 fieldId
        if (req.admin!.systemRole !== "super_admin") {
          filters.push(eq(abExperiments.fieldId, req.admin!.fieldId));
        } else if (fieldId) {
          filters.push(eq(abExperiments.fieldId, fieldId));
        }

        if (status && (abExperimentStatusEnum as readonly string[]).includes(status)) {
          filters.push(eq(abExperiments.status, status));
        }

        if (gameId) {
          filters.push(eq(abExperiments.gameId, gameId));
        }

        const rows = await db
          .select()
          .from(abExperiments)
          .where(filters.length > 0 ? and(...filters) : undefined)
          .orderBy(desc(abExperiments.createdAt))
          .limit(200);

        res.json({ experiments: rows, count: rows.length });
      } catch (error) {
        console.error("[ab-experiments] LIST 失敗:", error);
        res.status(500).json({ error: "查詢實驗列表失敗" });
      }
    },
  );

  // --------------------------------------------------------------------------
  // GET /api/admin/ab-experiments/:id
  // --------------------------------------------------------------------------
  app.get(
    "/api/admin/ab-experiments/:id",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const [exp] = await db
          .select()
          .from(abExperiments)
          .where(eq(abExperiments.id, req.params.id))
          .limit(1);

        if (!exp) {
          return res.status(404).json({ error: "實驗不存在" });
        }

        // 場域隔離
        if (
          req.admin!.systemRole !== "super_admin" &&
          exp.fieldId !== req.admin!.fieldId
        ) {
          return res.status(403).json({ error: "無權檢視此實驗" });
        }

        // 額外帶分組統計
        const counts = await getGroupAssignmentCount(exp.id);

        res.json({ experiment: exp, assignments: counts });
      } catch (error) {
        console.error("[ab-experiments] GET 失敗:", error);
        res.status(500).json({ error: "取實驗失敗" });
      }
    },
  );

  // --------------------------------------------------------------------------
  // POST /api/admin/ab-experiments
  // --------------------------------------------------------------------------
  app.post(
    "/api/admin/ab-experiments",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const parsed = createExperimentSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "輸入驗證失敗",
            details: parsed.error.errors,
          });
        }

        const data = parsed.data;

        // A 與 B 不能同 index
        if (data.variantAIndex === data.variantBIndex) {
          return res.status(400).json({
            error: "A 組和 B 組變體 index 不能相同",
          });
        }

        // 場域隔離（非 super_admin 強制用自己 fieldId）
        const fieldId =
          req.admin!.systemRole === "super_admin"
            ? data.fieldId ?? req.admin!.fieldId
            : req.admin!.fieldId;

        const [created] = await db
          .insert(abExperiments)
          .values({
            fieldId,
            gameId: data.gameId,
            name: data.name,
            description: data.description,
            experimentType: data.experimentType,
            targetPageId: data.targetPageId,
            targetVariantKey: data.targetVariantKey,
            variantAIndex: data.variantAIndex,
            variantBIndex: data.variantBIndex,
            minAssignmentsForConclusion: data.minAssignmentsForConclusion ?? 50,
            significanceLevel: data.significanceLevel ?? "0.05",
            status: "draft",
          })
          .returning();

        await logAuditAction({
          actorAdminId: req.admin?.accountId,
          action: "ab_experiment:create",
          targetType: "ab_experiment",
          targetId: created.id,
          metadata: {
            name: created.name,
            targetPageId: created.targetPageId,
            targetVariantKey: created.targetVariantKey,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.status(201).json({ experiment: created });
      } catch (error) {
        console.error("[ab-experiments] POST 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "建立實驗失敗",
        });
      }
    },
  );

  // --------------------------------------------------------------------------
  // PATCH /api/admin/ab-experiments/:id
  // --------------------------------------------------------------------------
  app.patch(
    "/api/admin/ab-experiments/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const parsed = updateExperimentSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "輸入驗證失敗",
            details: parsed.error.errors,
          });
        }

        // 取舊資料
        const [existing] = await db
          .select()
          .from(abExperiments)
          .where(eq(abExperiments.id, req.params.id))
          .limit(1);

        if (!existing) {
          return res.status(404).json({ error: "實驗不存在" });
        }

        // 場域隔離
        if (
          req.admin!.systemRole !== "super_admin" &&
          existing.fieldId !== req.admin!.fieldId
        ) {
          return res.status(403).json({ error: "無權修改此實驗" });
        }

        const data = parsed.data;

        // A 與 B 不能同 index
        const newAIndex = data.variantAIndex ?? existing.variantAIndex;
        const newBIndex = data.variantBIndex ?? existing.variantBIndex;
        if (newAIndex !== null && newBIndex !== null && newAIndex === newBIndex) {
          return res.status(400).json({
            error: "A 組和 B 組變體 index 不能相同",
          });
        }

        // 狀態流轉合法性檢查
        if (data.status) {
          const ok = isValidStatusTransition(
            existing.status as AbExperimentStatus,
            data.status,
          );
          if (!ok) {
            return res.status(400).json({
              error: `不允許從 ${existing.status} 轉到 ${data.status}`,
            });
          }
        }

        // 自動填充 startedAt / endedAt
        const setData: Record<string, unknown> = { ...data };
        if (data.status === "running" && existing.status !== "running") {
          setData.startedAt = new Date();
        }
        if (
          (data.status === "completed" || data.status === "abandoned") &&
          existing.status !== data.status
        ) {
          setData.endedAt = new Date();
        }

        const [updated] = await db
          .update(abExperiments)
          .set(setData)
          .where(eq(abExperiments.id, req.params.id))
          .returning();

        await logAuditAction({
          actorAdminId: req.admin?.accountId,
          action: "ab_experiment:update",
          targetType: "ab_experiment",
          targetId: updated.id,
          metadata: { changes: data },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({ experiment: updated });
      } catch (error) {
        console.error("[ab-experiments] PATCH 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "更新實驗失敗",
        });
      }
    },
  );

  // --------------------------------------------------------------------------
  // DELETE /api/admin/ab-experiments/:id
  // --------------------------------------------------------------------------
  app.delete(
    "/api/admin/ab-experiments/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const [existing] = await db
          .select()
          .from(abExperiments)
          .where(eq(abExperiments.id, req.params.id))
          .limit(1);

        if (!existing) {
          return res.status(404).json({ error: "實驗不存在" });
        }

        // 場域隔離
        if (
          req.admin!.systemRole !== "super_admin" &&
          existing.fieldId !== req.admin!.fieldId
        ) {
          return res.status(403).json({ error: "無權刪除此實驗" });
        }

        // 只允許刪除 draft（保留歷史紀錄）
        if (existing.status !== "draft") {
          return res.status(400).json({
            error: `只能刪除 draft 狀態的實驗（當前 ${existing.status}），其他狀態請改 abandoned`,
          });
        }

        await db.delete(abExperiments).where(eq(abExperiments.id, req.params.id));

        await logAuditAction({
          actorAdminId: req.admin?.accountId,
          action: "ab_experiment:delete",
          targetType: "ab_experiment",
          targetId: existing.id,
          metadata: { name: existing.name },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({ success: true });
      } catch (error) {
        console.error("[ab-experiments] DELETE 失敗:", error);
        res.status(500).json({ error: "刪除實驗失敗" });
      }
    },
  );

  // --------------------------------------------------------------------------
  // GET /api/admin/ab-experiments/:id/results
  // 計算統計顯著性 + 結論
  // --------------------------------------------------------------------------
  app.get(
    "/api/admin/ab-experiments/:id/results",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const [exp] = await db
          .select()
          .from(abExperiments)
          .where(eq(abExperiments.id, req.params.id))
          .limit(1);

        if (!exp) {
          return res.status(404).json({ error: "實驗不存在" });
        }

        // 場域隔離
        if (
          req.admin!.systemRole !== "super_admin" &&
          exp.fieldId !== req.admin!.fieldId
        ) {
          return res.status(403).json({ error: "無權檢視此實驗結果" });
        }

        const stats = await calculateSignificance(req.params.id);
        res.json({
          experiment: {
            id: exp.id,
            name: exp.name,
            status: exp.status,
            startedAt: exp.startedAt,
            endedAt: exp.endedAt,
          },
          stats,
        });
      } catch (error) {
        console.error("[ab-experiments] RESULTS 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "計算結果失敗",
        });
      }
    },
  );
}

// ============================================================================
// 狀態流轉合法性檢查
// ============================================================================
function isValidStatusTransition(
  from: AbExperimentStatus,
  to: AbExperimentStatus,
): boolean {
  if (from === to) return true;
  const allowed: Record<AbExperimentStatus, AbExperimentStatus[]> = {
    draft: ["running", "abandoned"],
    running: ["completed", "abandoned"],
    completed: [], // 不可再轉
    abandoned: [], // 不可再轉
  };
  return allowed[from]?.includes(to) ?? false;
}
