// 💳 Recur.tw — 用 fetch 直接打 Recur.tw API（W10 D2）
//
// 設計：不裝 SDK、用標準 fetch（與 stripe-checkout.ts 風格一致）
// 文件：https://docs.recur.tw/
//
// 核心 API：
//   POST /v1/checkout/sessions  建立 Checkout Session（一次性 / 訂閱）
//
// 認證：Authorization: Bearer sk_xxx
// Rate limit：sandbox 120/min、production 600/min

const RECUR_API_BASE = "https://api.recur.tw/v1";

export type RecurMode = "PAYMENT" | "SUBSCRIPTION";

export interface CreateRecurCheckoutInput {
  /** API key（sk_test_* 或 sk_live_*）*/
  apiKey: string;
  /** 計費模式 */
  mode: RecurMode;
  /** 產品 ID（事先在 Recur.tw 後台建立）*/
  productId: string;
  /** 成功跳轉 URL */
  successUrl: string;
  /** 取消跳轉 URL */
  cancelUrl: string;
  /** 客戶 email（可選）*/
  customerEmail?: string;
  /** 自訂 metadata（webhook 會回傳）*/
  metadata?: Record<string, string>;
}

export interface RecurCheckoutSession {
  id: string;
  url: string;
  status?: string;
}

/**
 * 建立 Recur.tw Checkout Session
 *
 * @example
 *   const session = await createRecurCheckoutSession({
 *     apiKey: process.env.RECUR_TW_API_KEY!,
 *     mode: "PAYMENT",
 *     productId: "prod_wedding_basic",
 *     successUrl: "https://game.homi.cc/pricing/success?session_id={CHECKOUT_SESSION_ID}",
 *     cancelUrl: "https://game.homi.cc/pricing?canceled=1",
 *     customerEmail: "user@example.com",
 *     metadata: { scenarioId: "wedding", adminId: "abc" },
 *   });
 */
export async function createRecurCheckoutSession(
  input: CreateRecurCheckoutInput,
): Promise<RecurCheckoutSession> {
  const { apiKey, mode, productId, successUrl, cancelUrl, customerEmail, metadata } = input;

  const body: Record<string, unknown> = {
    productId,
    mode,
    successUrl,
    cancelUrl,
  };

  if (customerEmail) body.customerEmail = customerEmail;
  if (metadata) body.metadata = metadata;

  const res = await fetch(`${RECUR_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Recur.tw API 錯誤 (${res.status}): ${errBody.slice(0, 300)}`);
  }

  const json = (await res.json()) as RecurCheckoutSession;
  return json;
}

/**
 * 驗證 Recur.tw webhook 簽章
 *
 * TODO（W10 D5 補實作）：
 *   依 Recur.tw 文件實作 HMAC SHA-256 簽章驗證
 *   類似 Stripe-Signature 機制
 *
 * 目前：未驗證、僅回傳 true（生產環境前必須補上）
 */
export function verifyRecurWebhookSignature(
  _payload: string,
  _signature: string,
  _webhookSecret: string,
): boolean {
  // TODO: 實作 HMAC SHA-256 驗證
  console.warn("[recur-tw] webhook 簽章驗證尚未實作（W10 D5 補上）");
  return true;
}
