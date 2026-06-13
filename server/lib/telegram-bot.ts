// Telegram Bot service — Phase δ W3 D1
//
// 內部通知用、不付費（Telegram bot 推播完全免費）
//
// 環境變數：
//   TELEGRAM_BOT_TOKEN          — bot token（BotFather）
//   TELEGRAM_BOT_USERNAME       — bot username（@xxx）
//   TELEGRAM_NOTIFY_CHAT_IDS    — 收件人 chat_id 列表、逗號分隔
//
// 設計：
//   - 沒設 token / chat_ids → 自動切 stub mode（log 但不發）
//   - sendMessage 失敗 swallow（內部通知不 block 主流程）
//   - 支援 markdown / HTML / 純文字
//
// 多 chat_id 支援：可同時推給多個收件人（你 + 同事 + 共享群組）

const TG_API_BASE = "https://api.telegram.org";

export type TelegramParseMode = "MarkdownV2" | "HTML" | "Markdown";

export interface SendMessageOptions {
  /** 訊息文字 */
  text: string;
  /** 解析模式（HTML 最不易踩雷）*/
  parseMode?: TelegramParseMode;
  /** 不出現連結預覽 */
  disablePreview?: boolean;
  /** 靜音通知（系統雜訊類用）*/
  silent?: boolean;
  /** 自訂 chat_id（不傳則用環境變數的全部）*/
  chatId?: string | number;
}

interface TgEnvConfig {
  token: string;
  username: string;
  chatIds: string[];
  fieldGroupChatIds: string[];
}

let cachedConfig: TgEnvConfig | null = null;

function readConfig(): TgEnvConfig {
  if (cachedConfig) return cachedConfig;
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const username = process.env.TELEGRAM_BOT_USERNAME || "";
  const ids = (process.env.TELEGRAM_NOTIFY_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // 🆕 2026-06-13 顧客向「場域群組」chat_id（與內部 ops chat 分流，群組只收顧客事件）
  const fieldGroupIds = (process.env.TELEGRAM_FIELD_GROUP_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  cachedConfig = { token, username, chatIds: ids, fieldGroupChatIds: fieldGroupIds };
  return cachedConfig;
}

/** 顧客向場域群組 chat_id 清單（沒設則空、相關通知自動 stub） */
export function getFieldGroupChatIds(): string[] {
  return readConfig().fieldGroupChatIds;
}

/**
 * 是否啟用（有 token + 至少一個 chat_id）
 */
export function isTelegramEnabled(): boolean {
  const c = readConfig();
  return Boolean(c.token) && c.chatIds.length > 0;
}

/**
 * 取設定（測試 / debug 用）
 */
export function getTelegramStatus(): {
  enabled: boolean;
  username: string;
  chatIdCount: number;
} {
  const c = readConfig();
  return {
    enabled: isTelegramEnabled(),
    username: c.username,
    chatIdCount: c.chatIds.length,
  };
}

/**
 * 發送訊息給設定的所有 chat_id（或單一指定 chat_id）
 *
 * - 失敗不 throw（內部通知不可影響主流程）
 * - 統計每個 target 的成功狀態
 */
export async function sendMessage(opts: SendMessageOptions): Promise<{
  total: number;
  sent: number;
  failed: number;
  errors: string[];
}> {
  const c = readConfig();
  const result = { total: 0, sent: 0, failed: 0, errors: [] as string[] };

  if (!c.token) {
    console.log("[telegram] stub: no token", opts.text.slice(0, 80));
    return result;
  }

  const targets = opts.chatId
    ? [String(opts.chatId)]
    : c.chatIds;

  if (targets.length === 0) {
    console.log("[telegram] stub: no chat_ids", opts.text.slice(0, 80));
    return result;
  }

  result.total = targets.length;

  await Promise.all(
    targets.map(async (chatId) => {
      try {
        const res = await fetch(`${TG_API_BASE}/bot${c.token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: opts.text,
            parse_mode: opts.parseMode,
            disable_web_page_preview: opts.disablePreview ?? false,
            disable_notification: opts.silent ?? false,
          }),
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          result.failed++;
          result.errors.push(`chat_id=${chatId} status=${res.status} ${errBody.slice(0, 200)}`);
          return;
        }
        result.sent++;
      } catch (err) {
        result.failed++;
        result.errors.push(
          `chat_id=${chatId} error=${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
  );

  if (result.failed > 0) {
    console.warn(
      `[telegram] sendMessage 部分失敗 ${result.failed}/${result.total}：${result.errors.join("; ")}`,
    );
  }
  return result;
}

/**
 * 取得 bot 自己的資訊（健康檢查 / debug）
 */
export async function getBotInfo(): Promise<{ ok: boolean; username?: string; error?: string }> {
  const c = readConfig();
  if (!c.token) return { ok: false, error: "no_token" };
  try {
    const res = await fetch(`${TG_API_BASE}/bot${c.token}/getMe`);
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description };
    return { ok: true, username: data.result?.username };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
