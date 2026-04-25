// 玩家獎勵 API — 我的錢包
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26.9 §26.13
//
// 端點：
//   GET  /api/me/rewards            — 取得我的所有獎勵（平台券 + 外部券）
//   POST /api/rewards/:id/use       — 使用平台券（標記 status = used）
//   POST /api/rewards/:id/redeem    — 跳轉外部券兌換頁
//
import type { Express } from "express";
import { db } from "../db";
import {
  platformCoupons,
  squadExternalRewards,
  couponTemplates,
} from "@shared/schema";
import { eq, and, or, desc, gt } from "drizzle-orm";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest } from "./types";
import { z } from "zod";

export function registerRewardsRoutes(app: Express) {
  // ============================================================================
  // GET /api/me/rewards — 我的獎勵清單（平台券 + 外部券）
  // ============================================================================
  app.get(
    "/api/me/rewards",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const status = (req.query.status as string) ?? "unused";
        const now = new Date();

        // 1. 平台券
        const platformResults = await db
          .select({ coupon: platformCoupons, template: couponTemplates })
          .from(platformCoupons)
          .leftJoin(
            couponTemplates,
            eq(platformCoupons.templateId, couponTemplates.id),
          )
          .where(
            and(
              eq(platformCoupons.issuedToUserId, userId),
              status === "all"
                ? undefined
                : status === "unused"
                  ? and(
                      eq(platformCoupons.status, "unused"),
                      gt(platformCoupons.expiresAt, now),
                    )
                  : eq(platformCoupons.status, status),
            ),
          )
          .orderBy(desc(platformCoupons.issuedAt));

        const platform = platformResults.map((row) => ({
          id: row.coupon.id,
          type: "platform_coupon" as const,
          code: row.coupon.code,
          status: row.coupon.status,
          expiresAt: row.coupon.expiresAt,
          issuedAt: row.coupon.issuedAt,
          usedAt: row.coupon.usedAt,
          template: row.template
            ? {
                name: row.template.name,
                description: row.template.description,
                discountType: row.template.discountType,
                discountValue: row.template.discountValue,
              }
            : null,
        }));

        // 2. 外部券
        const externalResults = await db
          .select()
          .from(squadExternalRewards)
          .where(
            and(
              eq(squadExternalRewards.userId, userId),
              status === "all"
                ? undefined
                : status === "unused"
                  ? or(
                      eq(squadExternalRewards.status, "issued"),
                      eq(squadExternalRewards.status, "pending"),
                    )
                  : eq(squadExternalRewards.status, status),
            ),
          )
          .orderBy(desc(squadExternalRewards.createdAt));

        const external = externalResults.map((r) => ({
          id: r.id,
          type: "external_coupon" as const,
          provider: r.provider,
          status: r.status,
          displayName: r.displayName,
          valueDescription: r.valueDescription,
          merchantName: r.merchantName,
          merchantAddress: r.merchantAddress,
          externalCouponCode: r.externalCouponCode,
          externalCouponUrl: r.externalCouponUrl,
          expiresAt: r.expiresAt,
          issuedAt: r.issuedAt,
          redeemedAt: r.redeemedAt,
        }));

        const summary = {
          totalCount: platform.length + external.length,
          platformCount: platform.length,
          externalCount: external.length,
          unusedPlatform: platform.filter((p) => p.status === "unused").length,
        };

        res.json({ summary, platform, external });
      } catch (error) {
        console.error("[rewards] GET /api/me/rewards 失敗:", error);
        res.status(500).json({ error: "取得獎勵失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/rewards/:id/use — 使用平台券
  // ============================================================================
  const useRewardSchema = z.object({
    context: z.record(z.string(), z.unknown()).optional(),
  });

  app.post(
    "/api/rewards/:id/use",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const id = req.params.id;
        const parsed = useRewardSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "context 格式錯誤" });
        }

        const [coupon] = await db
          .select()
          .from(platformCoupons)
          .where(
            and(
              eq(platformCoupons.id, id),
              eq(platformCoupons.issuedToUserId, userId),
            ),
          );

        if (!coupon) return res.status(404).json({ error: "券不存在或非你所有" });
        if (coupon.status !== "unused") {
          return res.status(400).json({ error: `券狀態為 ${coupon.status}，不可使用` });
        }
        if (coupon.expiresAt && new Date() > coupon.expiresAt) {
          return res.status(400).json({ error: "券已過期" });
        }

        const [updated] = await db
          .update(platformCoupons)
          .set({
            status: "used",
            usedAt: new Date(),
            redemptionContext: parsed.data.context ?? null,
          })
          .where(eq(platformCoupons.id, id))
          .returning();

        res.json({ success: true, coupon: updated });
      } catch (error) {
        console.error("[rewards] POST use 失敗:", error);
        res.status(500).json({ error: "使用券失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/rewards/external/callback — aihomi 等外部夥伴回傳券碼（webhook）
  // 用 X-Provider-Secret header 驗證（不需要 isAuthenticated）
  // ============================================================================
  const callbackSchema = z.object({
    request_id: z.string(),
    status: z.enum(["issued", "failed"]),
    user_id: z.string(),
    coupon: z
      .object({
        code: z.string(),
        display_name: z.string(),
        value: z.string(),
        redeem_url: z.string().url(),
        expires_at: z.string(),
        merchant_name: z.string().optional(),
        merchant_address: z.string().optional(),
      })
      .optional(),
    error_message: z.string().optional(),
  });

  app.post(
    "/api/rewards/external/callback",
    async (req, res) => {
      try {
        // 1. 驗證 webhook secret
        const secret = req.headers["x-provider-secret"] as string | undefined;
        if (!secret) {
          return res.status(401).json({ error: "缺少 X-Provider-Secret header" });
        }

        const { verifyAihomiWebhookSecret, processAihomiCallback } = await import(
          "../services/aihomi-adapter"
        );

        const isValid = await verifyAihomiWebhookSecret(secret);
        if (!isValid) {
          return res.status(403).json({ error: "webhook secret 驗證失敗" });
        }

        // 2. 驗證 payload
        const parsed = callbackSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "callback payload 格式錯誤",
            details: parsed.error.errors,
          });
        }

        // 3. 處理 callback
        const result = await processAihomiCallback(parsed.data);
        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }

        res.json({ success: true, rewardId: result.rewardId });
      } catch (error) {
        console.error("[rewards] external/callback 失敗:", error);
        res.status(500).json({ error: "callback 處理失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/rewards/external/redeemed — aihomi 通知券已兌換
  // ============================================================================
  const redeemedSchema = z.object({
    coupon_code: z.string(),
    redeemed_at: z.string(),
    merchant: z.string().optional(),
  });

  app.post(
    "/api/rewards/external/redeemed",
    async (req, res) => {
      try {
        const secret = req.headers["x-provider-secret"] as string | undefined;
        if (!secret) {
          return res.status(401).json({ error: "缺少 X-Provider-Secret header" });
        }

        const { verifyAihomiWebhookSecret, processAihomiRedeemCallback } = await import(
          "../services/aihomi-adapter"
        );

        const isValid = await verifyAihomiWebhookSecret(secret);
        if (!isValid) {
          return res.status(403).json({ error: "webhook secret 驗證失敗" });
        }

        const parsed = redeemedSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "redeemed payload 格式錯誤" });
        }

        const result = await processAihomiRedeemCallback(parsed.data);
        res.json(result);
      } catch (error) {
        console.error("[rewards] external/redeemed 失敗:", error);
        res.status(500).json({ error: "redeemed 處理失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/rewards/:id/redeem — 取得外部券兌換 URL
  // ============================================================================
  app.post(
    "/api/rewards/:id/redeem",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const id = req.params.id;
        const [reward] = await db
          .select()
          .from(squadExternalRewards)
          .where(
            and(
              eq(squadExternalRewards.id, id),
              eq(squadExternalRewards.userId, userId),
            ),
          );

        if (!reward) return res.status(404).json({ error: "獎勵不存在或非你所有" });
        if (!reward.externalCouponUrl) {
          return res.status(400).json({
            error: "尚未從外部系統取得兌換連結，請稍後再試",
          });
        }
        if (reward.status === "redeemed") {
          return res.status(400).json({ error: "券已兌換過" });
        }

        res.json({
          redirectUrl: reward.externalCouponUrl,
          provider: reward.provider,
          merchantName: reward.merchantName,
        });
      } catch (error) {
        console.error("[rewards] POST redeem 失敗:", error);
        res.status(500).json({ error: "兌換失敗" });
      }
    },
  );
}
