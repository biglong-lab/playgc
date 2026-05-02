// 📡 Webhook Dispatcher — outbound webhook 派送（W12 D3）
//
// 用途：API key 註冊 webhook URL → server 在事件發生時 POST 通知代理商
//
// 簽章（HMAC SHA-256）：
//   X-CHITO-Signature: t=1735693200,v1=abc123...
//   t = unix timestamp (秒)
//   v1 = hmac_sha256(`${t}.${rawPayload}`, secret) 的 hex
//
// 重試：失敗後 1 / 5 / 15 分鐘各重試一次（in-memory setTimeout、不持久化）
// 未來：W13+ 改用 BullMQ + Redis 跨 process

import crypto from "crypto";

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000]; // 1m / 5m / 15m

export interface WebhookEvent {
  /** 事件類型 */
  type: string;
  /** 事件資料（JSON-serializable）*/
  data: Record<string, unknown>;
  /** 對應 API key（用於選擇 webhook URL）*/
  apiKeyId: string;
  /** 事件唯一 ID（避免代理商重複處理）*/
  eventId?: string;
}

/**
 * 從環境變數查 API key 對應的 webhook URL + secret
 * 命名：API_KEY_WEBHOOK_URL_<keyIdShort> / API_KEY_WEBHOOK_SECRET_<keyIdShort>
 *
 * keyIdShort：apiKey.keyId 前 8 字元（清理特殊字元）
 */
function getWebhookConfig(keyId: string): { url: string; secret: string } | null {
  const shortKey = keyId.slice(0, 8).replace(/[^a-zA-Z0-9_]/g, "_");
  const url = process.env[`API_KEY_WEBHOOK_URL_${shortKey}`];
  const secret = process.env[`API_KEY_WEBHOOK_SECRET_${shortKey}`];
  if (!url) return null;
  return { url, secret: secret || "" };
}

/**
 * 計算 webhook 簽章
 *
 * @example
 *   X-CHITO-Signature: t=1735693200,v1=abc123...
 */
function signWebhook(timestamp: number, payload: string, secret: string): string {
  if (!secret) return "";
  const data = `${timestamp}.${payload}`;
  const v1 = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

/**
 * Fire-and-forget 派送 webhook（含 retry）
 *
 * 失敗不影響呼叫方（建場 / 付款流程）
 */
export function dispatchWebhook(event: WebhookEvent): void {
  const config = getWebhookConfig(event.apiKeyId);
  if (!config) return; // 此 key 未設 webhook URL

  // 包成 envelope（給代理商穩定 schema）
  const envelope = {
    id: event.eventId || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: event.type,
    createdAt: new Date().toISOString(),
    data: event.data,
  };

  attemptDelivery(envelope, config, 0);
}

async function attemptDelivery(
  envelope: { id: string; type: string; createdAt: string; data: Record<string, unknown> },
  config: { url: string; secret: string },
  attempt: number,
): Promise<void> {
  const payload = JSON.stringify(envelope);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signWebhook(timestamp, payload, config.secret);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-CHITO-Event": envelope.type,
      "X-CHITO-Event-Id": envelope.id,
    };
    if (signature) headers["X-CHITO-Signature"] = signature;

    const res = await fetch(config.url, {
      method: "POST",
      headers,
      body: payload,
    });

    if (res.ok) {
      console.log(`[webhook] ✅ ${envelope.type} 派送成功 (${envelope.id}, attempt ${attempt + 1})`);
      return;
    }

    // 4xx 不重試（代理商錯誤、重試也沒用）
    if (res.status >= 400 && res.status < 500) {
      console.warn(
        `[webhook] ⛔ ${envelope.type} 4xx 不重試 (${res.status}, ${envelope.id})`,
      );
      return;
    }

    // 5xx / network error 進重試
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.warn(
      `[webhook] ⚠️ ${envelope.type} 派送失敗 (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length}): ${err instanceof Error ? err.message : err}`,
    );

    const nextDelay = RETRY_DELAYS_MS[attempt];
    if (nextDelay !== undefined) {
      setTimeout(() => {
        attemptDelivery(envelope, config, attempt + 1).catch((err2) => {
          console.error(`[webhook] retry chain error:`, err2);
        });
      }, nextDelay);
    } else {
      console.error(
        `[webhook] ❌ ${envelope.type} 達最大重試次數，放棄 (${envelope.id})`,
      );
    }
  }
}
