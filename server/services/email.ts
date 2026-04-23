// 📧 輕量 Email 服務（Resend REST API + fallback）
// 無 API Key 時 fallback 到 console log，功能不阻塞

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

interface SendResult {
  success: boolean;
  provider: "resend" | "console-log";
  messageId?: string;
  error?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress =
    payload.from ??
    process.env.EMAIL_FROM ??
    "CHITO <noreply@homi.cc>";

  // Fallback：沒 API key 時只 log
  if (!apiKey) {
    console.log("[email:fallback]", {
      to: payload.to,
      subject: payload.subject,
      preview: payload.text?.slice(0, 80) ?? payload.html.slice(0, 80),
    });
    return { success: true, provider: "console-log" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        success: false,
        provider: "resend",
        error: `HTTP ${res.status}: ${errBody.slice(0, 200)}`,
      };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { success: true, provider: "resend", messageId: data.id };
  } catch (err) {
    return {
      success: false,
      provider: "resend",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// 專用模板：管理員授權相關
// ============================================================================

export async function sendAdminGrantedEmail(params: {
  to: string;
  recipientName: string;
  fieldName: string;
  roleName: string;
  grantedByName: string;
  appUrl?: string;
}): Promise<SendResult> {
  const loginUrl = `${params.appUrl ?? "https://game.homi.cc"}/admin/login`;
  const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#2563eb;">🔑 您已獲得管理員權限</h2>
  <p>您好 ${escape(params.recipientName)}，</p>
  <p>
    <strong>${escape(params.grantedByName)}</strong> 已授權您成為
    <strong>「${escape(params.fieldName)}」</strong> 場域的管理員，
    角色：<strong>${escape(params.roleName)}</strong>。
  </p>
  <p>您現在可以登入後台進行管理：</p>
  <p style="margin:24px 0;">
    <a href="${loginUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
      前往管理後台
    </a>
  </p>
  <p style="color:#64748b;font-size:14px;">
    若您並未預期此授權，請聯繫 ${escape(params.grantedByName)} 或場域管理員。
  </p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;">
  <p style="color:#94a3b8;font-size:12px;">此郵件由系統自動寄送，請勿直接回覆。</p>
</div>
  `.trim();

  return sendEmail({
    to: params.to,
    subject: `🔑 您已獲得「${params.fieldName}」管理員權限`,
    html,
    text: `${params.grantedByName} 已授權您成為「${params.fieldName}」場域的 ${params.roleName}。登入：${loginUrl}`,
  });
}

export async function sendAdminRevokedEmail(params: {
  to: string;
  recipientName: string;
  fieldName: string;
  revokedByName: string;
}): Promise<SendResult> {
  const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#dc2626;">🛑 您的管理員權限已被撤銷</h2>
  <p>您好 ${escape(params.recipientName)}，</p>
  <p>
    <strong>${escape(params.revokedByName)}</strong> 已撤銷您對
    <strong>「${escape(params.fieldName)}」</strong> 場域的管理權限。
  </p>
  <p>您的玩家身份不受影響，仍可繼續參與場域遊戲、對戰等活動。</p>
  <p style="color:#64748b;font-size:14px;">
    若您認為此操作有誤，請聯繫 ${escape(params.revokedByName)}。
  </p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;">
  <p style="color:#94a3b8;font-size:12px;">此郵件由系統自動寄送，請勿直接回覆。</p>
</div>
  `.trim();

  return sendEmail({
    to: params.to,
    subject: `🛑 「${params.fieldName}」管理員權限已撤銷`,
    html,
    text: `您對「${params.fieldName}」的管理員權限已被 ${params.revokedByName} 撤銷。玩家身份不受影響。`,
  });
}

export async function sendPlayerSuspendedEmail(params: {
  to: string;
  recipientName: string;
  fieldName: string;
  status: "suspended" | "banned" | "active";
  reason?: string;
}): Promise<SendResult> {
  const statusText =
    params.status === "suspended"
      ? "暫停"
      : params.status === "banned"
        ? "停權"
        : "恢復";
  const subject =
    params.status === "active"
      ? `✅ 您在「${params.fieldName}」的會員身份已恢復`
      : `⚠️ 您在「${params.fieldName}」的會員身份已${statusText}`;
  const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:${params.status === "active" ? "#10b981" : "#dc2626"};">
    ${params.status === "active" ? "✅ 會員身份恢復" : `⚠️ 會員身份已${statusText}`}
  </h2>
  <p>您好 ${escape(params.recipientName)}，</p>
  <p>您在<strong>「${escape(params.fieldName)}」</strong>場域的會員身份狀態已變更為
  <strong>${statusText}</strong>。</p>
  ${params.reason ? `<p><strong>原因：</strong>${escape(params.reason)}</p>` : ""}
  <p style="color:#64748b;font-size:14px;">
    若有疑問請聯繫該場域管理員。
  </p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;">
  <p style="color:#94a3b8;font-size:12px;">此郵件由系統自動寄送，請勿直接回覆。</p>
</div>
  `.trim();

  return sendEmail({
    to: params.to,
    subject,
    html,
    text: `您在「${params.fieldName}」的會員身份已${statusText}${params.reason ? `。原因：${params.reason}` : "。"}`,
  });
}

// ============================================================================
// 簡易 HTML escape
// ============================================================================
function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
