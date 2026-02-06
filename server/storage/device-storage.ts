// Arduino 裝置、射擊記錄、裝置日誌相關的資料庫儲存方法
import { eq, desc, and, gte } from "drizzle-orm";
import { db } from "../db";
import {
  arduinoDevices,
  shootingRecords,
  deviceLogs,
  type ArduinoDevice,
  type InsertArduinoDevice,
  type ShootingRecord,
  type InsertShootingRecord,
  type DeviceLog,
  type InsertDeviceLog,
} from "@shared/schema";

/** 裝置儲存方法集合 */
export const deviceStorageMethods = {
  // ===== Arduino 裝置 =====

  /** 取得所有 Arduino 裝置（依建立時間倒序） */
  async getArduinoDevices(): Promise<ArduinoDevice[]> {
    return db.select().from(arduinoDevices).orderBy(desc(arduinoDevices.createdAt));
  },

  /** 根據內部 ID 取得 Arduino 裝置 */
  async getArduinoDevice(id: string): Promise<ArduinoDevice | undefined> {
    const result = await db.select().from(arduinoDevices).where(eq(arduinoDevices.id, id));
    return result[0];
  },

  /** 根據裝置 ID（硬體識別碼）取得 Arduino 裝置 */
  async getArduinoDeviceByDeviceId(deviceId: string): Promise<ArduinoDevice | undefined> {
    const result = await db.select().from(arduinoDevices).where(eq(arduinoDevices.deviceId, deviceId));
    return result[0];
  },

  /** 建立新 Arduino 裝置 */
  async createArduinoDevice(device: InsertArduinoDevice): Promise<ArduinoDevice> {
    const [newDevice] = await db.insert(arduinoDevices).values(device).returning();
    return newDevice;
  },

  /** 根據內部 ID 更新 Arduino 裝置 */
  async updateArduinoDevice(id: string, device: Partial<InsertArduinoDevice>): Promise<ArduinoDevice | undefined> {
    const [updated] = await db
      .update(arduinoDevices)
      .set({ ...device, updatedAt: new Date() })
      .where(eq(arduinoDevices.id, id))
      .returning();
    return updated;
  },

  /** 根據裝置 ID（硬體識別碼）更新 Arduino 裝置 */
  async updateArduinoDeviceByDeviceId(
    deviceId: string,
    device: Partial<InsertArduinoDevice>
  ): Promise<ArduinoDevice | undefined> {
    const [updated] = await db
      .update(arduinoDevices)
      .set({ ...device, updatedAt: new Date() })
      .where(eq(arduinoDevices.deviceId, deviceId))
      .returning();
    return updated;
  },

  /** 更新 Arduino 裝置狀態（同時更新心跳時間） */
  async updateArduinoDeviceStatus(id: string, status: string): Promise<ArduinoDevice | undefined> {
    const [updated] = await db
      .update(arduinoDevices)
      .set({ status, lastHeartbeat: new Date(), updatedAt: new Date() })
      .where(eq(arduinoDevices.id, id))
      .returning();
    return updated;
  },

  /** 刪除 Arduino 裝置 */
  async deleteArduinoDevice(id: string): Promise<void> {
    await db.delete(arduinoDevices).where(eq(arduinoDevices.id, id));
  },

  // ===== 射擊記錄 =====

  /** 建立射擊記錄 */
  async createShootingRecord(record: InsertShootingRecord): Promise<ShootingRecord> {
    const [newRecord] = await db.insert(shootingRecords).values(record).returning();
    return newRecord;
  },

  /** 取得工作階段的射擊記錄 */
  async getShootingRecords(sessionId: string): Promise<ShootingRecord[]> {
    return db.select().from(shootingRecords).where(eq(shootingRecords.sessionId, sessionId));
  },

  /** 根據裝置 ID 取得射擊記錄（限制筆數） */
  async getShootingRecordsByDevice(deviceId: string, limit: number = 100): Promise<ShootingRecord[]> {
    return db
      .select()
      .from(shootingRecords)
      .where(eq(shootingRecords.deviceId, deviceId))
      .orderBy(desc(shootingRecords.hitTimestamp))
      .limit(limit);
  },

  /** 取得裝置的射擊統計資料（預設最近 7 天） */
  async getShootingRecordStatistics(
    deviceId: string,
    days: number = 7
  ): Promise<{
    totalHits: number;
    totalScore: number;
    avgScore: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

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
    const totalScore = records.reduce((sum, r) => sum + (r.score || r.hitScore || 0), 0);
    const avgScore = totalHits > 0 ? Math.round((totalScore / totalHits) * 100) / 100 : 0;

    return { totalHits, totalScore, avgScore };
  },

  // ===== 裝置日誌 =====

  /** 取得裝置日誌（可依類型篩選） */
  async getDeviceLogs(deviceId: string, limit: number = 100, logType?: string): Promise<DeviceLog[]> {
    if (logType) {
      return db
        .select()
        .from(deviceLogs)
        .where(
          and(
            eq(deviceLogs.deviceId, deviceId),
            eq(deviceLogs.logType, logType)
          )
        )
        .orderBy(desc(deviceLogs.createdAt))
        .limit(limit);
    }
    return db
      .select()
      .from(deviceLogs)
      .where(eq(deviceLogs.deviceId, deviceId))
      .orderBy(desc(deviceLogs.createdAt))
      .limit(limit);
  },

  /** 建立裝置日誌 */
  async createDeviceLog(log: InsertDeviceLog): Promise<DeviceLog> {
    const [newLog] = await db.insert(deviceLogs).values(log).returning();
    return newLog;
  },
};
