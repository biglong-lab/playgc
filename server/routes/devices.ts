import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import { mqttService } from "../mqttService";
import { insertArduinoDeviceSchema, insertShootingRecordSchema } from "@shared/schema";
import { z } from "zod";
import { requireAdminRole } from "./utils";
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

      const status = mqttService.getConnectionStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get MQTT status" });
    }
  });

  app.post("/api/devices/:id/activate", isAuthenticated, async (req, res) => {
    try {
      const device = await storage.getArduinoDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      const success = mqttService.activateTarget(req.params.id, req.body);
      if (success) {
        res.json({ message: "Activation command sent", deviceId: req.params.id });
      } else {
        res.status(503).json({ message: "MQTT not connected" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to activate device" });
    }
  });

  app.post("/api/devices/:id/deactivate", isAuthenticated, async (req, res) => {
    try {
      const device = await storage.getArduinoDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      const success = mqttService.deactivateTarget(req.params.id);
      if (success) {
        res.json({ message: "Deactivation command sent", deviceId: req.params.id });
      } else {
        res.status(503).json({ message: "MQTT not connected" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to deactivate device" });
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

  // 射擊記錄端點 - 需要驗證設備 ID 有效性
  // 此端點由 IoT 設備調用，需確保只有有效的已註冊設備可以提交記錄
  app.post("/api/shooting-records", async (req, res) => {
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

      // 驗證 sessionId 是否有效（如果提供）
      if (data.sessionId) {
        const session = await storage.getSession(data.sessionId);
        if (!session) {
          return res.status(400).json({ message: "無效的 session ID" });
        }
      }

      const record = await storage.createShootingRecord(data);

      if (data.sessionId) {
        ctx.broadcastToSession(data.sessionId, {
          type: "shooting_hit",
          record,
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
      if (!auth.authorized) {
        return res.status(403).json({ message: auth.message });
      }

      const device = await storage.getArduinoDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      const { mode, color, brightness, speed, duration } = req.body;
      const deviceId = device.deviceId || req.params.id;

      let success = false;
      switch (mode) {
        case "solid":
        case "on":
          success = mqttService.turnOnLED(deviceId, color, brightness);
          break;
        case "off":
          success = mqttService.turnOffLED(deviceId);
          break;
        case "blink":
          success = mqttService.blinkLED(deviceId, color, speed, duration);
          break;
        case "pulse":
          success = mqttService.pulseLED(deviceId, color, speed);
          break;
        case "rainbow":
          success = mqttService.rainbowLED(deviceId, speed, duration);
          break;
        default:
          return res.status(400).json({ message: "Invalid LED mode. Use: solid, off, blink, pulse, rainbow" });
      }

      if (success) {
        res.json({ message: "LED command sent", deviceId, mode });
      } else {
        res.status(503).json({ message: "MQTT not connected" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to control LED" });
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

      const { command, data } = req.body;
      if (!command) {
        return res.status(400).json({ message: "Command is required" });
      }

      const deviceId = device.deviceId || req.params.id;
      let success = false;

      switch (command) {
        case "reboot":
          success = mqttService.rebootDevice(deviceId);
          break;
        case "calibrate":
          success = mqttService.calibrateDevice(deviceId);
          break;
        case "ping":
          success = mqttService.pingDevice(deviceId);
          break;
        case "status":
          success = mqttService.requestStatus(deviceId);
          break;
        default:
          success = mqttService.sendCommand(deviceId, command, data || {});
      }

      if (success) {
        res.json({ message: "Command sent", deviceId, command });
      } else {
        res.status(503).json({ message: "MQTT not connected" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to send command" });
    }
  });

}
