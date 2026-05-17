// 🔐 Admin LINE Login Config — 全域 LINE Login channel 設定（2026-05-18）
//
// 端點：
//   GET   /api/platform/line-login-config           取目前設定（secret masked）
//   PATCH /api/platform/line-login-config           更新設定（platform admin only）
//
// 安全：
//   - 只有 platform admin（super admin）能改
//   - secret 回傳時 masked、PATCH 傳空字串視為「不變」（避免 mask 覆蓋真值）

import type { Express } from "express";
import { db } from "../db";
import { lineLoginConfig } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requirePlatformAdmin } from "../platformAuth";
import { z } from "zod";
import { invalidateLineLoginConfigCache, LINE_LOGIN_SINGLETON_ID } from "../lib/line-login-config";

function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

const patchSchema = z.object({
  channelId: z.string().max(100).optional().nullable(),
  channelSecret: z.string().max(200).optional().nullable(),
  callbackUrl: z.string().max(300).optional().nullable(),
  enabled: z.boolean().optional(),
});

export function registerAdminLineLoginConfigRoutes(app: Express) {
  // GET
  app.get(
    "/api/platform/line-login-config",
    requirePlatformAdmin,
    async (_req, res) => {
      try {
        const [row] = await db
          .select()
          .from(lineLoginConfig)
          .where(eq(lineLoginConfig.id, LINE_LOGIN_SINGLETON_ID))
          .limit(1);

        // 沒設定過 → 回預設空值
        if (!row) {
          return res.json({
            channelId: "",
            hasChannelSecret: false,
            channelSecretMasked: "",
            callbackUrl: "https://game.homi.cc/api/auth/line/callback",
            enabled: false,
            updatedAt: null,
          });
        }

        res.json({
          channelId: row.channelId ?? "",
          hasChannelSecret: !!row.channelSecret,
          channelSecretMasked: maskSecret(row.channelSecret),
          callbackUrl: row.callbackUrl ?? "https://game.homi.cc/api/auth/line/callback",
          enabled: row.enabled,
          updatedAt: row.updatedAt,
        });
      } catch (err) {
        console.error("[admin-line-login-config GET]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // PATCH (upsert singleton)
  app.patch(
    "/api/platform/line-login-config",
    requirePlatformAdmin,
    async (req, res) => {
      try {
        const parsed = patchSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "validation", details: parsed.error.issues });
        }

        const adminId = (req as { platformAdmin?: { id?: string } }).platformAdmin?.id ?? null;
        const patch: Record<string, unknown> = {
          updatedAt: new Date(),
          updatedByAdminId: adminId,
        };

        if (parsed.data.channelId !== undefined) {
          patch.channelId = parsed.data.channelId || null;
        }
        // 空字串 → 不變（保留原 secret、避免 mask 覆蓋真值）
        if (parsed.data.channelSecret !== undefined && parsed.data.channelSecret !== "") {
          patch.channelSecret = parsed.data.channelSecret;
        }
        if (parsed.data.callbackUrl !== undefined) {
          patch.callbackUrl = parsed.data.callbackUrl || null;
        }
        if (parsed.data.enabled !== undefined) {
          patch.enabled = parsed.data.enabled;
        }

        // upsert singleton
        const [existing] = await db
          .select({ id: lineLoginConfig.id })
          .from(lineLoginConfig)
          .where(eq(lineLoginConfig.id, LINE_LOGIN_SINGLETON_ID))
          .limit(1);

        if (existing) {
          await db
            .update(lineLoginConfig)
            .set(patch)
            .where(eq(lineLoginConfig.id, LINE_LOGIN_SINGLETON_ID));
        } else {
          await db.insert(lineLoginConfig).values({
            id: LINE_LOGIN_SINGLETON_ID,
            channelId: (patch.channelId as string | null) ?? null,
            channelSecret: (patch.channelSecret as string | null) ?? null,
            callbackUrl: (patch.callbackUrl as string | null) ?? null,
            enabled: (patch.enabled as boolean | undefined) ?? false,
            updatedByAdminId: adminId,
          });
        }

        invalidateLineLoginConfigCache();
        res.json({ ok: true });
      } catch (err) {
        console.error("[admin-line-login-config PATCH]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );
}
