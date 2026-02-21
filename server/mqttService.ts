import mqtt, { MqttClient, IClientOptions } from "mqtt";
import { storage } from "./storage";
import type { ArduinoDevice, InsertShootingRecord, InsertDeviceLog } from "@shared/schema";

interface MqttMessage {
  deviceId: string;
  type: "hit" | "heartbeat" | "status" | "sensor" | "led" | "config" | "response";
  data: Record<string, unknown>;
  timestamp: string;
}

interface HitData {
  sessionId: string;
  userId?: string;
  score: number;
  position: "bullseye" | "inner" | "outer";
  targetZone?: "center" | "inner" | "outer";
}

interface SensorData {
  sensorType: string;
  value: string | number | boolean;
  triggered: boolean;
}

interface DeviceStatusData {
  status: string;
  batteryLevel?: number;
  firmwareVersion?: string;
  ipAddress?: string;
  wifiSignal?: number;
  uptime?: number;
}

interface LEDConfig {
  mode: "solid" | "blink" | "pulse" | "rainbow" | "off";
  color?: { r: number; g: number; b: number };
  brightness?: number;
  speed?: number;
  duration?: number;
}

interface DeviceConfig {
  sensitivity?: number;
  scoreMultiplier?: number;
  hitTimeout?: number;
  ledEnabled?: boolean;
  soundEnabled?: boolean;
  sleepMode?: boolean;
}

type MessageHandler = (deviceId: string, message: MqttMessage) => void;
type HitBroadcastHandler = (sessionId: string, record: unknown) => void;

class MqttService {
  private client: MqttClient | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private deviceTopics: Map<string, string> = new Map();
  private hitBroadcastHandler: HitBroadcastHandler | null = null;

  constructor() {
    this.initializeDeviceTopics();
  }

  setHitBroadcastHandler(handler: HitBroadcastHandler): void {
    this.hitBroadcastHandler = handler;
  }

  private async initializeDeviceTopics() {
    try {
      const devices = await storage.getArduinoDevices();
      devices.forEach((device) => {
        if (device.mqttTopic) {
          this.deviceTopics.set(device.id, device.mqttTopic);
        }
      });
    } catch (error) {
      // 靜默處理裝置主題初始化失敗
    }
  }

  async connect(brokerUrl?: string): Promise<void> {
    const url = brokerUrl || process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
    
    const options: IClientOptions = {
      clientId: `jiachun-game-server-${Date.now()}`,
      clean: true,
      connectTimeout: 30000,
      reconnectPeriod: 5000,
      keepalive: 60,
    };

    if (process.env.MQTT_USERNAME && process.env.MQTT_PASSWORD) {
      options.username = process.env.MQTT_USERNAME;
      options.password = process.env.MQTT_PASSWORD;
    }

    return new Promise((resolve, reject) => {
      try {
        this.client = mqtt.connect(url, options);

        this.client.on("connect", () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.subscribeToDefaultTopics();
          resolve();
        });

        this.client.on("error", (error) => {
          if (!this.isConnected) {
            reject(error);
          }
        });

        this.client.on("close", () => {
          this.isConnected = false;
        });

        this.client.on("reconnect", () => {
          this.reconnectAttempts++;
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.client?.end();
          }
        });

        this.client.on("message", (topic, payload) => {
          this.handleMessage(topic, payload);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private subscribeToDefaultTopics() {
    if (!this.client || !this.isConnected) return;

    const topics = [
      "jiachun/targets/+/hit",
      "jiachun/targets/+/heartbeat",
      "jiachun/sensors/+/data",
      "jiachun/devices/+/status",
      "jiachun/devices/+/response",
      "jiachun/devices/+/config",
      "jiachun/devices/+/led",
    ];

    topics.forEach((topic) => {
      this.client?.subscribe(topic, () => {});
    });

    this.deviceTopics.forEach((topic, deviceId) => {
      this.client?.subscribe(`${topic}/#`, () => {});
    });
  }

  private handleMessage(topic: string, payload: Buffer) {
    try {
      const messageStr = payload.toString();
      let message: MqttMessage;

      try {
        message = JSON.parse(messageStr);
      } catch {
        return;
      }

      const deviceId = this.extractDeviceId(topic);
      const messageType = this.extractMessageType(topic);

      switch (messageType) {
        case "hit":
          this.handleHitMessage(deviceId, message.data as HitData);
          break;
        case "heartbeat":
          this.handleHeartbeat(deviceId, message.data as DeviceStatusData);
          break;
        case "status":
          this.handleStatusUpdate(deviceId, message.data as DeviceStatusData);
          break;
        case "data":
          this.handleSensorData(deviceId, message.data as SensorData);
          break;
        case "response":
          this.handleCommandResponse(deviceId, message.data);
          break;
        case "config":
          this.handleConfigUpdate(deviceId, message.data);
          break;
        case "led":
          this.handleLEDResponse(deviceId, message.data);
          break;
      }

      const handlers = this.messageHandlers.get("*") || new Set();
      const deviceHandlers = this.messageHandlers.get(deviceId) || new Set();
      
      (Array.from(handlers).concat(Array.from(deviceHandlers))).forEach((handler) => {
        try {
          handler(deviceId, message);
        } catch (error) {
          // 靜默處理 handler 錯誤
        }
      });

    } catch (error) {
      // 靜默處理訊息解析錯誤
    }
  }

  private extractDeviceId(topic: string): string {
    const parts = topic.split("/");
    return parts[2] || "unknown";
  }

  private extractMessageType(topic: string): string {
    const parts = topic.split("/");
    return parts[parts.length - 1] || "unknown";
  }

  private async handleHitMessage(deviceId: string, hitData: HitData) {
    try {
      const record: InsertShootingRecord = {
        sessionId: hitData.sessionId,
        deviceId: deviceId,
        userId: hitData.userId || null,
        hitScore: hitData.score,
        score: hitData.score,
        hitPosition: hitData.position,
        targetZone: hitData.targetZone || hitData.position,
      };

      const savedRecord = await storage.createShootingRecord(record);

      await this.logDeviceActivity(deviceId, "hit", `Score: ${hitData.score}, Zone: ${hitData.position}`);

      if (this.hitBroadcastHandler && hitData.sessionId) {
        this.hitBroadcastHandler(hitData.sessionId, {
          ...savedRecord,
          points: hitData.score,
          hitZone: hitData.position,
          hitPosition: { x: Math.random() * 100, y: Math.random() * 100 },
        });
      }
    } catch (error) {
      // 靜默處理命中記錄失敗
    }
  }

  private async handleHeartbeat(deviceId: string, statusData?: DeviceStatusData) {
    try {
      const device = await storage.getArduinoDeviceByDeviceId(deviceId);
      if (device) {
        const updateData: any = {
          status: "online",
          lastHeartbeat: new Date(),
        };
        
        if (statusData?.batteryLevel !== undefined) {
          updateData.batteryLevel = statusData.batteryLevel;
        }
        if (statusData?.firmwareVersion) {
          updateData.firmwareVersion = statusData.firmwareVersion;
        }
        if (statusData?.ipAddress) {
          updateData.ipAddress = statusData.ipAddress;
        }
        
        await storage.updateArduinoDeviceByDeviceId(deviceId, updateData);
      }
    } catch (error) {
      // 靜默處理心跳更新失敗
    }
  }

  private async handleStatusUpdate(deviceId: string, statusData: DeviceStatusData) {
    try {
      const updateData: any = {
        status: statusData.status || "unknown",
      };
      
      if (statusData.batteryLevel !== undefined) {
        updateData.batteryLevel = statusData.batteryLevel;
      }
      if (statusData.firmwareVersion) {
        updateData.firmwareVersion = statusData.firmwareVersion;
      }
      if (statusData.ipAddress) {
        updateData.ipAddress = statusData.ipAddress;
      }
      
      await storage.updateArduinoDeviceByDeviceId(deviceId, updateData);
      await this.logDeviceActivity(deviceId, "status", `Status changed to: ${statusData.status}`);
    } catch (error) {
      // 靜默處理狀態更新失敗
    }
  }

  private handleSensorData(deviceId: string, sensorData: SensorData) {
    this.logDeviceActivity(deviceId, "sensor", `Sensor: ${sensorData.sensorType}, Value: ${JSON.stringify(sensorData.value)}`);
  }

  private async handleCommandResponse(deviceId: string, responseData: any) {
    await this.logDeviceActivity(deviceId, "response", `Command response: ${JSON.stringify(responseData)}`);
  }

  private async handleConfigUpdate(deviceId: string, configData: any) {
    await this.logDeviceActivity(deviceId, "config", `Config updated: ${JSON.stringify(configData)}`);
  }

  private async handleLEDResponse(deviceId: string, ledData: any) {
    await this.logDeviceActivity(deviceId, "led", `LED state: ${JSON.stringify(ledData)}`);
  }

  private async logDeviceActivity(deviceId: string, logType: string, message: string) {
    try {
      const log: InsertDeviceLog = {
        deviceId,
        logType,
        message,
        metadata: {},
      };
      await storage.createDeviceLog(log);
    } catch (error) {
      // 靜默處理裝置活動日誌寫入失敗
    }
  }

  publish(topic: string, message: any, options: mqtt.IClientPublishOptions = {}): boolean {
    if (!this.client || !this.isConnected) {
      return false;
    }

    const payload = typeof message === "string" ? message : JSON.stringify(message);

    this.client.publish(topic, payload, options, () => {});

    return true;
  }

  sendCommand(deviceId: string, command: string, data: any = {}): boolean {
    const topic = `jiachun/commands/${deviceId}`;
    const message = {
      command,
      data,
      timestamp: new Date().toISOString(),
    };
    return this.publish(topic, message);
  }

  activateTarget(deviceId: string, config: { duration?: number; mode?: string } = {}): boolean {
    return this.sendCommand(deviceId, "activate", {
      duration: config.duration || 60,
      mode: config.mode || "standard",
    });
  }

  deactivateTarget(deviceId: string): boolean {
    return this.sendCommand(deviceId, "deactivate", {});
  }

  startSession(deviceId: string, sessionId: string, config: any = {}): boolean {
    return this.sendCommand(deviceId, "start_session", {
      sessionId,
      ...config,
    });
  }

  endSession(deviceId: string, sessionId: string): boolean {
    return this.sendCommand(deviceId, "end_session", { sessionId });
  }

  // LED Control Methods
  setLED(deviceId: string, config: LEDConfig): boolean {
    const topic = `jiachun/commands/${deviceId}/led`;
    const message = {
      command: "set_led",
      config,
      timestamp: new Date().toISOString(),
    };
    this.logDeviceActivity(deviceId, "command", `LED command sent: ${JSON.stringify(config)}`);
    return this.publish(topic, message);
  }

  turnOnLED(deviceId: string, color: { r: number; g: number; b: number } = { r: 0, g: 255, b: 0 }, brightness: number = 100): boolean {
    return this.setLED(deviceId, {
      mode: "solid",
      color,
      brightness,
    });
  }

  turnOffLED(deviceId: string): boolean {
    return this.setLED(deviceId, { mode: "off" });
  }

  blinkLED(deviceId: string, color: { r: number; g: number; b: number }, speed: number = 500, duration?: number): boolean {
    return this.setLED(deviceId, {
      mode: "blink",
      color,
      speed,
      duration,
    });
  }

  pulseLED(deviceId: string, color: { r: number; g: number; b: number }, speed: number = 1000): boolean {
    return this.setLED(deviceId, {
      mode: "pulse",
      color,
      speed,
    });
  }

  rainbowLED(deviceId: string, speed: number = 50, duration?: number): boolean {
    return this.setLED(deviceId, {
      mode: "rainbow",
      speed,
      duration,
    });
  }

  // Hit Effect LED (quick flash on hit)
  hitEffectLED(deviceId: string, hitZone: string): boolean {
    const colors: Record<string, { r: number; g: number; b: number }> = {
      center: { r: 255, g: 0, b: 0 },     // Red for bullseye
      inner: { r: 255, g: 165, b: 0 },    // Orange for inner
      outer: { r: 255, g: 255, b: 0 },    // Yellow for outer
    };
    const color = colors[hitZone] || { r: 0, g: 255, b: 0 };
    return this.blinkLED(deviceId, color, 100, 500);
  }

  // Device Configuration Methods
  setDeviceConfig(deviceId: string, config: DeviceConfig): boolean {
    const topic = `jiachun/commands/${deviceId}/config`;
    const message = {
      command: "set_config",
      config,
      timestamp: new Date().toISOString(),
    };
    this.logDeviceActivity(deviceId, "command", `Config command sent: ${JSON.stringify(config)}`);
    return this.publish(topic, message);
  }

  setSensitivity(deviceId: string, sensitivity: number): boolean {
    return this.setDeviceConfig(deviceId, { sensitivity });
  }

  setScoreMultiplier(deviceId: string, multiplier: number): boolean {
    return this.setDeviceConfig(deviceId, { scoreMultiplier: multiplier });
  }

  enableSleepMode(deviceId: string, enable: boolean): boolean {
    return this.setDeviceConfig(deviceId, { sleepMode: enable });
  }

  // Device Control Commands
  rebootDevice(deviceId: string): boolean {
    this.logDeviceActivity(deviceId, "command", "Reboot command sent");
    return this.sendCommand(deviceId, "reboot", {});
  }

  calibrateDevice(deviceId: string): boolean {
    this.logDeviceActivity(deviceId, "command", "Calibration command sent");
    return this.sendCommand(deviceId, "calibrate", {});
  }

  pingDevice(deviceId: string): boolean {
    return this.sendCommand(deviceId, "ping", {
      requestTime: new Date().toISOString(),
    });
  }

  requestStatus(deviceId: string): boolean {
    return this.sendCommand(deviceId, "request_status", {});
  }

  // Firmware Update
  triggerFirmwareUpdate(deviceId: string, firmwareUrl: string, version: string): boolean {
    this.logDeviceActivity(deviceId, "command", `Firmware update triggered: ${version}`);
    return this.sendCommand(deviceId, "firmware_update", {
      url: firmwareUrl,
      version,
    });
  }

  // Batch Operations
  broadcastToAllDevices(command: string, data: any = {}): void {
    const topic = "jiachun/commands/broadcast";
    const message = {
      command,
      data,
      timestamp: new Date().toISOString(),
    };
    this.publish(topic, message);
  }

  turnOnAllLEDs(color: { r: number; g: number; b: number } = { r: 0, g: 255, b: 0 }): void {
    this.broadcastToAllDevices("led", {
      mode: "solid",
      color,
      brightness: 100,
    });
  }

  turnOffAllLEDs(): void {
    this.broadcastToAllDevices("led", { mode: "off" });
  }

  async pingAllDevices(): Promise<void> {
    try {
      const devices = await storage.getArduinoDevices();
      devices.forEach((device) => {
        if (device.deviceId) {
          this.pingDevice(device.deviceId);
        }
      });
    } catch (error) {
      // 靜默處理批次 ping 失敗
    }
  }

  onMessage(handler: MessageHandler, deviceId: string = "*"): () => void {
    if (!this.messageHandlers.has(deviceId)) {
      this.messageHandlers.set(deviceId, new Set());
    }
    this.messageHandlers.get(deviceId)!.add(handler);

    return () => {
      this.messageHandlers.get(deviceId)?.delete(handler);
    };
  }

  async refreshDeviceTopics(): Promise<void> {
    await this.initializeDeviceTopics();
    if (this.isConnected) {
      this.subscribeToDefaultTopics();
    }
  }

  disconnect(): void {
    if (this.client) {
      this.client.end(true);
      this.isConnected = false;
    }
  }

  getConnectionStatus(): { connected: boolean; reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

export const mqttService = new MqttService();

export async function initializeMqtt(): Promise<void> {
  if (process.env.MQTT_ENABLED === "true") {
    try {
      await mqttService.connect();
    } catch {
      // MQTT 初始化失敗，服務將不可用
    }
  }
}
