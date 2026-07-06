// 🚨 Multi-Sessions Alert Cron — 異常 session Telegram 告警（P3-13 / 2026-05-08）
//
// 對應規劃：docs/changes/2026-05-08-admin-multi-sessions-v2.md P3-13
//
// 邏輯：
//   - 每 5 分鐘掃一次 active multi sessions
//   - 計算每場 anomalyScore（沿用 admin-multi-sessions endpoint 邏輯）
//   - 若 score >= 20 (critical) → notifySystemError（含 Replay 連結）
//   - 同 session cooldown 30 分鐘（避免重複告警）
//
// 啟動：server/index.ts boot 時 startMultiSessionsAlertCron()

import { db } from "../db";
import { gameSessions, games, wsEventLog } from "@shared/schema";
import { sql, eq, and, gte, inArray } from "drizzle-orm";
import { notifySystemError } from "./internal-notifier";

const CRON_INTERVAL_MS = 5 * 60 * 1000;       // 每 5 分鐘掃一次
const HEALTH_WINDOW_MS = 5 * 60 * 1000;        // 過去 5 分鐘事件
// 🔧 2026-07-06：門檻 20 → 30（避免真實活動 2 名玩家早退就告警；auto_leave×10、需 3 次或 grace+leave 混合）
const CRITICAL_SCORE_THRESHOLD = 30;
const COOLDOWN_MS = 30 * 60 * 1000;            // 同 session 30 分鐘 cooldown

// 🔧 2026-07-06：排除測試/demo 遊戲（title 含 test/測試/demo）— 避免測試斷線噪音
const TEST_TITLE_RE = /test|測試|demo|範例/i;

let timer: NodeJS.Timeout | null = null;
const lastAlertedAt: Map<string, number> = new Map(); // sessionId → ms timestamp

interface SessionAlertCandidate {
  sessionId: string;
  gameTitle: string;
  fieldId: string | null;
  graceCount: number;
  autoLeaveCount: number;
  kickCount: number;
  errorCount: number;
  anomalyScore: number;
}

async function scanAndAlert(): Promise<void> {
  try {
    // 1. 拉所有 active sessions（可能很少、不需 batch）
    const rawSessions = await db
      .select({
        sessionId: gameSessions.id,
        gameId: gameSessions.gameId,
        gameTitle: games.title,
        fieldId: games.fieldId,
        isDemo: games.isDemo,
      })
      .from(gameSessions)
      .leftJoin(games, eq(games.id, gameSessions.gameId))
      .where(eq(gameSessions.status, "playing"));

    // 🔧 2026-07-06：排除訪客 demo 沙盒 + 測試遊戲（避免測試斷線的告警噪音）
    const sessions = rawSessions.filter(
      (s) => !s.isDemo && !(s.gameTitle && TEST_TITLE_RE.test(s.gameTitle)),
    );

    if (sessions.length === 0) return;

    // 2. 拉過去 5 分鐘 ws 事件
    const sessionIds = sessions.map((s) => s.sessionId);
    const cutoff = new Date(Date.now() - HEALTH_WINDOW_MS);
    const events = await db
      .select({
        sessionId: wsEventLog.sessionId,
        eventType: wsEventLog.eventType,
      })
      .from(wsEventLog)
      .where(
        and(
          inArray(wsEventLog.sessionId, sessionIds),
          gte(wsEventLog.timestamp, cutoff),
        ),
      );

    // 3. 聚合每場 anomalyScore
    const healthBySession = new Map<string, { graceCount: number; autoLeaveCount: number; kickCount: number; errorCount: number }>();
    for (const e of events) {
      if (!e.sessionId) continue;
      const h = healthBySession.get(e.sessionId) ?? {
        graceCount: 0,
        autoLeaveCount: 0,
        kickCount: 0,
        errorCount: 0,
      };
      if (e.eventType === "grace_expired") h.graceCount += 1;
      else if (e.eventType === "auto_leave") h.autoLeaveCount += 1;
      else if (e.eventType === "kick") h.kickCount += 1;
      else if (e.eventType === "error") h.errorCount += 1;
      healthBySession.set(e.sessionId, h);
    }

    // 4. 找 critical sessions
    const candidates: SessionAlertCandidate[] = [];
    for (const s of sessions) {
      const h = healthBySession.get(s.sessionId) ?? { graceCount: 0, autoLeaveCount: 0, kickCount: 0, errorCount: 0 };
      const anomalyScore = h.graceCount * 5 + h.autoLeaveCount * 10 + h.errorCount * 8 + h.kickCount * 3;
      if (anomalyScore >= CRITICAL_SCORE_THRESHOLD) {
        candidates.push({
          sessionId: s.sessionId,
          gameTitle: s.gameTitle ?? "(未命名)",
          fieldId: s.fieldId,
          graceCount: h.graceCount,
          autoLeaveCount: h.autoLeaveCount,
          kickCount: h.kickCount,
          errorCount: h.errorCount,
          anomalyScore,
        });
      }
    }

    // 5. 過濾 cooldown、發告警
    const now = Date.now();
    for (const c of candidates) {
      const lastAt = lastAlertedAt.get(c.sessionId);
      if (lastAt && now - lastAt < COOLDOWN_MS) continue;
      lastAlertedAt.set(c.sessionId, now);

      const baseUrl = process.env.APP_BASE_URL ?? "https://game.homi.cc";
      const replayUrl = `${baseUrl}/admin/sessions/${c.sessionId}/replay`;
      const summary =
        `score=${c.anomalyScore}` +
        ` grace=${c.graceCount} auto-leave=${c.autoLeaveCount}` +
        ` kick=${c.kickCount} error=${c.errorCount}`;

      try {
        notifySystemError({
          source: "multi-sessions-alert",
          message:
            `🔴 異常 session：${c.gameTitle}（${c.fieldId ?? "—"}）` +
            ` ${summary} | Replay: ${replayUrl}`,
        });
        console.log(`[multi-sessions-alert] 🔴 ${c.sessionId} ${summary}`);
      } catch (err) {
        console.error("[multi-sessions-alert] notify failed:", err);
      }
    }

    // 6. 清理 cooldown map（移除已結束 session 的紀錄）
    const activeIds = new Set(sessionIds);
    for (const id of Array.from(lastAlertedAt.keys())) {
      if (!activeIds.has(id)) lastAlertedAt.delete(id);
    }
  } catch (err) {
    console.error("[multi-sessions-alert-cron] failed:", err);
  }
}

export function startMultiSessionsAlertCron(): void {
  if (timer) return;
  console.log(
    `[multi-sessions-alert-cron] cron started, will scan every ${CRON_INTERVAL_MS / 1000}s, threshold=${CRITICAL_SCORE_THRESHOLD}, cooldown=${COOLDOWN_MS / 60_000}min`,
  );
  timer = setInterval(() => {
    void scanAndAlert();
  }, CRON_INTERVAL_MS);
}

export function stopMultiSessionsAlertCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function runMultiSessionsAlertNow(): Promise<void> {
  await scanAndAlert();
}
