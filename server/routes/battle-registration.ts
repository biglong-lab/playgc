// 水彈對戰 PK 擂台 — 報名 & 預組小隊路由
import type { Express } from "express";
import { isAuthenticated } from "../firebaseAuth";
import { requireAdminAuth } from "../adminAuth";
import { battleStorageMethods, getUpcomingRegistrationsWithDetails } from "../storage/battle-storage";
import type { AuthenticatedRequest } from "./types";
import { insertRegistrationSchema, insertPremadeGroupSchema } from "@shared/schema";
import { z } from "zod";

/** 產生 6 碼英數大寫邀請碼 */
function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function registerBattleRegistrationRoutes(app: Express) {
  // ============================================================================
  // POST /api/battle/slots/:slotId/register — 個人報名
  // ============================================================================
  app.post(
    "/api/battle/slots/:slotId/register",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: "未認證" });
        }
        const userId = req.user.dbUser.id;
        const { slotId } = req.params;

        // 驗證時段
        const slot = await battleStorageMethods.getSlot(slotId);
        if (!slot) {
          return res.status(404).json({ error: "時段不存在" });
        }
        if (slot.status !== "open" && slot.status !== "confirmed") {
          return res.status(400).json({ error: "此時段不開放報名" });
        }

        // 檢查是否已報名
        const existing = await battleStorageMethods.getRegistration(slotId, userId);
        if (existing && existing.status !== "cancelled") {
          return res.status(409).json({ error: "您已報名此時段" });
        }

        // 檢查人數上限
        const venue = await battleStorageMethods.getVenue(slot.venueId);
        if (!venue) {
          return res.status(404).json({ error: "場地不存在" });
        }
        const maxPlayers = slot.maxPlayersOverride ?? venue.maxPlayers;
        const activeCount = await battleStorageMethods.getActiveRegistrationCount(slotId);
        if (activeCount >= maxPlayers) {
          return res.status(400).json({ error: "此時段已額滿" });
        }

        // 解析選填欄位
        const body = insertRegistrationSchema.parse(req.body);

        const registration = await battleStorageMethods.createRegistration({
          slotId,
          userId,
          registrationType: "individual",
          status: "registered",
          skillLevel: body.skillLevel,
          equipmentSelection: body.equipmentSelection ?? [],
          notes: body.notes,
        });

        // 更新時段計數
        await battleStorageMethods.updateSlotCount(slotId, 1);

        // 檢查是否達到最低人數 → 自動更新狀態為 confirmed
        const minPlayers = slot.minPlayersOverride ?? venue.minPlayers;
        if (activeCount + 1 >= minPlayers && slot.status === "open") {
          await battleStorageMethods.updateSlot(slotId, { status: "confirmed" });
        }
        // 檢查是否已滿
        if (activeCount + 1 >= maxPlayers) {
          await battleStorageMethods.updateSlot(slotId, { status: "full" });
        }

        res.status(201).json(registration);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "資料驗證失敗", details: error.errors });
        }
        res.status(500).json({ error: "報名失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/battle/slots/:slotId/cancel — 取消報名
  // ============================================================================
  app.post(
    "/api/battle/slots/:slotId/cancel",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: "未認證" });
        }
        const userId = req.user.dbUser.id;
        const { slotId } = req.params;

        const registration = await battleStorageMethods.getRegistration(slotId, userId);
        if (!registration || registration.status === "cancelled") {
          return res.status(404).json({ error: "找不到您的報名紀錄" });
        }
        if (registration.status === "checked_in") {
          return res.status(400).json({ error: "已報到的報名無法取消" });
        }

        await battleStorageMethods.updateRegistration(registration.id, {
          status: "cancelled",
          cancelledAt: new Date(),
        });

        // 更新時段計數
        await battleStorageMethods.updateSlotCount(slotId, -1);

        // 如果是預組隊員，更新小隊人數
        if (registration.premadeGroupId) {
          await battleStorageMethods.updatePremadeGroupCount(registration.premadeGroupId, -1);
        }

        // 時段狀態回退：full → confirmed, confirmed → open
        const slot = await battleStorageMethods.getSlot(slotId);
        if (slot) {
          const venue = await battleStorageMethods.getVenue(slot.venueId);
          if (venue) {
            const currentActive = await battleStorageMethods.getActiveRegistrationCount(slotId);
            const minPlayers = slot.minPlayersOverride ?? venue.minPlayers;
            if (slot.status === "full") {
              await battleStorageMethods.updateSlot(slotId, { status: "confirmed" });
            } else if (slot.status === "confirmed" && currentActive < minPlayers) {
              await battleStorageMethods.updateSlot(slotId, { status: "open" });
            }
          }
        }

        res.json({ message: "已取消報名" });
      } catch {
        res.status(500).json({ error: "取消報名失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/battle/my-registrations — 我的報名列表
  // ============================================================================
  app.get(
    "/api/battle/my-registrations",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: "未認證" });
        }
        const rows = await getUpcomingRegistrationsWithDetails(req.user.dbUser.id);
        const registrations = rows.map((row) => ({
          ...row.registration,
          slotDate: row.slotDate,
          startTime: row.startTime,
          endTime: row.endTime,
          slotStatus: row.slotStatus,
          venueName: row.venueName,
        }));
        res.json(registrations);
      } catch {
        res.status(500).json({ error: "取得報名列表失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/battle/slots/:slotId/premade — 建立預組小隊
  // ============================================================================
  app.post(
    "/api/battle/slots/:slotId/premade",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: "未認證" });
        }
        const userId = req.user.dbUser.id;
        const { slotId } = req.params;

        // 驗證時段
        const slot = await battleStorageMethods.getSlot(slotId);
        if (!slot) {
          return res.status(404).json({ error: "時段不存在" });
        }
        if (slot.status !== "open" && slot.status !== "confirmed") {
          return res.status(400).json({ error: "此時段不開放報名" });
        }

        // 隊長自己也需要先報名
        const existing = await battleStorageMethods.getRegistration(slotId, userId);
        if (!existing || existing.status === "cancelled") {
          return res.status(400).json({ error: "請先報名此時段再建立小隊" });
        }

        const body = insertPremadeGroupSchema.parse(req.body);
        const accessCode = generateAccessCode();

        const group = await battleStorageMethods.createPremadeGroup({
          slotId,
          leaderId: userId,
          name: body.name,
          accessCode,
          keepTogether: body.keepTogether,
          memberCount: 1,
        });

        // 更新隊長的報名紀錄
        await battleStorageMethods.updateRegistration(existing.id, {
          premadeGroupId: group.id,
          registrationType: "premade_leader",
        });

        res.status(201).json(group);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "資料驗證失敗", details: error.errors });
        }
        res.status(500).json({ error: "建立小隊失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/battle/premade/join — 用邀請碼加入預組小隊
  // ============================================================================
  app.post(
    "/api/battle/premade/join",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: "未認證" });
        }
        const userId = req.user.dbUser.id;
        const { accessCode } = req.body as { accessCode: string };

        if (!accessCode || typeof accessCode !== "string") {
          return res.status(400).json({ error: "缺少邀請碼" });
        }

        // 查詢小隊
        const group = await battleStorageMethods.getPremadeGroupByCode(accessCode);
        if (!group) {
          return res.status(404).json({ error: "邀請碼無效" });
        }

        const slotId = group.slotId;

        // 檢查時段狀態
        const slot = await battleStorageMethods.getSlot(slotId);
        if (!slot) {
          return res.status(404).json({ error: "時段不存在" });
        }
        if (slot.status !== "open" && slot.status !== "confirmed") {
          return res.status(400).json({ error: "此時段不開放報名" });
        }

        // 檢查是否已報名
        const existing = await battleStorageMethods.getRegistration(slotId, userId);
        if (existing && existing.status !== "cancelled") {
          return res.status(409).json({ error: "您已報名此時段" });
        }

        // 檢查人數上限
        const venue = await battleStorageMethods.getVenue(slot.venueId);
        if (!venue) {
          return res.status(404).json({ error: "場地不存在" });
        }
        const maxPlayers = slot.maxPlayersOverride ?? venue.maxPlayers;
        const activeCount = await battleStorageMethods.getActiveRegistrationCount(slotId);
        if (activeCount >= maxPlayers) {
          return res.status(400).json({ error: "此時段已額滿" });
        }

        // 建立報名（帶 premadeGroupId）
        const registration = await battleStorageMethods.createRegistration({
          slotId,
          userId,
          registrationType: "premade_member",
          status: "registered",
          premadeGroupId: group.id,
        });

        // 更新計數
        await battleStorageMethods.updateSlotCount(slotId, 1);
        await battleStorageMethods.updatePremadeGroupCount(group.id, 1);

        // 自動狀態轉換
        const minPlayers = slot.minPlayersOverride ?? venue.minPlayers;
        if (activeCount + 1 >= maxPlayers) {
          await battleStorageMethods.updateSlot(slotId, { status: "full" });
        } else if (activeCount + 1 >= minPlayers && slot.status === "open") {
          await battleStorageMethods.updateSlot(slotId, { status: "confirmed" });
        }

        res.status(201).json({ registration, group: { id: group.id, name: group.name } });
      } catch {
        res.status(500).json({ error: "加入小隊失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/battle/registrations/:id/confirm — 確認出席
  // ============================================================================
  app.post(
    "/api/battle/registrations/:id/confirm",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: "未認證" });
        }

        // 先查詢報名紀錄並驗證所有權
        const registration = await battleStorageMethods.getRegistrationById(req.params.id);
        if (!registration) {
          return res.status(404).json({ error: "報名紀錄不存在" });
        }
        if (registration.userId !== req.user.dbUser.id) {
          return res.status(403).json({ error: "無權限操作此報名" });
        }
        if (registration.status !== "registered") {
          return res.status(400).json({ error: "此報名狀態無法確認出席" });
        }

        const updated = await battleStorageMethods.updateRegistration(req.params.id, {
          status: "confirmed",
          confirmedAt: new Date(),
        });

        if (!updated) {
          return res.status(404).json({ error: "更新報名失敗" });
        }

        // 更新時段已確認人數
        await battleStorageMethods.updateSlotConfirmedCount(updated.slotId, 1);

        res.json(updated);
      } catch {
        res.status(500).json({ error: "確認出席失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/battle/registrations/:id/checkin — 現場報到（管理員掃碼）
  // ============================================================================
  app.post(
    "/api/battle/registrations/:id/checkin",
    requireAdminAuth,
    async (req, res) => {
      try {
        if (!req.admin) {
          return res.status(401).json({ error: "未認證" });
        }

        const updated = await battleStorageMethods.updateRegistration(req.params.id, {
          status: "checked_in",
          checkedInAt: new Date(),
        });

        if (!updated) {
          return res.status(404).json({ error: "報名紀錄不存在" });
        }

        res.json(updated);
      } catch {
        res.status(500).json({ error: "報到失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/battle/slots/:slotId/registrations — 取得時段報名列表（管理員）
  // ============================================================================
  app.get(
    "/api/battle/slots/:slotId/registrations",
    requireAdminAuth,
    async (req, res) => {
      try {
        const registrations = await battleStorageMethods.getRegistrationsBySlot(req.params.slotId);
        const premadeGroups = await battleStorageMethods.getPremadeGroupsBySlot(req.params.slotId);
        res.json({ registrations, premadeGroups });
      } catch {
        res.status(500).json({ error: "取得報名列表失敗" });
      }
    },
  );
}
