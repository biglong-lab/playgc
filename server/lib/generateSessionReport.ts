// 📊 generateSessionReport — 活動結束自動產生報告（Phase 3 / 2026-05-10）
//
// 對應規劃：docs/changes/2026-05-10-multi-leader-stability.md (後續延伸)
//
// 用途：
//   - 一場 multi session 結束、撈 ws_event_log + 業務數據算指標
//   - 跟前 5 場對比、算 anomaly score、找異常
//   - UPSERT session_reports（unique session_id、同場只一份）
//   - 給 endpoint / webhook / cron / telegram 共用
//
// 不做：
//   - 不發 telegram（呼叫端決定）
//   - 不寫 admin UI（Phase 5 才接）

import { db } from "../db";
import {
  sessionReports,
  gameSessions,
  type SessionReport,
  type SessionReportAnomaly,
} from "@shared/schema";
import { sql, eq, desc } from "drizzle-orm";

// ── 警戒閾值 ──────────────────────────────────
//
// 基於 2026-05-10 生產 7 天觀測（修 config_change 前）：
//   grace_start / connect = 78%
//   grace_expired / grace_start = 73%
//   auto_leave / connect = 45%
//
// 修完 config_change 後預期：
//   grace 觸發降至 < 30%、auto_leave < 10%
//
// 警戒閾值設定為「修完後仍高於預期」的水平：
const THRESHOLDS = {
  graceRate: 0.30,        // grace_start / connects > 30% → 異常
  autoLeaveRate: 0.10,    // auto_leave / connects > 10% → 異常
  configChangeRate: 0.05, // config_change closes / connects > 5% → 異常
  abnormalCloseRate: 0.20, // 空 reason close > 20% → 異常
  completionRate: 0.50,    // 完成率 < 50% → 異常
  latencyMs: 500,          // 平均 ws latency > 500ms → 異常
} as const;

const BASELINE_SESSION_COUNT = 5;

// ── 小工具 ─────────────────────────────────────
function pct(num: number, den: number): number {
  if (den === 0) return 0;
  return Math.round((num / den) * 100);
}

function ratio(num: number, den: number): number {
  if (den === 0) return 0;
  return num / den;
}

interface WsStats {
  connects: number;
  closes: number;
  configChangeCloses: number;
  abnormalCloses: number;
  graceStart: number;
  graceExpired: number;
  autoLeave: number;
  avgLatencyMs: number | null;
}

async function fetchWsStats(sessionId: string): Promise<WsStats> {
  // close.reason 分類：
  //   'config_change' / 'user_change' → Provider 主動關（不該發生）
  //   'left_team' → 玩家自願離開
  //   '' or null → abnormal close（網路斷 / browser close）
  const rows = await db.execute<{
    event_type: string;
    reason: string | null;
    cnt: string;
    avg_latency: string | null;
  }>(sql`
    SELECT
      event_type,
      reason,
      COUNT(*)::text AS cnt,
      AVG(latency_ms)::text AS avg_latency
    FROM ws_event_log
    WHERE session_id = ${sessionId}
    GROUP BY event_type, reason
  `);

  const result: WsStats = {
    connects: 0,
    closes: 0,
    configChangeCloses: 0,
    abnormalCloses: 0,
    graceStart: 0,
    graceExpired: 0,
    autoLeave: 0,
    avgLatencyMs: null,
  };

  let totalLatencyMs = 0;
  let latencyCount = 0;

  const dataRows = (rows as unknown as { rows?: Array<{ event_type: string; reason: string | null; cnt: string; avg_latency: string | null }> }).rows ?? [];

  for (const row of dataRows) {
    const cnt = parseInt(row.cnt, 10);
    const latency = row.avg_latency ? parseFloat(row.avg_latency) : null;
    if (latency !== null && !isNaN(latency)) {
      totalLatencyMs += latency * cnt;
      latencyCount += cnt;
    }
    switch (row.event_type) {
      case "connect":
        result.connects += cnt;
        break;
      case "close":
        result.closes += cnt;
        if (row.reason === "config_change" || row.reason === "user_change") {
          result.configChangeCloses += cnt;
        } else if (!row.reason || row.reason === "") {
          result.abnormalCloses += cnt;
        }
        break;
      case "grace_start":
        result.graceStart += cnt;
        break;
      case "grace_expired":
        result.graceExpired += cnt;
        break;
      case "auto_leave":
        result.autoLeave += cnt;
        break;
    }
  }

  if (latencyCount > 0) {
    result.avgLatencyMs = Math.round(totalLatencyMs / latencyCount);
  }

  return result;
}

interface BusinessStats {
  totalPlayers: number;
  completedPlayers: number;
  triviaAnswerCount: number;
  triviaCorrectRate: number | null;
  photoTeamCompletedCount: number;
}

async function fetchBusinessStats(sessionId: string): Promise<BusinessStats> {
  // 玩家總數 = ws_event_log distinct(user_id)（最簡可靠來源）
  // completed = 沒被 auto_leave 的玩家數
  const playerRows = await db.execute<{ user_id: string; auto_left: string }>(sql`
    SELECT
      user_id,
      COUNT(*) FILTER (WHERE event_type = 'auto_leave')::text AS auto_left
    FROM ws_event_log
    WHERE session_id = ${sessionId}
      AND user_id IS NOT NULL
    GROUP BY user_id
  `);
  const players = (playerRows as unknown as { rows?: Array<{ user_id: string; auto_left: string }> }).rows ?? [];
  const totalPlayers = players.length;
  const autoLeftCount = players.filter((p) => parseInt(p.auto_left, 10) > 0).length;
  const completedPlayers = Math.max(0, totalPlayers - autoLeftCount);

  // Trivia 答題統計
  const triviaRows = await db.execute<{ total: string; correct: string }>(sql`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE is_correct = true)::text AS correct
    FROM trivia_answers
    WHERE session_id = ${sessionId}
  `);
  const triviaData = (triviaRows as unknown as { rows?: Array<{ total: string; correct: string }> }).rows?.[0];
  const triviaTotal = triviaData ? parseInt(triviaData.total, 10) : 0;
  const triviaCorrect = triviaData ? parseInt(triviaData.correct, 10) : 0;
  const triviaCorrectRate = triviaTotal > 0 ? Math.round((triviaCorrect / triviaTotal) * 100) : null;

  // Team photo gather 完成數
  const photoRows = await db.execute<{ cnt: string }>(sql`
    SELECT COUNT(*)::text AS cnt
    FROM team_photo_gather
    WHERE session_id = ${sessionId}
  `);
  const photoData = (photoRows as unknown as { rows?: Array<{ cnt: string }> }).rows?.[0];
  const photoTeamCompletedCount = photoData ? parseInt(photoData.cnt, 10) : 0;

  return {
    totalPlayers,
    completedPlayers,
    triviaAnswerCount: triviaTotal,
    triviaCorrectRate,
    photoTeamCompletedCount,
  };
}

interface BaselineSnapshot {
  sampleCount: number;
  avgGraceRate: number;
  avgAutoLeaveRate: number;
  avgConfigChangeRate: number;
  avgCompletionRate: number;
  avgLatencyMs: number | null;
}

async function fetchBaseline(excludeSessionId: string): Promise<BaselineSnapshot> {
  const recent = await db
    .select()
    .from(sessionReports)
    .where(sql`${sessionReports.sessionId} != ${excludeSessionId}`)
    .orderBy(desc(sessionReports.createdAt))
    .limit(BASELINE_SESSION_COUNT);

  if (recent.length === 0) {
    return {
      sampleCount: 0,
      avgGraceRate: 0,
      avgAutoLeaveRate: 0,
      avgConfigChangeRate: 0,
      avgCompletionRate: 0,
      avgLatencyMs: null,
    };
  }

  const sumGrace = recent.reduce((s, r) => s + ratio(r.graceStartCount ?? 0, r.wsConnects ?? 0), 0);
  const sumAutoLeave = recent.reduce((s, r) => s + ratio(r.autoLeaveCount ?? 0, r.wsConnects ?? 0), 0);
  const sumConfigChange = recent.reduce(
    (s, r) => s + ratio(r.wsConfigChangeCloses ?? 0, r.wsConnects ?? 0),
    0,
  );
  const sumCompletion = recent.reduce((s, r) => s + (r.completionRate ?? 0), 0);
  const latencies = recent.map((r) => r.avgWsLatencyMs).filter((x): x is number => x !== null);

  return {
    sampleCount: recent.length,
    avgGraceRate: sumGrace / recent.length,
    avgAutoLeaveRate: sumAutoLeave / recent.length,
    avgConfigChangeRate: sumConfigChange / recent.length,
    avgCompletionRate: Math.round(sumCompletion / recent.length),
    avgLatencyMs: latencies.length > 0 ? Math.round(latencies.reduce((s, x) => s + x, 0) / latencies.length) : null,
  };
}

function detectAnomalies(
  ws: WsStats,
  biz: BusinessStats,
  baseline: BaselineSnapshot,
): { anomalies: SessionReportAnomaly[]; score: number } {
  const anomalies: SessionReportAnomaly[] = [];
  const graceRate = ratio(ws.graceStart, ws.connects);
  const autoLeaveRate = ratio(ws.autoLeave, ws.connects);
  const configChangeRate = ratio(ws.configChangeCloses, ws.connects);
  const abnormalCloseRate = ratio(ws.abnormalCloses, ws.connects);
  const completionRate = ratio(biz.completedPlayers, biz.totalPlayers);

  if (ws.connects > 0 && graceRate > THRESHOLDS.graceRate) {
    anomalies.push({
      type: "ws_grace_high",
      severity: graceRate > 0.5 ? "high" : "medium",
      message: `WS grace 觸發率過高（${pct(ws.graceStart, ws.connects)}%）`,
      value: graceRate,
      baseline: baseline.avgGraceRate || undefined,
      threshold: THRESHOLDS.graceRate,
    });
  }
  if (ws.connects > 0 && autoLeaveRate > THRESHOLDS.autoLeaveRate) {
    anomalies.push({
      type: "ws_auto_leave_high",
      severity: autoLeaveRate > 0.3 ? "high" : "medium",
      message: `auto_leave 觸發率過高（${pct(ws.autoLeave, ws.connects)}%）`,
      value: autoLeaveRate,
      baseline: baseline.avgAutoLeaveRate || undefined,
      threshold: THRESHOLDS.autoLeaveRate,
    });
  }
  if (ws.connects > 0 && configChangeRate > THRESHOLDS.configChangeRate) {
    anomalies.push({
      type: "ws_config_change_high",
      severity: configChangeRate > 0.2 ? "high" : "medium",
      message: `config_change 比例過高（${pct(ws.configChangeCloses, ws.connects)}%）— Provider 不該主動關`,
      value: configChangeRate,
      baseline: baseline.avgConfigChangeRate || undefined,
      threshold: THRESHOLDS.configChangeRate,
    });
  }
  if (ws.connects > 0 && abnormalCloseRate > THRESHOLDS.abnormalCloseRate) {
    anomalies.push({
      type: "abnormal_close_high",
      severity: abnormalCloseRate > 0.4 ? "high" : "medium",
      message: `abnormal close 比例過高（${pct(ws.abnormalCloses, ws.connects)}%）— 玩家網路品質差`,
      value: abnormalCloseRate,
      threshold: THRESHOLDS.abnormalCloseRate,
    });
  }
  if (biz.totalPlayers > 0 && completionRate < THRESHOLDS.completionRate) {
    anomalies.push({
      type: "completion_low",
      severity: completionRate < 0.3 ? "high" : "medium",
      message: `完成率偏低（${pct(biz.completedPlayers, biz.totalPlayers)}%）`,
      value: completionRate,
      baseline: baseline.avgCompletionRate / 100 || undefined,
      threshold: THRESHOLDS.completionRate,
    });
  }
  if (ws.avgLatencyMs !== null && ws.avgLatencyMs > THRESHOLDS.latencyMs) {
    anomalies.push({
      type: "latency_high",
      severity: ws.avgLatencyMs > 1000 ? "high" : "medium",
      message: `WS 平均延遲過高（${ws.avgLatencyMs}ms）`,
      value: ws.avgLatencyMs,
      baseline: baseline.avgLatencyMs ?? undefined,
      threshold: THRESHOLDS.latencyMs,
    });
  }

  // anomaly score 0-100
  const severityScore = { low: 5, medium: 15, high: 30 };
  const score = Math.min(
    100,
    anomalies.reduce((s, a) => s + severityScore[a.severity], 0),
  );

  return { anomalies, score };
}

/**
 * 為一場 multi session 產生報告（idempotent — UPSERT by session_id）
 *
 * @param sessionId multi session id
 * @returns 寫入後的 SessionReport
 */
export async function generateSessionReport(sessionId: string): Promise<SessionReport> {
  // 1. 撈 session 基本資訊（fieldId 從 games join）
  const sessionRows = await db.execute<{
    id: string;
    game_id: string | null;
    field_id: string | null;
    started_at: string | null;
    completed_at: string | null;
    status: string | null;
  }>(sql`
    SELECT
      gs.id,
      gs.game_id,
      g.field_id,
      gs.started_at,
      gs.completed_at,
      gs.status
    FROM game_sessions gs
    LEFT JOIN games g ON gs.game_id = g.id
    WHERE gs.id = ${sessionId}
    LIMIT 1
  `);
  const sessionRow = (sessionRows as unknown as { rows?: Array<{ id: string; game_id: string | null; field_id: string | null; started_at: string | null; completed_at: string | null; status: string | null }> }).rows?.[0];

  if (!sessionRow) {
    throw new Error(`session not found: ${sessionId}`);
  }
  const session = {
    id: sessionRow.id,
    gameId: sessionRow.game_id,
    fieldId: sessionRow.field_id,
    startedAt: sessionRow.started_at ? new Date(sessionRow.started_at) : null,
    endedAt: sessionRow.completed_at ? new Date(sessionRow.completed_at) : null,
    status: sessionRow.status,
  };

  // 2. 並行撈 ws + 業務 + baseline
  const [ws, biz, baseline] = await Promise.all([
    fetchWsStats(sessionId),
    fetchBusinessStats(sessionId),
    fetchBaseline(sessionId),
  ]);

  // 3. 算指標
  const completionRate = biz.totalPlayers > 0 ? pct(biz.completedPlayers, biz.totalPlayers) : null;
  const durationMs =
    session.startedAt && session.endedAt
      ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
      : null;

  // 4. 算異常
  const { anomalies, score: anomalyScore } = detectAnomalies(ws, biz, baseline);

  // 5. UPSERT
  const reportData = {
    sessionId,
    gameId: session.gameId ?? null,
    fieldId: session.fieldId ?? null,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs,
    totalPlayers: biz.totalPlayers,
    completedPlayers: biz.completedPlayers,
    wsConnects: ws.connects,
    wsCloses: ws.closes,
    wsConfigChangeCloses: ws.configChangeCloses,
    wsAbnormalCloses: ws.abnormalCloses,
    graceStartCount: ws.graceStart,
    graceExpiredCount: ws.graceExpired,
    autoLeaveCount: ws.autoLeave,
    avgWsLatencyMs: ws.avgLatencyMs,
    completionRate,
    triviaAnswerCount: biz.triviaAnswerCount,
    triviaCorrectRate: biz.triviaCorrectRate,
    photoTeamCompletedCount: biz.photoTeamCompletedCount,
    anomalyScore,
    anomalies,
    baselineSnapshot: baseline,
  };

  // ON CONFLICT (session_id) DO UPDATE
  const [report] = await db
    .insert(sessionReports)
    .values(reportData)
    .onConflictDoUpdate({
      target: sessionReports.sessionId,
      set: {
        ...reportData,
        // telegram_sent 不覆蓋（保留首次推送狀態）
      },
    })
    .returning();

  return report;
}

export type { SessionReport, SessionReportAnomaly };
