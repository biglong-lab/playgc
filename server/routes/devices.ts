import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import { mqttService } from "../mqttService";
import { insertArduinoDeviceSchema, insertShootingRecordSchema } from "@shared/schema";
import { z } from "zod";
import { requireAdminRole, getManageableFields } from "./utils";
import { sendDeviceCommand } from "../mqtt/command-service";
import { getMqttStatus as getV1MqttStatus } from "../mqtt";
import { hotPathLimiter } from "../utils/rate-limiters";
import { enrichShootingRecordForBroadcast } from "../lib/shooting-broadcast";
import type { RouteContext, AuthenticatedRequest } from "./types";

export function registerDeviceRoutes(app: Express, ctx: RouteContext) {
  app.get("/api/devices", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      const devices = await storage.getArduinoDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });

  // 廣播路由必須在 :id 動態路由之前，避免被 /api/devices/:id 攔截
  app.post("/api/devices/broadcast/led", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      const { mode, color } = req.body;

      if (mode === "solid" || mode === "on") {
        mqttService.turnOnAllLEDs(color);
        res.json({ message: "LED on command broadcast to all devices" });
      } else if (mode === "off") {
        mqttService.turnOffAllLEDs();
        res.json({ message: "LED off command broadcast to all devices" });
      } else {
        return res.status(400).json({ message: "Invalid mode. Use: solid, off" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to broadcast LED command" });
    }
  });

  app.post("/api/devices/broadcast/ping", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      await mqttService.pingAllDevices();
      res.json({ message: "Ping command broadcast to all devices" });
    } catch (error) {
      res.status(500).json({ message: "Failed to ping all devices" });
    }
  });

  app.get("/api/devices/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      const device = await storage.getArduinoDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      res.json(device);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch device" });
    }
  });

  app.post("/api/devices", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      const data = insertArduinoDeviceSchema.parse(req.body);

      // 🔑 硬體 ID 必填：MQTT 心跳與命中都靠它比對，缺了設備等於廢的
      if (!data.deviceId?.trim()) {
        return res
          .status(400)
          .json({ message: "請填寫硬體 ID（例如 TARGET_001）" });
      }
      // 硬體 ID 會進 MQTT topic，限制字元避免 wildcard 注入
      if (!/^[A-Za-z0-9_-]{1,50}$/.test(data.deviceId)) {
        return res
          .status(400)
          .json({ message: "硬體 ID 只能使用英數字、底線與連字號" });
      }

      // 🔑 場域歸屬：MQTT 收訊會比對「裝置↔場域」，未綁場域的設備收不到命中
      const scope = await getManageableFields(req);
      if (!data.fieldId) {
        return res.status(400).json({ message: "請選擇設備所屬場域" });
      }
      if (!scope.all && !scope.fieldIds.includes(data.fieldId)) {
        return res.status(403).json({ message: "無權在此場域建立設備" });
      }

      const device = await storage.createArduinoDevice(data);
      res.status(201).json(device);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create device" });
    }
  });

  app.patch("/api/devices/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      const data = insertArduinoDeviceSchema.partial().parse(req.body);
      const device = await storage.updateArduinoDevice(req.params.id, data);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      res.json(device);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update device" });
    }
  });

  app.delete("/api/devices/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      await storage.deleteArduinoDevice(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete device" });
    }
  });

  app.get("/api/mqtt/status", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      const status = getV1MqttStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get MQTT status" });
    }
  });

  app.post("/api/devices/:id/activate", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) return res.status(403).json({ message: auth.message });

      const device = await storage.getArduinoDevice(req.params.id);
      if (!device) return res.status(404).json({ message: "找不到設備" });
      if (!device.deviceId || !device.fieldId) {
        return res.status(400).json({ message: "設備缺少硬體 ID 或場域綁定" });
      }
      if (device.status !== "online") {
        return res.status(409).json({
          message: "設備目前離線，無法發送指令（請先確認韌體已連上 broker）",
        });
      }

      const result = await sendDeviceCommand(device.fieldId, device.deviceId, {
        command: "start_session",
      });
      if (!result.ok) return res.status(result.status).json({ message: result.message });
      res.json({ message: "啟動指令已發送", deviceId: device.deviceId });
    } catch (error) {
      res.status(500).json({ message: "啟動失敗" });
    }
  });

  app.post("/api/devices/:id/deactivate", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) return res.status(403).json({ message: auth.message });

      const device = await storage.getArduinoDevice(req.params.id);
      if (!device) return res.status(404).json({ message: "找不到設備" });
      if (!device.deviceId || !device.fieldId) {
        return res.status(400).json({ message: "設備缺少硬體 ID 或場域綁定" });
      }
      if (device.status !== "online") {
        return res.status(409).json({ message: "設備目前離線，無法發送指令" });
      }

      const result = await sendDeviceCommand(device.fieldId, device.deviceId, {
        command: "end_session",
      });
      if (!result.ok) return res.status(result.status).json({ message: result.message });
      res.json({ message: "停用指令已發送", deviceId: device.deviceId });
    } catch (error) {
      res.status(500).json({ message: "停用失敗" });
    }
  });

  app.post("/api/devices/:id/session", isAuthenticated, async (req, res) => {
    try {
      const { sessionId, action, config } = req.body;

      if (!sessionId) {
        return res.status(400).json({ message: "sessionId is required" });
      }

      const device = await storage.getArduinoDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      let success = false;
      if (action === "start") {
        success = mqttService.startSession(req.params.id, sessionId, config);
      } else if (action === "end") {
        success = mqttService.endSession(req.params.id, sessionId);
      } else {
        return res.status(400).json({ message: "Invalid action. Use 'start' or 'end'" });
      }

      if (success) {
        res.json({ message: `Session ${action} command sent`, deviceId: req.params.id, sessionId });
      } else {
        res.status(503).json({ message: "MQTT not connected" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to control device session" });
    }
  });

  // 🔒 Critical #7 修：射擊記錄端點加 device API key 驗證 + rate limit
  // 之前任何人取得 deviceId 都能無限 POST 假分數，現在必須帶 X-Device-Key
  // header（device firmware 燒入），key 由 admin 端註冊時產生。
  app.post(
    "/api/shooting-records",
    hotPathLimiter, // 🔒 加 rate limit 防 spam（每 IP 60 req/min）
    async (req, res) => {
    try {
      const data = insertShootingRecordSchema.parse(req.body);

      // 驗證設備 ID 是否為有效的已註冊設備
      if (!data.deviceId) {
        return res.status(400).json({ message: "deviceId 為必填欄位" });
      }

      const device = await storage.getArduinoDevice(data.deviceId);
      if (!device) {
        return res.status(403).json({ message: "無效的設備 ID，設備未註冊" });
      }

      // 🔒 Critical #7：device API key 驗證（防止任何人偽造 deviceId）
      // 過渡期：若 device 沒設 apiKey 則允許（向後相容），但記 warning log
      // Phase 1: 新設備強制要 apiKey
      // Phase 2: 所有設備都必須有 apiKey
      const providedKey = req.headers["x-device-key"] as string | undefined;
      const deviceKey = (device as any).apiKey as string | undefined;
      if (deviceKey) {
        // 設備已配 key — 強制驗證
        if (!providedKey || providedKey !== deviceKey) {
          console.warn(
            `[shooting-records] 拒絕：device ${data.deviceId} apiKey mismatch`,
          );
          return res.status(401).json({ message: "device apiKey 驗證失敗" });
        }
      } else {
        // 過渡期：device 未配 key，記 warning（提醒 admin 補上）
        console.warn(
          `[shooting-records] ⚠️  device ${data.deviceId} 未設 apiKey（建議盡快補上）`,
        );
      }

      // 驗證 sessionId 是否有效（如果提供）
      if (data.sessionId) {
        const session = await storage.getSession(data.sessionId);
        if (!session) {
          return res.status(400).json({ message: "無效的 session ID" });
        }
      }

      const record = await storage.createShootingRecord(data);

      if (data.sessionId) {
        // 🆕 Phase A2：補 displayName 給 ShootingTeam 排行榜用
        const enriched = await enrichShootingRecordForBroadcast(record);
        ctx.broadcastToSession(data.sessionId, {
          type: "shooting_hit",
          record: enriched,
        });
      }

      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create shooting record" });
    }
  });

  app.get("/api/shooting-records/:sessionId", isAuthenticated, async (req, res) => {
    try {
      const records = await storage.getShootingRecords(req.params.sessionId);
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shooting records" });
    }
  });

  app.get("/api/devices/:id/shooting-records", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      const device = await storage.getArduinoDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const records = await storage.getShootingRecordsByDevice(device.deviceId || req.params.id, limit);
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch device shooting records" });
    }
  });

  app.get("/api/devices/:id/statistics", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      const device = await storage.getArduinoDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      const days = parseInt(req.query.days as string) || 7;
      const stats = await storage.getShootingRecordStatistics(device.deviceId || req.params.id, days);
      res.json({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        period: `${days} days`,
        ...stats,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch device statistics" });
    }
  });

  app.get("/api/devices/:id/logs", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      const device = await storage.getArduinoDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const logType = req.query.type as string | undefined;
      const logs = await storage.getDeviceLogs(device.deviceId || req.params.id, limit, logType);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch device logs" });
    }
  });

  app.post("/api/devices/:id/led", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) return res.status(403).json({ message: auth.message });

      const device = await storage.getArduinoDevice(req.params.id);
      if (!device) return res.status(404).json({ message: "找不到設備" });
      if (!device.deviceId || !device.fieldId) {
        return res.status(400).json({ message: "設備缺少硬體 ID 或場域綁定" });
      }
      if (device.status !== "online") {
        return res.status(409).json({ message: "設備目前離線，無法發送指令" });
      }

      const { mode, color, brightness, speed, speedMs } = req.body;
      const ledMode = mode === "on" ? "solid" : mode;
      const data: Record<string, unknown> = { command: "led", mode: ledMode };
      if (color) data.color = color;
      if (typeof brightness === "number") data.brightness = brightness;
      const sp = typeof speedMs === "number" ? speedMs : speed;
      if (typeof sp === "number") data.speedMs = sp;

      const result = await sendDeviceCommand(device.fieldId, device.deviceId, data);
      if (!result.ok) return res.status(result.status).json({ message: result.message });
      res.json({ message: "LED 指令已發送", deviceId: device.deviceId, mode: ledMode });
    } catch (error) {
      res.status(500).json({ message: "LED 控制失敗" });
    }
  });

  app.post("/api/devices/:id/config", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      const device = await storage.getArduinoDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      const deviceId = device.deviceId || req.params.id;
      const config = req.body;

      const success = mqttService.setDeviceConfig(deviceId, config);
      if (success) {
        res.json({ message: "Configuration command sent", deviceId, config });
      } else {
        res.status(503).json({ message: "MQTT not connected" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to send configuration" });
    }
  });

  app.post("/api/devices/:id/command", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const auth = await requireAdminRole(req);
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      const device = await storage.getArduinoDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      if (!device.deviceId || !device.fieldId) {
        return res.status(400).json({ message: "設備缺少硬體 ID 或場域綁定" });
      }
      if (device.status !== "online") {
        return res.status(409).json({ message: "設備目前離線，無法發送指令" });
      }

      const { command } = req.body;
      // 舊指令名 → v1 command allowlist 映射
      const map: Record<string, string> = {
        reboot: "reboot",
        calibrate: "calibrate",
        self_test: "self_test",
        reset_counter: "reset_counter",
        ping: "self_test",
        status: "self_test",
      };
      const v1Command = map[command];
      if (!v1Command) return res.status(400).json({ message: "不支援的指令" });

      const result = await sendDeviceCommand(device.fieldId, device.deviceId, {
        command: v1Command,
      });
      if (!result.ok) return res.status(result.status).json({ message: result.message });
      res.json({ message: "指令已發送", deviceId: device.deviceId, command: v1Command });
    } catch (error) {
      res.status(500).json({ message: "指令發送失敗" });
    }
  });

}
