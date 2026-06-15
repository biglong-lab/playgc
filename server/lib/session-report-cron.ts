// 多人/host session 報表自動生成 cron（2026-06-15）
//
// 問題：session_reports 一直是 0 筆 — 報表生成只掛在外部 crontab 打的 /api/cron 端點，
// 若 crontab 沒設就永遠不生成 → 多人遊戲問題無從用報表診斷。
// 解法：內部 setInterval（同 booking-reminder/observability cron 模式），每 15 分鐘
// 掃「實質已結束、有 ws 事件、但無 report」的 session → generateSessionReport（upsert）。
//
// 啟動位置：server/index.ts startup

import { db } from "../db";
import { sql } from "drizzle-orm";
import { generateSessionReport } from "./generateSessionReport";

const INTERVAL_MS = 15 * 60 * 1000; // 15 分鐘
let timer: NodeJS.Timeout | null = null;
let running = false;

async function runOnce(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const candidates = await db.execute<{ id: string }>(sql`
      SELECT gs.id
      FROM game_sessions gs
      LEFT JOIN session_reports sr ON sr.session_id = gs.id
      WHERE sr.id IS NULL
        AND gs.started_at >= NOW() - INTERVAL '24 hours'
        AND (
          gs.status IN ('completed', 'abandoned')
          OR (
            gs.status = 'playing'
            AND NOT EXISTS (
              SELECT 1 FROM ws_event_log
              WHERE ws_event_log.session_id = gs.id
                AND ws_event_log.timestamp >= NOW() - INTERVAL '30 minutes'
            )
            AND EXISTS (
              SELECT 1 FROM ws_event_log WHERE ws_event_log.session_id = gs.id LIMIT 1
            )
          )
        )
      ORDER BY gs.started_at DESC
      LIMIT 10
    `);
    const rows = (candidates as unknown as { rows?: Array<{ id: string }> }).rows ?? [];
    for (const row of rows) {
      try {
        await generateSessionReport(row.id);
      } catch (err) {
        console.error("[session-report-cron] generate 失敗 session=" + row.id, err);
      }
    }
    if (rows.length > 0) console.log(`[session-report-cron] 生成 ${rows.length} 份 session 報表`);
  } catch (err) {
    console.error("[session-report-cron] runOnce 失敗:", err);
  } finally {
    running = false;
  }
}

export function startSessionReportCron(): void {
  if (timer) return;
  console.log("[session-report-cron] cron started, every 15 min");
  // 啟動後 2 分鐘跑第一次（讓 server 先穩定）
  setTimeout(() => void runOnce(), 2 * 60 * 1000);
  timer = setInterval(() => void runOnce(), INTERVAL_MS);
}
