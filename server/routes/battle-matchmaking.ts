// 水彈對戰 PK 擂台 — 配對路由
import type { Express } from "express";
import { requireAdminAuth } from "../adminAuth";
import { battleStorageMethods } from "../storage/battle-storage";
import { assignTeams } from "../services/battle-matchmaking";
import type { RouteContext } from "./types";

export function registerBattleMatchmakingRoutes(app: Express, ctx: RouteContext) {
  // ============================================================================
  // POST /api/battle/slots/:slotId/matchmake — 執行隊伍配對（管理員）
  // ============================================================================
  app.post(
    "/api/battle/slots/:slotId/matchmake",
    requireAdminAuth,
    async (req, res) => {
      try {
        if (!req.admin) {
          return res.status(401).json({ error: "未認證" });
        }

        const { slotId } = req.params;

        // 取得時段
        const slot = await battleStorageMethods.getSlot(slotId);
        if (!slot) {
          return res.status(404).json({ error: "時段不存在" });
        }

        // 只有 confirmed 或 full 狀態才能配對
        if (slot.status !== "confirmed" && slot.status !== "full") {
          return res.status(400).json({ error: "時段尚未達到可配對狀態" });
        }

        // 取得場地
        const venue = await battleStorageMethods.getVenue(slot.venueId);
        if (!venue) {
          return res.status(404).json({ error: "場地不存在" });
        }

        // 權限檢查
        if (venue.fieldId !== req.admin.fieldId && req.admin.systemRole !== "super_admin") {
          return res.status(403).json({ error: "無權限操作此場地" });
        }

        // 取得報名與預組小隊
        const registrations = await battleStorageMethods.getRegistrationsBySlot(slotId);
        const premadeGroups = await battleStorageMethods.getPremadeGroupsBySlot(slotId);

        // 執行配對
        const result = assignTeams(registrations, premadeGroups, venue, slot);

        // 更新每位玩家的 assignedTeam
        for (const team of result.teams) {
          for (const member of team.members) {
            await battleStorageMethods.updateRegistration(member.registrationId, {
              assignedTeam: team.teamName,
            });
          }
        }

        // 透過 WebSocket 廣播配對結果
        ctx.broadcastToBattleSlot(slotId, {
          type: "battle_teams_assigned",
          slotId,
          teams: result.teams.map((t) => ({
            teamName: t.teamName,
            memberCount: t.members.length,
            members: t.members.map((m) => m.userId),
          })),
          timestamp: new Date().toISOString(),
        });

        res.json(result);
      } catch {
        res.status(500).json({ error: "配對失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/battle/slots/:slotId/teams — 取得配對結果
  // ============================================================================
  app.get("/api/battle/slots/:slotId/teams", async (req, res) => {
    try {
      const registrations = await battleStorageMethods.getRegistrationsBySlot(req.params.slotId);

      // 按 assignedTeam 分組
      const teamMap = new Map<string, typeof registrations>();
      for (const reg of registrations) {
        if (reg.assignedTeam && reg.status !== "cancelled") {
          if (!teamMap.has(reg.assignedTeam)) {
            teamMap.set(reg.assignedTeam, []);
          }
          teamMap.get(reg.assignedTeam)!.push(reg);
        }
      }

      const teams = Array.from(teamMap.entries()).map(([name, members]) => ({
        teamName: name,
        memberCount: members.length,
        members: members.map((m) => ({
          userId: m.userId,
          registrationId: m.id,
          status: m.status,
          skillLevel: m.skillLevel,
        })),
      }));

      const unassigned = registrations.filter(
        (r) => !r.assignedTeam && r.status !== "cancelled",
      );

      res.json({ teams, unassigned: unassigned.map((r) => r.userId) });
    } catch {
      res.status(500).json({ error: "取得配對結果失敗" });
    }
  });
}
