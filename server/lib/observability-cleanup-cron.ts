// 🔭 Observability Cleanup Cron（Phase 0.2 / 2026-05-08）
//
// 每天 03:00 跑 cleanup_observability_logs(90) 函式
// 刪 90 天前的 ws_event_log + db_write_log 紀錄
// 2026-07-10 擴充：audit_logs 保留 180 天、error_logs 保留 90 天（原本永久累積）
//
// 啟動位置：server/index.ts startup
//
// 監控：若刪除 > 100 萬筆 → Telegram 警示（資料量爆表、考慮升 partitioning）

import { db } from "../db";
import { sql, lt, and, isNotNull } from "drizzle-orm";
import { auditLogs, errorLogs } from "@shared/schema";

const CHECK_INTERVAL_MS = 60_000; // 每分鐘檢查一次「現在是否該跑」
const TARGET_HOUR = 3;             // 03:00 跑
const TARGET_MINUTE = 0;
const RETENTION_DAYS = 90;
const AUDIT_RETENTION_DAYS = 180;  // 稽核紀錄保守留半年
const ERROR_RETENTION_DAYS = 90;   // error_logs 依 lastSeenAt（仍在聚合的指紋不刪）

let timer: NodeJS.Timeout | null = null;
let lastRunDate: string | null = null; // YYYY-MM-DD、避免同日重跑

async function runCleanup(): Promise<void> {
  try {
    console.log("[observability-cleanup] start cleanup, retention=" + RETENTION_DAYS + " days");
    const result = await db.execute<{ table_name: string; deleted_count: string }>(
      sql`SELECT * FROM cleanup_observability_logs(${RETENTION_DAYS})`,
    );
    const rows = (result as unknown as { rows?: Array<{ table_name: string; deleted_count: string }> }).rows ?? [];
    let totalDeleted = 0;
    for (const row of rows) {
      const count = Number(row.deleted_count) || 0;
      totalDeleted += count;
      console.log(`[observability-cleanup] ${row.table_name}: deleted ${count} rows`);
    }

    // 2026-07-10：audit_logs / error_logs retention（原本永久累積）
    const auditCutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 86400_000);
    const auditDeleted = await db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, auditCutoff))
      .returning({ id: auditLogs.id });
    totalDeleted += auditDeleted.length;
    console.log(`[observability-cleanup] audit_logs: deleted ${auditDeleted.length} rows（>${AUDIT_RETENTION_DAYS} 天）`);

    const errorCutoff = new Date(Date.now() - ERROR_RETENTION_DAYS * 86400_000);
    const errorDeleted = await db
      .delete(errorLogs)
      .where(and(isNotNull(errorLogs.lastSeenAt), lt(errorLogs.lastSeenAt, errorCutoff)))
      .returning({ id: errorLogs.id });
    totalDeleted += errorDeleted.length;
    console.log(`[observability-cleanup] error_logs: deleted ${errorDeleted.length} rows（lastSeenAt >${ERROR_RETENTION_DAYS} 天）`);

    // 大量刪除告警（> 100 萬筆 = 異常成長、應升 partitioning）
    if (totalDeleted > 1_000_000) {
      console.warn(
        `[observability-cleanup] ⚠️ deleted ${totalDeleted} rows、考慮 PostgreSQL declarative partitioning by day`,
      );
      // 可接 internal-notifier Telegram 告警
      try {
        const { notifySystemError } = await import("./internal-notifier");
        notifySystemError({
          source: "observability-cleanup",
          message: `Observability cleanup deleted ${totalDeleted} rows (> 100w)、考慮升 partitioning`,
        });
      } catch {
        // notifier 失敗不影響 cleanup
      }
    }
  } catch (err) {
    console.error("[observability-cleanup] failed:", err);
  }
}

function tick(): void {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const today = now.toISOString().slice(0, 10);

  if (hour === TARGET_HOUR && minute === TARGET_MINUTE && lastRunDate !== today) {
    lastRunDate = today;
    void runCleanup();
  }
}

export function startObservabilityCleanupCron(): void {
  if (timer) return;
  console.log(
    `[observability-cleanup] cron started, will run daily at ${String(TARGET_HOUR).padStart(2, "0")}:${String(TARGET_MINUTE).padStart(2, "0")}`,
  );
  timer = setInterval(tick, CHECK_INTERVAL_MS);
}

export function stopObservabilityCleanupCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * 手動觸發（測試 / admin endpoint 用）
 */
export async function runObservabilityCleanupNow(): Promise<void> {
  await runCleanup();
}
