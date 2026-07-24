import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock storage + MQTT（vi.hoisted 確保 hoisted vi.mock 可存取）
const { mockStorage, mockMqttService, mockSendDeviceCommand } = vi.hoisted(() => ({
  mockStorage: {
    getArduinoDevices: vi.fn(),
    getArduinoDevice: vi.fn(),
    createArduinoDevice: vi.fn(),
    updateArduinoDevice: vi.fn(),
    deleteArduinoDevice: vi.fn(),
    createShootingRecord: vi.fn(),
    getShootingRecords: vi.fn(),
    getShootingRecordsByDevice: vi.fn(),
    getShootingRecordStatistics: vi.fn(),
    getDeviceLogs: vi.fn(),
    getSession: vi.fn(),
  },
  mockMqttService: {
    getConnectionStatus: vi.fn(),
    activateTarget: vi.fn(),
    deactivateTarget: vi.fn(),
    startSession: vi.fn(),
    endSession: vi.fn(),
    turnOnLED: vi.fn(),
    turnOffLED: vi.fn(),
    blinkLED: vi.fn(),
    pulseLED: vi.fn(),
    rainbowLED: vi.fn(),
    rebootDevice: vi.fn(),
    calibrateDevice: vi.fn(),
    pingDevice: vi.fn(),
    requestStatus: vi.fn(),
    sendCommand: vi.fn(),
    setDeviceConfig: vi.fn(),
    turnOnAllLEDs: vi.fn(),
    turnOffAllLEDs: vi.fn(),
    pingAllDevices: vi.fn(),
  },
  mockSendDeviceCommand: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: mockStorage,
}));

vi.mock("../mqttService", () => ({
  mqttService: mockMqttService,
}));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = {
        claims: { sub: "admin-user" },
        dbUser: { id: "admin-user", role: "admin", displayName: "Admin", email: "admin@test.com" },
      };
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }),
}));

// Mock requireAdminRole（保留 validateId 等純函式，防止跨檔案洩漏時缺失）
vi.mock("../routes/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../routes/utils")>();
  return {
    ...actual,
    requireAdminRole: vi.fn(async (req: any) => {
      if (req.user?.dbUser?.role === "admin") {
        return { authorized: true };
      }
      return { authorized: false, message: "Forbidden" };
    }),
    checkGameOwnership: vi.fn(),
    // 場域權限判定不在本檔測範圍；預設放行，另有專門的失敗案例覆蓋
    getManageableFields: vi.fn(async () => ({ all: true, fieldIds: [] })),
  };
});

vi.mock("../mqtt/command-service", () => ({
  sendDeviceCommand: mockSendDeviceCommand,
}));

vi.mock("../mqtt", () => ({
  getMqttStatus: vi.fn(() => ({ connected: true, enabled: true })),
}));

import { registerDeviceRoutes } from "../routes/devices";
import type { RouteContext } from "../routes/types";

const mockBroadcast: RouteContext = {
  broadcastToSession: vi.fn(),
  broadcastToTeam: vi.fn(),
};

function createApp() {
  const app = express();
  app.use(express.json());
  registerDeviceRoutes(app, mockBroadcast);
  return app;
}

const AUTH_HEADER = { Authorization: "Bearer valid-token" };

describe("Devices 路由", () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendDeviceCommand.mockResolvedValue({ ok: true });
    app = createApp();
  });

  // =====================================================
  // 裝置 CRUD
  // =====================================================
  describe("GET /api/devices", () => {
    it("應回傳所有裝置列表", async () => {
      mockStorage.getArduinoDevices.mockResolvedValue([
        { id: "d-1", deviceName: "Target A", deviceId: "arduino-001" },
      ]);

      const res = await request(app).get("/api/devices").set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].deviceName).toBe("Target A");
    });

    it("未認證應回傳 401", async () => {
      const res = await request(app).get("/api/devices");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/devices/:id", () => {
    it("應回傳指定裝置", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue({ id: "d-1", deviceName: "Target A" });

      const res = await request(app).get("/api/devices/d-1").set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.deviceName).toBe("Target A");
    });

    it("裝置不存在應回傳 404", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue(null);

      const res = await request(app).get("/api/devices/not-exist").set(AUTH_HEADER);

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/devices", () => {
    it("應建立新裝置", async () => {
      const deviceData = {
        deviceId: "arduino-002",
        deviceName: "Target B",
        deviceType: "shooting_target",
        fieldId: "field-1",
      };
      mockStorage.createArduinoDevice.mockResolvedValue({ id: "d-2", ...deviceData });

      const res = await request(app)
        .post("/api/devices")
        .set(AUTH_HEADER)
        .send(deviceData);

      expect(res.status).toBe(201);
      expect(res.body.deviceId).toBe("arduino-002");
    });

    it("缺硬體 ID 應回 400（沒有它 MQTT 心跳與命中都配不上）", async () => {
      const res = await request(app)
        .post("/api/devices")
        .set(AUTH_HEADER)
        .send({ deviceName: "Target C", fieldId: "field-1" });

      expect(res.status).toBe(400);
      expect(mockStorage.createArduinoDevice).not.toHaveBeenCalled();
    });

    it("硬體 ID 含非法字元應回 400（避免 MQTT topic wildcard 注入）", async () => {
      const res = await request(app)
        .post("/api/devices")
        .set(AUTH_HEADER)
        .send({ deviceId: "bad/id#1", deviceName: "Target D", fieldId: "field-1" });

      expect(res.status).toBe(400);
      expect(mockStorage.createArduinoDevice).not.toHaveBeenCalled();
    });

    it("缺場域應回 400（未綁場域的設備收不到命中）", async () => {
      const res = await request(app)
        .post("/api/devices")
        .set(AUTH_HEADER)
        .send({ deviceId: "arduino-003", deviceName: "Target E" });

      expect(res.status).toBe(400);
      expect(mockStorage.createArduinoDevice).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/devices/:id", () => {
    it("應更新裝置資料", async () => {
      mockStorage.updateArduinoDevice.mockResolvedValue({
        id: "d-1", deviceName: "Updated Target",
      });

      const res = await request(app)
        .patch("/api/devices/d-1")
        .set(AUTH_HEADER)
        .send({ deviceName: "Updated Target" });

      expect(res.status).toBe(200);
      expect(res.body.deviceName).toBe("Updated Target");
    });

    it("裝置不存在應回傳 404", async () => {
      mockStorage.updateArduinoDevice.mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/devices/not-exist")
        .set(AUTH_HEADER)
        .send({ deviceName: "X" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/devices/:id", () => {
    it("應刪除裝置", async () => {
      mockStorage.deleteArduinoDevice.mockResolvedValue(undefined);

      const res = await request(app).delete("/api/devices/d-1").set(AUTH_HEADER);

      expect(res.status).toBe(204);
    });
  });

  // =====================================================
  // MQTT 控制
  // =====================================================
  describe("GET /api/mqtt/status", () => {
    it("應回傳 MQTT 連線狀態", async () => {
      mockMqttService.getConnectionStatus.mockReturnValue({ connected: true, broker: "mqtt://localhost" });

      const res = await request(app).get("/api/mqtt/status").set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
    });
  });

  describe("POST /api/devices/:id/activate", () => {
    const onlineDevice = { id: "d-1", deviceId: "TARGET_001", fieldId: "f-1", status: "online" };

    it("設備在線時應發送 v1 啟動指令", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue(onlineDevice);
      mockSendDeviceCommand.mockResolvedValue({ ok: true });

      const res = await request(app).post("/api/devices/d-1/activate").set(AUTH_HEADER).send({});

      expect(res.status).toBe(200);
      expect(mockSendDeviceCommand).toHaveBeenCalledWith("f-1", "TARGET_001", { command: "start_session" });
    });

    it("設備離線應回傳 409 且不發指令", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue({ ...onlineDevice, status: "offline" });

      const res = await request(app).post("/api/devices/d-1/activate").set(AUTH_HEADER).send({});

      expect(res.status).toBe(409);
      expect(mockSendDeviceCommand).not.toHaveBeenCalled();
    });

    it("MQTT 未連線應回傳 503", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue(onlineDevice);
      mockSendDeviceCommand.mockResolvedValue({ ok: false, status: 503, message: "MQTT 未連線" });

      const res = await request(app).post("/api/devices/d-1/activate").set(AUTH_HEADER).send({});

      expect(res.status).toBe(503);
    });

    it("裝置不存在應回傳 404", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue(null);

      const res = await request(app).post("/api/devices/d-1/activate").set(AUTH_HEADER).send({});

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/devices/:id/session", () => {
    it("start 應啟動裝置場次", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue({ id: "d-1" });
      mockMqttService.startSession.mockReturnValue(true);

      const res = await request(app)
        .post("/api/devices/d-1/session")
        .set(AUTH_HEADER)
        .send({ sessionId: "s-1", action: "start", config: {} });

      expect(res.status).toBe(200);
      expect(mockMqttService.startSession).toHaveBeenCalledWith("d-1", "s-1", {});
    });

    it("end 應結束裝置場次", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue({ id: "d-1" });
      mockMqttService.endSession.mockReturnValue(true);

      const res = await request(app)
        .post("/api/devices/d-1/session")
        .set(AUTH_HEADER)
        .send({ sessionId: "s-1", action: "end" });

      expect(res.status).toBe(200);
    });

    it("缺少 sessionId 應回傳 400", async () => {
      const res = await request(app)
        .post("/api/devices/d-1/session")
        .set(AUTH_HEADER)
        .send({ action: "start" });

      expect(res.status).toBe(400);
    });

    it("無效 action 應回傳 400", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue({ id: "d-1" });

      const res = await request(app)
        .post("/api/devices/d-1/session")
        .set(AUTH_HEADER)
        .send({ sessionId: "s-1", action: "invalid" });

      expect(res.status).toBe(400);
    });
  });

  // =====================================================
  // 射擊記錄
  // =====================================================
  describe("POST /api/shooting-records", () => {
    it("應建立射擊記錄並廣播", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue({ id: "d-1", deviceId: "arduino-001" });
      mockStorage.getSession.mockResolvedValue({ id: "s-1" });
      mockStorage.createShootingRecord.mockResolvedValue({
        id: 1, deviceId: "arduino-001", sessionId: "s-1", score: 10,
      });

      const res = await request(app)
        .post("/api/shooting-records")
        .send({ deviceId: "arduino-001", sessionId: "s-1", score: 10 });

      expect(res.status).toBe(201);
      expect(mockBroadcast.broadcastToSession).toHaveBeenCalledWith(
        "s-1",
        expect.objectContaining({ type: "shooting_hit" })
      );
    });

    it("無效裝置 ID 應回傳 403", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/shooting-records")
        .send({ deviceId: "fake-device", score: 10 });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/shooting-records/:sessionId", () => {
    it("應回傳場次射擊記錄", async () => {
      mockStorage.getShootingRecords.mockResolvedValue([
        { id: 1, sessionId: "s-1", score: 10 },
      ]);

      const res = await request(app)
        .get("/api/shooting-records/s-1")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  // =====================================================
  // LED 控制
  // =====================================================
  describe("POST /api/devices/:id/led", () => {
    const onlineDevice = { id: "d-1", deviceId: "TARGET_001", fieldId: "f-1", status: "online" };

    it("solid 模式應發送 LED 指令", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue(onlineDevice);
      mockSendDeviceCommand.mockResolvedValue({ ok: true });

      const res = await request(app).post("/api/devices/d-1/led").set(AUTH_HEADER).send({ mode: "solid", color: "red" });

      expect(res.status).toBe(200);
      expect(mockSendDeviceCommand).toHaveBeenCalled();
    });

    it("off 模式應發送 LED 指令", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue(onlineDevice);
      mockSendDeviceCommand.mockResolvedValue({ ok: true });

      const res = await request(app).post("/api/devices/d-1/led").set(AUTH_HEADER).send({ mode: "off" });

      expect(res.status).toBe(200);
    });

    it("無效模式應回傳 400", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue(onlineDevice);

      const res = await request(app).post("/api/devices/d-1/led").set(AUTH_HEADER).send({ mode: "invalid" });

      expect(res.status).toBe(400);
    });

    it("設備離線應回傳 409", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue({ ...onlineDevice, status: "offline" });

      const res = await request(app).post("/api/devices/d-1/led").set(AUTH_HEADER).send({ mode: "solid" });

      expect(res.status).toBe(409);
    });
  });

  // =====================================================
  // 裝置指令
  // =====================================================
  describe("POST /api/devices/:id/command", () => {
    const onlineDevice = { id: "d-1", deviceId: "TARGET_001", fieldId: "f-1", status: "online" };

    it("reboot 指令應成功發送 v1 command", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue(onlineDevice);
      mockSendDeviceCommand.mockResolvedValue({ ok: true });

      const res = await request(app).post("/api/devices/d-1/command").set(AUTH_HEADER).send({ command: "reboot" });

      expect(res.status).toBe(200);
      expect(mockSendDeviceCommand).toHaveBeenCalledWith("f-1", "TARGET_001", { command: "reboot" });
    });

    it("不支援的指令應回傳 400", async () => {
      mockStorage.getArduinoDevice.mockResolvedValue(onlineDevice);

      const res = await request(app).post("/api/devices/d-1/command").set(AUTH_HEADER).send({ command: "rm -rf" });

      expect(res.status).toBe(400);
    });
  });

  // =====================================================
  // 廣播
  // =====================================================
  describe("POST /api/devices/broadcast/led", () => {
    it("solid 廣播應開啟所有 LED", async () => {
      const res = await request(app)
        .post("/api/devices/broadcast/led")
        .set(AUTH_HEADER)
        .send({ mode: "solid", color: "#00FF00" });

      expect(res.status).toBe(200);
      expect(mockMqttService.turnOnAllLEDs).toHaveBeenCalledWith("#00FF00");
    });

    it("off 廣播應關閉所有 LED", async () => {
      const res = await request(app)
        .post("/api/devices/broadcast/led")
        .set(AUTH_HEADER)
        .send({ mode: "off" });

      expect(res.status).toBe(200);
      expect(mockMqttService.turnOffAllLEDs).toHaveBeenCalled();
    });
  });
});
