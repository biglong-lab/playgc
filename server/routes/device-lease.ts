// 🔌 裝置租約 API（ADR-0024）
//
// 玩家進入打擊關卡時租用靶機、離場時釋放。
// 安全原則：歸屬的 userId 一律取登入身份，不接受前端指定，
// 避免玩家把命中分數灌到別人帳上。

import type { Express, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../firebaseAuth";
import { acquireLease, releaseLease } from "../mqtt/lease-service";

const acquireSchema = z.object({
  deviceId: z.string().min(1).max(50),
  sessionId: z.string().max(100).optional(),
  pageId: z.string().max(100).optional(),
  teamId: z.string().max(100).optional(),
  ttlMinutes: z.number().int().min(1).max(120).optional(),
});

const releaseSchema = z.object({
  deviceId: z.string().min(1).max(50),
});

const FAILURE_MESSAGES: Record<string, string> = {
  device_not_found: "找不到此設備",
  device_not_ready: "設備維護中或已停用",
  device_no_field: "設備尚未綁定場域",
  conflict: "此靶機正在被其他場次使用",
};

function fail(res: Response, e: unknown) {
  console.error("[device-lease]", e);
  res.status(500).json({ error: "internal_error", message: "伺服器錯誤" });
}

export function registerDeviceLeaseRoutes(app: Express): void {
  // 租用靶機（進入關卡時呼叫）
  app.post("/api/device-lease/acquire", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "unauthenticated" });

      const parsed = acquireSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "bad_request", message: "參數格式錯誤" });
      }

      const result = await acquireLease({ ...parsed.data, userId });
      if (!result.ok) {
        const status = result.reason === "conflict" ? 409 : 400;
        return res.status(status).json({
          error: result.reason,
          message: FAILURE_MESSAGES[result.reason] ?? "無法租用設備",
          heldBySession: result.heldBySession ?? null,
        });
      }

      res.json({
        leaseId: result.leaseId,
        expiresAt: result.expiresAt.toISOString(),
      });
    } catch (e) {
      fail(res, e);
    }
  });

  // 釋放靶機（離開關卡時呼叫；逾時也會由系統自動回收）
  app.post("/api/device-lease/release", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "unauthenticated" });

      const parsed = releaseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "bad_request", message: "參數格式錯誤" });
      }

      const released = await releaseLease(parsed.data.deviceId, userId);
      res.json({ released });
    } catch (e) {
      fail(res, e);
    }
  });
}
