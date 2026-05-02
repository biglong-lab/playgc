// ⏰ Expiring Session Checker（W16 D4）
//
// 用途：找即將過期的 host sessions（1 小時內到期）→ 推 LINE reminder 給 admin
//
// 觸發：
//   - 系統 cron（crontab）每小時打 POST /api/cron/check-expiring-sessions
//   - 或手動測試：直接 import + call
//
// 設計：
//   - 1 小時 ± 10 分鐘範圍偵測（避免漏 / 重複）
//   - 用 LINE_ADMIN_USER_IDS 取得 admin 名單、依 fieldId 對應
//   - fire-and-forget 推播（不 block 主流程）
//   - 紀錄 lastReminderSentAt（schema 不動 → 用記憶體 Set 防重複）

import { db } from "../db";
import { games, gameSessions } from "@shared/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { pushMessage } from "./line-bot";

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const APP_BASE_URL = process.env.APP_BASE_URL || "https://game.homi.cc";

/**
 * 已送過 reminder 的 sessionId 快取（程序生命週期）
 * 重啟後會重新送（避免錯過）
 */
const remindedSessions = new Set<string>();

export interface ExpiringCheckResult {
  scanned: number;
  notified: number;
  skipped: number;
  errors: number;
}

/**
 * 檢查即將過期的 sessions 並推 LINE reminder
 *
 * 規則：
 *   - 過濾：hostMode=true + status='playing' + expiresAt 在 [now+50min, now+70min] 之間
 *     （± 10 分鐘 buffer，搭配每小時 cron 不會漏）
 *   - 已送過的 sessionId（remindedSessions Set）跳過
 *   - LINE_ADMIN_USER_IDS 全部 admin 都會收到通知（簡化版）
 *
 * @example
 *   const result = await checkExpiringSessionsAndNotify();
 *   console.log(`Notified ${result.notified} sessions`);
 */
export async function checkExpiringSessionsAndNotify(): Promise<ExpiringCheckResult> {
  const result: ExpiringCheckResult = {
    scanned: 0,
    notified: 0,
    skipped: 0,
    errors: 0,
  };

  if (!ACCESS_TOKEN) {
    console.log("[expiring-checker] LINE_CHANNEL_ACCESS_TOKEN 未設、跳過");
    return result;
  }

  const adminIds = (process.env.LINE_ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (adminIds.length === 0) {
    console.log("[expiring-checker] 無 LINE admin 設定、跳過");
    return result;
  }

  // 1 小時內過期（± 10 分鐘 buffer）
  const now = new Date();
  const lowerBound = new Date(now.getTime() + 50 * 60 * 1000);
  const upperBound = new Date(now.getTime() + 70 * 60 * 1000);

  const rows = await db
    .select({ session: gameSessions, game: games })
    .from(gameSessions)
    .innerJoin(games, eq(games.id, gameSessions.gameId))
    .where(
      and(
        eq(gameSessions.hostMode, true),
        eq(gameSessions.status, "playing"),
        gte(gameSessions.hostTokenExpiresAt, lowerBound),
        lte(gameSessions.hostTokenExpiresAt, upperBound),
      ),
    );

  result.scanned = rows.length;

  for (const row of rows) {
    if (remindedSessions.has(row.session.id)) {
      result.skipped++;
      continue;
    }

    const text =
      `⏰ 活動即將過期提醒\n\n` +
      `📦 ${row.game.title}\n` +
      `🆔 ${row.session.id.slice(0, 8)}\n` +
      `⏰ 將於 1 小時內過期（${row.session.hostTokenExpiresAt?.toISOString().slice(11, 16)} UTC）\n\n` +
      `🖥 大螢幕：${APP_BASE_URL}/host/${row.session.id}?token=${row.session.hostToken}\n\n` +
      `💡 用「@chito 結束 ${row.session.id.slice(0, 8)}」可手動結束`;

    // 推給每個 admin
    for (const adminId of adminIds) {
      try {
        await pushMessage({
          accessToken: ACCESS_TOKEN,
          to: adminId,
          messages: [{ type: "text", text }],
        });
      } catch (err) {
        console.error(
          `[expiring-checker] push 失敗 admin=${adminId.slice(0, 8)}:`,
          err instanceof Error ? err.message : err,
        );
        result.errors++;
      }
    }

    remindedSessions.add(row.session.id);
    result.notified++;
  }

  return result;
}

/**
 * 清理 remindedSessions 快取（避免長時間運行積太多）
 * 由 cron 在每次執行前呼叫
 */
export function pruneRemindedCache(): void {
  // 簡化：超過 1000 個直接清空（極少數情況）
  if (remindedSessions.size > 1000) {
    remindedSessions.clear();
  }
}
