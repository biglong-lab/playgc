/**
 * 賈村競技體驗場 - 設備管理 API 路由
 * 
 * 檔案位置: server/routes/deviceRoutes.ts
 * 
 * 需要加入到 server/routes.ts 中
 */

import type { Express } from "express";
import { db } from "../db";
import { arduinoDevices, shootingRecords, deviceLogs } from "@db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { 
  sendControlCommand, 
  updateDeviceConfig, 
  controlDeviceLED 
} from "../services/mqttService";

/**
 * 註冊設備管理相關的 API 路由
 */
export function registerDeviceRoutes(app: Express) {
  
  // ==================== 設備管理 ====================
  
  /**
   * GET /api/devices
   * 取得所有設備列表
   */
  app.get("/api/devices", async (req, res) => {
    try {
      const devices = await db
        .select()
        .from(arduinoDevices)
        .orderBy(desc(arduinoDevices.createdAt));
      
      res.json(devices);
    } catch (error: any) {
      console.error("取得設備列表失敗:", error);
      res.status(500).json({ error: "取得設備列表失敗", message: error.message });
    }
  });
  
  /**
   * GET /api/devices/:deviceId
   * 取得單一設備詳細資訊
   */
  app.get("/api/devices/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      const device = await db
        .select()
        .from(arduinoDevices)
        .where(eq(arduinoDevices.deviceId, deviceId))
        .limit(1);
      
      if (device.length === 0) {
        return res.status(404).json({ error: "設備不存在" });
      }
      
      res.json(device[0]);
    } catch (error: any) {
      console.error("取得設備資訊失敗:", error);
      res.status(500).json({ error: "取得設備資訊失敗", message: error.message });
    }
  });
  
  /**
   * POST /api/devices
   * 註冊新設備
   */
  app.post("/api/devices", async (req, res) => {
    try {
      const { deviceId, deviceName, deviceType, location } = req.body;
      
      if (!deviceId || !deviceName) {
        return res.status(400).json({ error: "缺少必要欄位: deviceId, deviceName" });
      }
      
      // 檢查設備是否已存在
      const existing = await db
        .select()
        .from(arduinoDevices)
        .where(eq(arduinoDevices.deviceId, deviceId))
        .limit(1);
      
      if (existing.length > 0) {
        return res.status(409).json({ error: "設備 ID 已存在" });
      }
      
      // 建立新設備
      const newDevice = await db
        .insert(arduinoDevices)
        .values({
          deviceId,
          deviceName,
          deviceType: deviceType || 'shooting_target',
          location: location || null,
          status: 'offline',
        })
        .returning();
      
      res.status(201).json(newDevice[0]);
    } catch (error: any) {
      console.error("註冊設備失敗:", error);
      res.status(500).json({ error: "註冊設備失敗", message: error.message });
    }
  });
  
  /**
   * PATCH /api/devices/:deviceId
   * 更新設備資訊
   */
  app.patch("/api/devices/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { deviceName, location } = req.body;
      
      const updated = await db
        .update(arduinoDevices)
        .set({
          deviceName,
          location,
          updatedAt: new Date(),
        })
        .where(eq(arduinoDevices.deviceId, deviceId))
        .returning();
      
      if (updated.length === 0) {
        return res.status(404).json({ error: "設備不存在" });
      }
      
      res.json(updated[0]);
    } catch (error: any) {
      console.error("更新設備資訊失敗:", error);
      res.status(500).json({ error: "更新設備資訊失敗", message: error.message });
    }
  });
  
  /**
   * DELETE /api/devices/:deviceId
   * 刪除設備
   */
  app.delete("/api/devices/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      await db
        .delete(arduinoDevices)
        .where(eq(arduinoDevices.deviceId, deviceId));
      
      res.json({ message: "設備已刪除" });
    } catch (error: any) {
      console.error("刪除設備失敗:", error);
      res.status(500).json({ error: "刪除設備失敗", message: error.message });
    }
  });
  
  // ==================== 設備控制 ====================
  
  /**
   * POST /api/devices/:deviceId/control
   * 發送控制指令到設備
   */
  app.post("/api/devices/:deviceId/control", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { command, ...params } = req.body;
      
      if (!command) {
        return res.status(400).json({ error: "缺少 command 參數" });
      }
      
      // 檢查設備是否存在
      const device = await db
        .select()
        .from(arduinoDevices)
        .where(eq(arduinoDevices.deviceId, deviceId))
        .limit(1);
      
      if (device.length === 0) {
        return res.status(404).json({ error: "設備不存在" });
      }
      
      // 發送 MQTT 指令
      sendControlCommand(deviceId, command, params);
      
      res.json({ 
        message: "控制指令已發送",
        deviceId,
        command,
        params 
      });
    } catch (error: any) {
      console.error("發送控制指令失敗:", error);
      res.status(500).json({ error: "發送控制指令失敗", message: error.message });
    }
  });
  
  /**
   * POST /api/devices/:deviceId/led
   * 控制設備 LED
   */
  app.post("/api/devices/:deviceId/led", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { color, mode } = req.body;
      
      if (!color) {
        return res.status(400).json({ error: "缺少 color 參數" });
      }
      
      controlDeviceLED(deviceId, color, mode || 'solid');
      
      res.json({ 
        message: "LED 控制指令已發送",
        deviceId,
        color,
        mode: mode || 'solid'
      });
    } catch (error: any) {
      console.error("控制 LED 失敗:", error);
      res.status(500).json({ error: "控制 LED 失敗", message: error.message });
    }
  });
  
  /**
   * POST /api/devices/:deviceId/config
   * 更新設備設定
   */
  app.post("/api/devices/:deviceId/config", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const config = req.body;
      
      updateDeviceConfig(deviceId, config);
      
      res.json({ 
        message: "設備設定已更新",
        deviceId,
        config 
      });
    } catch (error: any) {
      console.error("更新設備設定失敗:", error);
      res.status(500).json({ error: "更新設備設定失敗", message: error.message });
    }
  });
  
  // ==================== 射擊記錄 ====================
  
  /**
   * GET /api/devices/:deviceId/shooting-records
   * 取得設備的射擊記錄
   */
  app.get("/api/devices/:deviceId/shooting-records", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { limit = 100, gameSessionId } = req.query;
      
      let query = db
        .select()
        .from(shootingRecords)
        .where(eq(shootingRecords.deviceId, deviceId))
        .orderBy(desc(shootingRecords.hitTimestamp))
        .limit(parseInt(limit as string));
      
      // 如果有指定 gameSessionId,只取該遊戲的記錄
      if (gameSessionId) {
        query = db
          .select()
          .from(shootingRecords)
          .where(
            and(
              eq(shootingRecords.deviceId, deviceId),
              eq(shootingRecords.gameSessionId, parseInt(gameSessionId as string))
            )
          )
          .orderBy(desc(shootingRecords.hitTimestamp))
          .limit(parseInt(limit as string));
      }
      
      const records = await query;
      
      res.json(records);
    } catch (error: any) {
      console.error("取得射擊記錄失敗:", error);
      res.status(500).json({ error: "取得射擊記錄失敗", message: error.message });
    }
  });
  
  /**
   * GET /api/devices/:deviceId/statistics
   * 取得設備統計資訊
   */
  app.get("/api/devices/:deviceId/statistics", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { days = 7 } = req.query;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days as string));
      
      // 取得統計資料
      const records = await db
        .select()
        .from(shootingRecords)
        .where(
          and(
            eq(shootingRecords.deviceId, deviceId),
            gte(shootingRecords.hitTimestamp, startDate)
          )
        );
      
      const totalHits = records.length;
      const totalScore = records.reduce((sum, r) => sum + (r.score || 0), 0);
      const avgScore = totalHits > 0 ? totalScore / totalHits : 0;
      
      res.json({
        deviceId,
        period: `最近 ${days} 天`,
        totalHits,
        totalScore,
        avgScore: Math.round(avgScore * 100) / 100,
        records: records.length,
      });
    } catch (error: any) {
      console.error("取得設備統計失敗:", error);
      res.status(500).json({ error: "取得設備統計失敗", message: error.message });
    }
  });
  
  // ==================== 設備日誌 ====================
  
  /**
   * GET /api/devices/:deviceId/logs
   * 取得設備日誌
   */
  app.get("/api/devices/:deviceId/logs", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { limit = 100, logType } = req.query;
      
      let query = db
        .select()
        .from(deviceLogs)
        .where(eq(deviceLogs.deviceId, deviceId))
        .orderBy(desc(deviceLogs.createdAt))
        .limit(parseInt(limit as string));
      
      // 如果有指定 logType,只取該類型的日誌
      if (logType) {
        query = db
          .select()
          .from(deviceLogs)
          .where(
            and(
              eq(deviceLogs.deviceId, deviceId),
              eq(deviceLogs.logType, logType as string)
            )
          )
          .orderBy(desc(deviceLogs.createdAt))
          .limit(parseInt(limit as string));
      }
      
      const logs = await query;
      
      res.json(logs);
    } catch (error: any) {
      console.error("取得設備日誌失敗:", error);
      res.status(500).json({ error: "取得設備日誌失敗", message: error.message });
    }
  });
}
