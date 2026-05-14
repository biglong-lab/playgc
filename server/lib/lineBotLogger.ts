// 📊 LINE Bot 事件 logger helper（W2 / 2026-05-14）
//
// 提供 line-webhook 主流程記錄事件用的薄包裝
// fire-and-forget — 失敗不影響 webhook 主流程
//
// 用法：
//   import { logLineBotEvent } from "../lib/lineBotLogger";
//   logLineBotEvent({ eventType: "message_received", lineUserId, ... });

import { db } from "../db";
import { lineBotEvents, type LineBotEventType } from "@shared/schema/line-bot-events";

interface LogEntry {
  eventType: LineBotEventType;
  lineUserId?: string;
  adminId?: string;
  fieldId?: string;
  intent?: string;
  success?: boolean;
  durationMs?: number;
  errorReason?: string;
  messageText?: string;
  replyText?: string;
  resultingGameId?: string;
  metadata?: Record<string, unknown>;
}

export function logLineBotEvent(entry: LogEntry): void {
  // fire-and-forget — 不 await、不 throw
  void db
    .insert(lineBotEvents)
    .values({
      eventType: entry.eventType,
      lineUserId: entry.lineUserId ?? null,
      adminId: entry.adminId ?? null,
      fieldId: entry.fieldId ?? null,
      intent: entry.intent ?? null,
      success: entry.success ?? null,
      durationMs: entry.durationMs ?? null,
      errorReason: entry.errorReason ?? null,
      messageText: entry.messageText ?? null,
      replyText: entry.replyText ?? null,
      resultingGameId: entry.resultingGameId ?? null,
      metadata: entry.metadata ?? null,
    })
    .catch((err) => {
      console.warn("[line-bot-logger] 寫入失敗 (靜默):", err?.message);
    });
}
