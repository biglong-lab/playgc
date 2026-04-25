// 金門好康券（coupon.aihomi.cc）對接 adapter
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26.7
//
// 設計：
//   - 預設 isActive = false（safe，要 admin 手動啟用才工作）
//   - send 失敗不阻擋本系統流程
//   - 用 request_id 做 idempotency
//   - 對方非同步回傳 → callback handler 接（見 routes/rewards-external.ts）
//
import { db } from "../db";
import {
  externalRewardIntegrations,
  squadExternalRewards,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

const PROVIDER_AIHOMI = "aihomi_coupon";

interface SendRewardOptions {
  externalRewardId: string; // squad_external_rewards.id
  userId: string;
  userEmail?: string;
  squadName?: string;
  eventContext: {
    eventType: string;
    squadId?: string;
    fieldId?: string;
    gameType?: string;
    result?: string;
    [key: string]: unknown;
  };
  /** aihomi 模板 ID 或券名（規則設定的 value）*/
  voucherTemplate: string;
}

interface SendRewardResponse {
  success: boolean;
  pending?: boolean;
  errorMessage?: string;
}

/**
 * 送獎勵請求到 coupon.aihomi.cc
 *
 * 流程：
 *   1. 確認 aihomi integration 啟用
 *   2. 拼出 request body
 *   3. POST 到 aihomi API
 *   4. 對方非同步處理 → 後續 webhook callback 回傳券碼
 */
export async function sendAihomiReward(opts: SendRewardOptions): Promise<SendRewardResponse> {
  // 1. 取設定
  const [integration] = await db
    .select()
    .from(externalRewardIntegrations)
    .where(eq(externalRewardIntegrations.provider, PROVIDER_AIHOMI));

  if (!integration) {
    return { success: false, errorMessage: "aihomi integration 未設定" };
  }
  if (!integration.isActive) {
    // 預設關閉，要 admin 啟用 — 不算錯誤，留 pending 狀態
    return { success: false, pending: true, errorMessage: "aihomi integration 未啟用" };
  }
  if (!integration.apiEndpoint) {
    return { success: false, errorMessage: "aihomi apiEndpoint 未設定" };
  }

  // 2. 取已存的 reward 記錄（拿 requestId 做 idempotency）
  const [reward] = await db
    .select()
    .from(squadExternalRewards)
    .where(eq(squadExternalRewards.id, opts.externalRewardId));

  if (!reward) {
    return { success: false, errorMessage: "找不到 reward 記錄" };
  }
  if (!reward.requestId) {
    return { success: false, errorMessage: "reward 缺少 requestId" };
  }

  // 3. 拼出 webhook payload（按 §26.7 協定）
  const payload = {
    user_id: opts.userId,
    external_user_ref: opts.userEmail ?? null,
    event: {
      type: opts.eventContext.eventType ?? "squad_milestone",
      subtype: opts.eventContext.gameType,
      squad_id: opts.eventContext.squadId,
      squad_name: opts.squadName,
      field_id: opts.eventContext.fieldId,
    },
    voucher_template: opts.voucherTemplate,
    context: opts.eventContext,
    request_id: reward.requestId,
    callback_url: getCallbackUrl(),
  };

  // 4. 解密 API key（這版本先用明文，未來加密）
  const apiKey = integration.apiCredentialsEncrypted;
  if (!apiKey) {
    return { success: false, errorMessage: "API key 未設定" };
  }

  // 5. POST
  try {
    const res = await fetch(integration.apiEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "X-Provider-Source": "chito-game-platform",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errMsg = await res.text();
      return {
        success: false,
        errorMessage: `aihomi API ${res.status}: ${errMsg.slice(0, 200)}`,
      };
    }

    // aihomi 立即回 200（非同步處理），稍後 callback 回傳券碼
    // 我們先把 status 改為 pending（等待 callback）
    await db
      .update(squadExternalRewards)
      .set({ status: "pending" })
      .where(eq(squadExternalRewards.id, opts.externalRewardId));

    return { success: true, pending: true };
  } catch (err) {
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 接收 aihomi callback（券碼回來了）
 *
 * 由 webhook endpoint POST /api/rewards/external/callback 呼叫
 */
export async function processAihomiCallback(payload: {
  request_id: string;
  status: "issued" | "failed";
  user_id: string;
  coupon?: {
    code: string;
    display_name: string;
    value: string;
    redeem_url: string;
    expires_at: string;
    merchant_name?: string;
    merchant_address?: string;
  };
  error_message?: string;
}): Promise<{ success: boolean; rewardId?: string; error?: string }> {
  // 找對應的 reward
  const [reward] = await db
    .select()
    .from(squadExternalRewards)
    .where(
      and(
        eq(squadExternalRewards.requestId, payload.request_id),
        eq(squadExternalRewards.userId, payload.user_id),
      ),
    );

  if (!reward) {
    return { success: false, error: "找不到對應的 request_id" };
  }

  // 防重複處理
  if (reward.status === "issued" || reward.status === "redeemed") {
    return { success: true, rewardId: reward.id, error: "已處理過" };
  }

  if (payload.status === "failed") {
    await db
      .update(squadExternalRewards)
      .set({ status: "failed" })
      .where(eq(squadExternalRewards.id, reward.id));
    return { success: true, rewardId: reward.id };
  }

  if (!payload.coupon) {
    return { success: false, error: "callback 缺少 coupon 資料" };
  }

  // 更新 reward 為 issued
  await db
    .update(squadExternalRewards)
    .set({
      status: "issued",
      externalCouponCode: payload.coupon.code,
      externalCouponUrl: payload.coupon.redeem_url,
      displayName: payload.coupon.display_name,
      valueDescription: payload.coupon.value,
      merchantName: payload.coupon.merchant_name ?? null,
      merchantAddress: payload.coupon.merchant_address ?? null,
      expiresAt: payload.coupon.expires_at ? new Date(payload.coupon.expires_at) : null,
      issuedAt: new Date(),
    })
    .where(eq(squadExternalRewards.id, reward.id));

  return { success: true, rewardId: reward.id };
}

/**
 * 接收兌換完成 callback
 */
export async function processAihomiRedeemCallback(payload: {
  coupon_code: string;
  redeemed_at: string;
  merchant?: string;
}): Promise<{ success: boolean }> {
  const [reward] = await db
    .select()
    .from(squadExternalRewards)
    .where(eq(squadExternalRewards.externalCouponCode, payload.coupon_code));

  if (!reward) return { success: false };

  await db
    .update(squadExternalRewards)
    .set({
      status: "redeemed",
      redeemedAt: new Date(payload.redeemed_at),
    })
    .where(eq(squadExternalRewards.id, reward.id));

  return { success: true };
}

/**
 * 驗證 webhook secret（防偽造）
 */
export async function verifyAihomiWebhookSecret(secretFromHeader: string): Promise<boolean> {
  const [integration] = await db
    .select()
    .from(externalRewardIntegrations)
    .where(eq(externalRewardIntegrations.provider, PROVIDER_AIHOMI));

  if (!integration || !integration.webhookSecret) return false;
  return secretFromHeader === integration.webhookSecret;
}

function getCallbackUrl(): string {
  const base = process.env.PUBLIC_BASE_URL ?? "https://game.homi.cc";
  return `${base}/api/rewards/external/callback`;
}
