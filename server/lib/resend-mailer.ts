// ✉️ Resend Mailer — 信件發送（W10 D5）
//
// 設計：用 fetch 直接打 Resend API（與 stripe-checkout / recur-tw 風格一致）
// 文件：https://resend.com/docs
//
// 環境變數：
//   RESEND_API_KEY    - re_xxxxx
//   EMAIL_FROM        - "noreply@homi.cc" 或 "CHITO <noreply@homi.cc>"

const RESEND_API_BASE = "https://api.resend.com";
const DEFAULT_FROM = "CHITO <noreply@homi.cc>";

export interface SendEmailInput {
  apiKey: string;
  to: string | string[];
  subject: string;
  /** HTML 內容 */
  html: string;
  /** 純文字 fallback（可選，提升送達率）*/
  text?: string;
  /** 寄件者，預設 EMAIL_FROM 或 noreply@homi.cc */
  from?: string;
  /** Reply-To */
  replyTo?: string;
  /** Tags（給 Resend dashboard 過濾用）*/
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  id: string;
}

/**
 * 透過 Resend 發送信件
 *
 * @example
 *   await sendEmail({
 *     apiKey: process.env.RESEND_API_KEY!,
 *     to: "user@example.com",
 *     subject: "活動建立成功",
 *     html: "<h1>...</h1>",
 *   });
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const {
    apiKey,
    to,
    subject,
    html,
    text,
    from = process.env.EMAIL_FROM || DEFAULT_FROM,
    replyTo,
    tags,
  } = input;

  const body: Record<string, unknown> = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (text) body.text = text;
  if (replyTo) body.reply_to = replyTo;
  if (tags) body.tags = tags;

  const res = await fetch(`${RESEND_API_BASE}/emails`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Resend API 錯誤 (${res.status}): ${errBody.slice(0, 300)}`);
  }

  const json = (await res.json()) as { id: string };
  return { id: json.id };
}

/**
 * Fire-and-forget 寄信（失敗不阻擋呼叫方）
 *
 * 用於 webhook / instantiate 等不應因信件失敗而失敗的場景
 */
export function sendEmailAsync(input: SendEmailInput): void {
  sendEmail(input).catch((err) => {
    console.error("[resend] async 寄信失敗:", err);
  });
}

// ════════════════════════════════════════════════════════════════════
// 預製信件模板
// ════════════════════════════════════════════════════════════════════

export interface PaymentSuccessEmailInput {
  customerEmail: string;
  scenarioName: string;
  amount: number;
  instances: Array<{ label: string; hostUrl?: string; playUrl?: string; gameUrl?: string }>;
}

/**
 * 付款成功通知（W10 D5）
 */
export function buildPaymentSuccessEmail(input: PaymentSuccessEmailInput): {
  subject: string;
  html: string;
} {
  const { scenarioName, amount, instances } = input;

  const instancesHtml = instances
    .map((i) => {
      const urls = [
        i.hostUrl && `📺 大螢幕 <code>${escapeHtml(i.hostUrl)}</code>`,
        i.playUrl && `📱 玩家 <code>${escapeHtml(i.playUrl)}</code>`,
        i.gameUrl && `🎮 玩家入口 <code>${escapeHtml(i.gameUrl)}</code>`,
      ]
        .filter(Boolean)
        .join("<br>");
      return `<li><strong>${escapeHtml(i.label)}</strong><br>${urls}</li>`;
    })
    .join("");

  return {
    subject: `✅ ${scenarioName} 付款成功`,
    html: `
<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #10b981;">✅ 付款成功</h1>
  <p>感謝您購買 <strong>${escapeHtml(scenarioName)}</strong></p>
  <p>付款金額：NT$ ${amount.toLocaleString()}</p>
  <h2>您的活動連結</h2>
  <ul style="line-height: 1.8;">${instancesHtml}</ul>
  <p style="color: #6b7280; font-size: 14px;">
    💡 大螢幕網址含 hostToken 12 小時有效，請勿公開展示。<br>
    玩家手機端 QR 可貼在現場。<br>
    活動當天有問題請 LINE 聯絡客服。
  </p>
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
  <p style="color: #9ca3af; font-size: 12px;">CHITO · 數位遊戲平台 · game.homi.cc</p>
</body>
</html>
    `.trim(),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
