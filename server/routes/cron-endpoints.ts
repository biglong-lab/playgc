// ⏰ Cron Endpoints — 系統 cron 觸發任務（W16 D4）
//
// 用途：讓 systemd / crontab 透過 HTTP 觸發排程任務（無需 admin 登入）
//
// 端點：
//   POST /api/cron/check-expiring-sessions
//     檢查即將過期 host sessions、推 LINE reminder
//
// 認證：CRON_SECRET 環境變數（Authorization: Bearer <secret>）
//
// 範例 crontab（每小時跑）：
//   0 * * * * curl -X POST https://game.homi.cc/api/cron/check-expiring-sessions \
//             -H "Authorization: Bearer $CRON_SECRET"

import type { Express, Request, Response } from "express";
import {
  checkExpiringSessionsAndNotify,
  pruneRemindedCache,
} from "../lib/expiring-session-checker";
import { verifySharedSecret } from "../lib/webhook-signature";
import { db } from "../db";
import { gameSessions, sessionReports } from "@shared/schema";
import { sql } from "drizzle-orm";
import { generateSessionReport } from "../lib/generateSessionReport";
import { notifySessionReport } from "../lib/internal-notifier";

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronAuth(req: Request): boolean {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  // 用 shared verifySharedSecret（timing-safe 比對、防 timing attack）取代 ===
  return verifySharedSecret(token, CRON_SECRET);
}

export function registerCronEndpoints(app: Express) {
  /**
   * GET /api/cron/health
   * 公開健康檢查（不洩漏 secret）
   */
  app.get("/api/cron/health", (_req, res) => {
    res.json({
      status: "ok",
      cronSecretConfigured: !!CRON_SECRET,
      lineConfigured: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      adminConfigured: !!process.env.LINE_ADMIN_USER_IDS,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/cron/check-expiring-sessions
   *
   * 檢查 1 小時內到期的 host sessions、推 LINE reminder
   * 建議每小時跑（搭配 ± 10 分鐘 buffer 不會漏 / 重複）
   */
  app.post("/api/cron/check-expiring-sessions", async (req: Request, res: Response) => {
    try {
      if (!CRON_SECRET) {
        return res.status(503).json({
          error: "CRON_SECRET 未設定",
          code: "CRON_NOT_CONFIGURED",
        });
      }
      if (!verifyCronAuth(req)) {
        return res.status(401).json({ error: "Invalid cron token" });
      }

      pruneRemindedCache();
      const result = await checkExpiringSessionsAndNotify();

      res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        result,
      });
    } catch (err) {
      console.error("[cron-endpoints] check-expiring 失敗:", err);
      res.status(500).json({ error: "內部錯誤" });
    }
  });
}
