// 🎟️ 訪客紀錄認領 API（2026-09-22 玩家動線優化 Phase 3）
//   POST /api/me/guest-claim-ticket — 訪客（匿名）呼叫：取得 30 分鐘認領憑證
//   POST /api/me/claim-guest        — 正式帳號呼叫：帶憑證把訪客紀錄搬過來
// 流程與設計見 server/services/guest-claim.ts
import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../firebaseAuth";
import { storage } from "../storage";
import { guestClaimLimiter } from "../utils/rate-limiters";
import { createClaimTicket, verifyClaimTicket, claimGuestRecords } from "../services/guest-claim";
import type { AuthenticatedRequest } from "./types";

const claimBodySchema = z.object({ ticket: z.string().min(10).max(1024) });

function isAnonymousRequest(req: AuthenticatedRequest): boolean {
  return req.user?.claims?.signInProvider === "anonymous";
}

export function registerGuestClaimRoutes(app: Express) {
  app.post(
    "/api/me/guest-claim-ticket",
    isAuthenticated,
    guestClaimLimiter,
    async (req: AuthenticatedRequest, res) => {
      const uid = req.user?.claims?.sub;
      if (!uid) return res.status(401).json({ error: "unauthorized", message: "未認證" });
      if (!isAnonymousRequest(req)) {
        return res.status(400).json({ error: "not_guest", message: "只有訪客身分需要保存紀錄" });
      }
      try {
        res.json({ success: true, ticket: createClaimTicket(uid) });
      } catch (err) {
        console.error("[guest-claim] 簽發憑證失敗:", err);
        res.status(503).json({ error: "unavailable", message: "暫時無法保存紀錄，請稍後再試" });
      }
    },
  );

  app.post(
    "/api/me/claim-guest",
    isAuthenticated,
    guestClaimLimiter,
    async (req: AuthenticatedRequest, res) => {
      const realUid = req.user?.claims?.sub;
      if (!realUid) return res.status(401).json({ error: "unauthorized", message: "未認證" });
      if (isAnonymousRequest(req)) {
        return res.status(400).json({ error: "still_guest", message: "請先登入正式帳號" });
      }
      const parsed = claimBodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_ticket", message: "認領憑證格式錯誤" });

      const anonUid = verifyClaimTicket(parsed.data.ticket);
      if (!anonUid) {
        return res.status(400).json({ error: "invalid_ticket", message: "保存連結已失效，請重新操作" });
      }
      // 同一個帳號（例如訪客已直接升級）→ 不需搬移
      if (anonUid === realUid) return res.json({ success: true, moved: {} });

      try {
        // 雙保險：憑證對應的帳號必須是訪客（假信箱），避免把正式帳號的資料搬走
        const guest = await storage.getUser(anonUid);
        if (!guest?.email?.endsWith("@firebase.local")) {
          return res.status(400).json({ error: "invalid_ticket", message: "保存連結已失效，請重新操作" });
        }
        const moved = await claimGuestRecords(anonUid, realUid);
        res.json({ success: true, moved });
      } catch (err) {
        console.error("[guest-claim] 認領失敗:", err);
        res.status(500).json({ error: "claim_failed", message: "保存紀錄失敗，請稍後再試" });
      }
    },
  );
}
