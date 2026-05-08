// 🔭 WebSocket Event Logger（Phase 0.2 / 2026-05-08）
//
// 設計原則：
//   - **不阻塞 ws 處理**：所有 log 寫入 fire-and-forget（不 await）
//   - **失敗容錯**：log 寫入失敗不影響 ws 邏輯（catch all）
//   - **payload 限制**：> 10KB 自動截斷
//   - **隱私保護**：對講機訊息預設不存內容（除非 ENABLE_CHAT_FULL_LOG=true）
//   - **敏感欄位 redact**：password / token / secret / api_key
//   - **buffer flush**：每 N 筆或 M 秒批次 INSERT 降低 DB 壓力
//
// 用法：
//   import { logWsEvent, logDbWrite } from "./lib/ws-event-logger";
//
//   // 連線建立
//   logWsEvent({
//     eventType: "connect",
//     direction: "system",
//     userId, sessionId, clientIp, userAgent,
//   });
//
//   // 訊息（inbound）
//   logWsEvent({
//     eventType: "message",
//     direction: "inbound",
//     messageType: msg.type,
//     payload: msg,  // 自動 redact
//     userId, teamId, sessionId,
//   });
//
//   // 廣播（outbound）
//   logWsEvent({
//     eventType: "broadcast",
//     direction: "outbound",
//     messageType: data.type,
//     recipientCount: clientCount,
//     payload: data,
//     teamId,
//   });

import { db } from "../db";
import {
  wsEventLog,
  dbWriteLog,
  REDACT_PATTERNS,
  SENSITIVE_MESSAGE_TYPES,
  type ObservabilityEventType,
  type ObservabilityDirection,
  type InsertWsEventLog,
  type InsertDbWriteLog,
} from "@shared/schema";

const MAX_PAYLOAD_BYTES = 10 * 1024; // 10 KB
const FLUSH_INTERVAL_MS = 1000;       // 每 1 秒 flush 一次
const FLUSH_BATCH_SIZE = 50;          // 達 50 筆立即 flush
const ENABLE_CHAT_FULL_LOG = process.env.ENABLE_CHAT_FULL_LOG === "true";

// ============== 共用 helper ==============

function redactSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 10) return "[max_depth]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitive(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACT_PATTERNS.some((pattern) => pattern.test(key))) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = redactSensitive(value, depth + 1);
    }
  }
  return result;
}

function preparePayload(
  raw: unknown,
  messageType?: string | null,
): { payload: unknown; truncated: boolean } {
  // 對講機訊息：預設不存內容、只存 metadata
  if (
    messageType &&
    SENSITIVE_MESSAGE_TYPES.includes(messageType as (typeof SENSITIVE_MESSAGE_TYPES)[number]) &&
    !ENABLE_CHAT_FULL_LOG
  ) {
    if (raw && typeof raw === "object" && "message" in raw) {
      const r = raw as Record<string, unknown>;
      const messageStr = typeof r.message === "string" ? r.message : "";
      return {
        payload: {
          ...r,
          message: undefined,
          messageLength: messageStr.length,
          _redacted: "chat_content_disabled",
        },
        truncated: false,
      };
    }
  }

  // 一般訊息 redact 敏感欄位
  const redacted = redactSensitive(raw);

  // 大小限制
  try {
    const json = JSON.stringify(redacted);
    if (json.length > MAX_PAYLOAD_BYTES) {
      return {
        payload: {
          _truncated: true,
          _originalSize: json.length,
          _preview: json.slice(0, MAX_PAYLOAD_BYTES),
        },
        truncated: true,
      };
    }
  } catch {
    return { payload: { _serializationFailed: true }, truncated: false };
  }

  return { payload: redacted, truncated: false };
}

// ============== buffer + flush ==============

const wsBuffer: InsertWsEventLog[] = [];
const dbBuffer: InsertDbWriteLog[] = [];
let flushTimer: NodeJS.Timeout | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushBuffers();
  }, FLUSH_INTERVAL_MS);
}

async function flushBuffers() {
  if (wsBuffer.length === 0 && dbBuffer.length === 0) return;

  const wsBatch = wsBuffer.splice(0, wsBuffer.length);
  const dbBatch = dbBuffer.splice(0, dbBuffer.length);

  // 並行 flush 兩張表（彼此獨立失敗）
  const promises: Promise<unknown>[] = [];
  if (wsBatch.length > 0) {
    promises.push(
      db
        .insert(wsEventLog)
        .values(wsBatch)
        .catch((err) => {
          // 不能再 throw、否則影響 ws 處理
          console.error("[ws-event-logger] flush ws_event_log failed:", err);
        }),
    );
  }
  if (dbBatch.length > 0) {
    promises.push(
      db
        .insert(dbWriteLog)
        .values(dbBatch)
        .catch((err) => {
          console.error("[ws-event-logger] flush db_write_log failed:", err);
        }),
    );
  }
  await Promise.all(promises);
}

function enqueueWs(entry: InsertWsEventLog) {
  wsBuffer.push(entry);
  if (wsBuffer.length >= FLUSH_BATCH_SIZE) {
    void flushBuffers();
  } else {
    scheduleFlush();
  }
}

function enqueueDb(entry: InsertDbWriteLog) {
  dbBuffer.push(entry);
  if (dbBuffer.length >= FLUSH_BATCH_SIZE) {
    void flushBuffers();
  } else {
    scheduleFlush();
  }
}

// ============== Public API ==============

export interface LogWsEventInput {
  eventType: ObservabilityEventType;
  direction?: ObservabilityDirection;
  messageType?: string | null;
  payload?: unknown;
  sessionId?: string | null;
  teamId?: string | null;
  userId?: string | null;
  userName?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  closeCode?: number | null;
  reason?: string | null;
  latencyMs?: number | null;
  recipientCount?: number | null;
}

/**
 * 記錄 WebSocket 事件（fire-and-forget、不會 throw）
 */
export function logWsEvent(input: LogWsEventInput): void {
  try {
    const { payload } = preparePayload(input.payload, input.messageType);
    enqueueWs({
      eventType: input.eventType,
      direction: input.direction ?? null,
      messageType: input.messageType ?? null,
      payload: payload as InsertWsEventLog["payload"],
      sessionId: input.sessionId ?? null,
      teamId: input.teamId ?? null,
      userId: input.userId ?? null,
      userName: input.userName ?? null,
      clientIp: input.clientIp ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
      closeCode: input.closeCode ?? null,
      reason: input.reason?.slice(0, 200) ?? null,
      latencyMs: input.latencyMs ?? null,
      recipientCount: input.recipientCount ?? null,
    });
  } catch (err) {
    console.error("[ws-event-logger] logWsEvent failed:", err);
  }
}

export interface LogDbWriteInput {
  tableName: string;
  operation: "insert" | "update" | "delete";
  primaryKey?: string | null;
  sessionId?: string | null;
  teamId?: string | null;
  userId?: string | null;
  before?: unknown;
  after?: unknown;
  conflictType?: string | null;
  retrySucceeded?: boolean | null;
  triggeredBy?: string | null;
}

/**
 * 記錄 DB 寫入（fire-and-forget、不會 throw）
 */
export function logDbWrite(input: LogDbWriteInput): void {
  try {
    const { payload: beforeRedacted } = preparePayload(input.before);
    const { payload: afterRedacted } = preparePayload(input.after);
    enqueueDb({
      tableName: input.tableName,
      operation: input.operation,
      primaryKey: input.primaryKey?.slice(0, 200) ?? null,
      sessionId: input.sessionId ?? null,
      teamId: input.teamId ?? null,
      userId: input.userId ?? null,
      before: beforeRedacted as InsertDbWriteLog["before"],
      after: afterRedacted as InsertDbWriteLog["after"],
      conflictType: input.conflictType ?? null,
      retrySucceeded: input.retrySucceeded ?? null,
      triggeredBy: input.triggeredBy ?? null,
    });
  } catch (err) {
    console.error("[ws-event-logger] logDbWrite failed:", err);
  }
}

/**
 * 強制 flush（process exit / 測試用）
 */
export async function flushWsEventLog(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushBuffers();
}
