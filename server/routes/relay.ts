// 接力路由 (Relay) — 接力模式專用 API
//
// 🏃 2026-09-23 業主：「接力依頁面分段」
//   分段在遊戲設定（games.match_config.relaySegments），建賽時拍快照；
//   開賽自動依加入順序分棒、當棒完成遊戲場次自動交棒（relay-lifecycle）。
//   舊的「房主手動分段」/「前端指定下一棒」入口停用（未驗證、會被亂傳棒）。
import type { Express, RequestHandler } from "express";
import { isAuthenticated } from "../firebaseAuth";
import type { RouteContext, AuthenticatedRequest } from "./types";
import { validateId } from "./utils";
import { getMatch } from "../services/match-lobby";
import { loadMatchRanking } from "../services/match-lifecycle";
import { getMyRelayLeg, relayLegsOf } from "../services/relay-lifecycle";

export function registerRelayRoutes(app: Express, _ctx: RouteContext) {
  app.get("/api/matches/:matchId/relay/status", async (req, res) => {
    try {
      const matchId = validateId(req.params.matchId, res);
      if (!matchId) return;
      const match = await getMatch(matchId);
      if (!match) return res.status(404).json({ error: "對戰不存在" });
      if (match.matchMode !== "relay") return res.status(400).json({ error: "這場不是接力賽" });

      const ranking = await loadMatchRanking(matchId);
      const legs = relayLegsOf(match);
      const active = ranking.find((r) => r.relayStatus === "active");
      return res.json({
        matchId,
        status: match.status,
        totalSegments: legs.length,
        completedSegments: ranking.filter((r) => r.relayStatus === "completed").length,
        activeSegment: active?.relaySegment ?? null,
        teamTotal: ranking.reduce((sum, r) => sum + r.score, 0),
        legs: legs.map((leg) => {
          const runner = ranking.find((r) => r.relaySegment === leg.segment);
          return {
            ...leg,
            userId: runner?.userId ?? null,
            displayName: runner?.displayName ?? null,
            status: runner?.relayStatus ?? "pending",
            score: runner?.score ?? 0,
          };
        }),
      });
    } catch (error) {
      return res.status(500).json({ error: "取得接力進度失敗" });
    }
  });

  app.get("/api/matches/:matchId/relay/me", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "未認證" });
      const matchId = validateId(req.params.matchId, res);
      if (!matchId) return;
      const match = await getMatch(matchId);
      if (!match) return res.status(404).json({ error: "對戰不存在" });
      return res.json(await getMyRelayLeg(match, userId));
    } catch (error) {
      return res.status(500).json({ error: "取得我的棒次失敗" });
    }
  });

  // 🗑️ 2026-09-23 停用：分段改由遊戲設定決定、交棒改由完成遊戲場次自動觸發
  const gone = (message: string): RequestHandler => (_req, res) => {
    res.status(410).json({ error: "gone", message });
  };
  app.post("/api/matches/:matchId/relay/assign", isAuthenticated, gone("接力分段改在遊戲設定裡設定，開賽時自動分配"));
  app.post("/api/matches/:matchId/relay/handoff", isAuthenticated, gone("完成自己那一段會自動交棒，不需要手動傳棒"));
}
