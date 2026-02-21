// Recur.tw 金流 API Client
// 文件: https://docs.recur.tw
import crypto from "crypto";

const RECUR_API_BASE = "https://api.recur.tw/v1";

interface CheckoutSessionParams {
  /** Recur 產品 ID（在 Recur 後台建立） */
  productId: string;
  /** 付款成功後重導向 URL */
  successUrl: string;
  /** 使用者取消付款後重導向 URL */
  cancelUrl: string;
  /** 付款模式 */
  mode?: "PAYMENT" | "SUBSCRIPTION" | "SETUP";
  /** 預填玩家 email */
  customerEmail?: string;
  /** 預填玩家名稱 */
  customerName?: string;
  /** 自訂 metadata（用於對帳） */
  metadata?: Record<string, string>;
}

interface CheckoutSessionResponse {
  id: string;
  url: string;
  expires_at: string;
}

interface RecurError {
  code: string;
  message: string;
  details?: unknown;
}

/** 取得 Recur API Key（必須在環境變數中設定） */
function getApiKey(): string {
  const key = process.env.RECUR_API_KEY;
  if (!key) {
    throw new Error("RECUR_API_KEY 環境變數未設定");
  }
  return key;
}

/** 取得 Recur Webhook Secret */
function getWebhookSecret(): string {
  const secret = process.env.RECUR_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("RECUR_WEBHOOK_SECRET 環境變數未設定");
  }
  return secret;
}

/** 建立 Checkout Session（產生付費 URL） */
export async function createCheckoutSession(
  params: CheckoutSessionParams,
): Promise<CheckoutSessionResponse> {
  const response = await fetch(`${RECUR_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: params.productId,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      mode: params.mode ?? "PAYMENT",
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      metadata: params.metadata,
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as RecurError;
    throw new Error(`Recur API 錯誤: ${error.message || response.statusText}`);
  }

  return response.json() as Promise<CheckoutSessionResponse>;
}

/** 驗證 Webhook 簽名（HMAC-SHA256） */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  const secret = getWebhookSecret();
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}

/** 解析 Webhook 事件 */
export interface RecurWebhookEvent {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/** 檢查 Recur 是否已設定（環境變數是否存在） */
export function isRecurConfigured(): boolean {
  return !!process.env.RECUR_API_KEY;
}
