// 🔗 Admin LINE Config — per-field LINE channel 設定 endpoint（2026-05-17）
//
// 端點：
//   GET   /api/admin/line-config           取當前 admin 場域的 LINE 設定（secret masked）
//   PATCH /api/admin/line-config           更新 LINE 設定
//
// 安全：
//   - admin 只能改自己 fieldId 的設定（從 req.admin.fieldId）
//   - super_admin 暫時也只能改自己 fieldId（之後加 :fieldId 參數版本）
//   - secret / accessToken 回傳時 mask 中間（避免 plain text 流出）

import type { Express } from "express";
import { db } from "../db";
import { fields } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { z } from "zod";
import { invalidateLineConfigCache } from "../lib/line-config-resolver";

function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

const lineConfigPatchSchema = z.object({
  lineChannelId: z.string().max(50).optional().nullable(),
  lineChannelSecret: z.string().max(200).optional().nullable(),
  lineChannelAccessToken: z.string().max(500).optional().nullable(),
  lineLiffId: z.string().max(50).optional().nullable(),
  lineEnabled: z.boolean().optional(),
});

export function registerAdminLineConfigRoutes(app: Express) {
  // GET 當前 admin 場域的 LINE 設定（secret masking）
  app.get(
    "/api/admin/line-config",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });
        if (!req.admin.fieldId) {
          return res.status(400).json({ error: "no_field", message: "admin 未綁定場域" });
        }
        const [field] = await db
          .select({
            id: fields.id,
            code: fields.code,
            name: fields.name,
            lineChannelId: fields.lineChannelId,
            lineChannelSecret: fields.lineChannelSecret,
            lineChannelAccessToken: fields.lineChannelAccessToken,
            lineLiffId: fields.lineLiffId,
            lineEnabled: fields.lineEnabled,
          })
          .from(fields)
          .where(eq(fields.id, req.admin.fieldId))
          .limit(1);
        if (!field) {
          return res.status(404).json({ error: "field_not_found" });
        }
        // Mask secrets
        res.json({
          fieldId: field.id,
          fieldCode: field.code,
          fieldName: field.name,
          lineChannelId: field.lineChannelId ?? "",
          // 標示有無設定、不回傳真實值
          hasLineChannelSecret: !!field.lineChannelSecret,
          lineChannelSecretMasked: maskSecret(field.lineChannelSecret),
          hasLineChannelAccessToken: !!field.lineChannelAccessToken,
          lineChannelAccessTokenMasked: maskSecret(field.lineChannelAccessToken),
          lineLiffId: field.lineLiffId ?? "",
          lineEnabled: field.lineEnabled === "true",
        });
      } catch (err) {
        console.error("[admin-line-config GET]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // PATCH 更新 LINE 設定
  app.patch(
    "/api/admin/line-config",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });
        if (!req.admin.fieldId) {
          return res.status(400).json({ error: "no_field", message: "admin 未綁定場域" });
        }
        const parsed = lineConfigPatchSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "validation", details: parsed.error.issues });
        }
        const patch: Record<string, unknown> = {
          updatedAt: new Date(),
        };
        // 只有非空字串才更新（避免把 mask 顯示的 "****" 覆蓋真值）
        if (parsed.data.lineChannelId !== undefined) {
          patch.lineChannelId = parsed.data.lineChannelId || null;
        }
        if (parsed.data.lineChannelSecret !== undefined && parsed.data.lineChannelSecret !== "") {
          patch.lineChannelSecret = parsed.data.lineChannelSecret;
        }
        if (parsed.data.lineChannelAccessToken !== undefined && parsed.data.lineChannelAccessToken !== "") {
          patch.lineChannelAccessToken = parsed.data.lineChannelAccessToken;
        }
        if (parsed.data.lineLiffId !== undefined) {
          patch.lineLiffId = parsed.data.lineLiffId || null;
        }
        if (parsed.data.lineEnabled !== undefined) {
          patch.lineEnabled = parsed.data.lineEnabled ? "true" : "false";
        }

        await db.update(fields).set(patch).where(eq(fields.id, req.admin.fieldId));
        // 清快取讓新設定立即生效
        invalidateLineConfigCache(req.admin.fieldId);

        res.json({ ok: true });
      } catch (err) {
        console.error("[admin-line-config PATCH]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );
}
