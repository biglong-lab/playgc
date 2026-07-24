// 🔌 MQTT Broker 設定 API（ADR-0024）
//
// 讓後台管理員自訂 broker（代理商/位址/帳密），存進 DB singleton，
// 儲存後立即套用重連，不必改 env 重新部署。
//
// ⚠️ 平台級基礎設施設定：影響全平台裝置 MQTT 連線。目前用 requireAdminAuth
//    （場域管理員即可），未來可視需要收緊為 super_admin。

import type { Express, Response } from "express";
import { z } from "zod";
import mqtt, { type IClientOptions } from "mqtt";
import { eq } from "drizzle-orm";
import { requireAdminAuth, logAuditAction } from "../adminAuth";
import { db } from "../db";
import { mqttBrokerConfig } from "@shared/schema";
import { reconnectMqttV1, getMqttStatus } from "../mqtt";

const SINGLETON = "singleton";

const updateSchema = z.object({
  brokerUrl: z.string().max(500).optional(),
  username: z.string().max(200).optional(),
  password: z.string().max(500).optional(),
  caCert: z.string().max(10000).optional(),
  enabled: z.boolean().optional(),
});

function fail(res: Response, e: unknown) {
  console.error("[mqtt-broker-config]", e);
  res.status(500).json({ error: "internal_error", message: "伺服器錯誤" });
}

async function getConfigRow() {
  const rows = await db
    .select()
    .from(mqttBrokerConfig)
    .where(eq(mqttBrokerConfig.id, SINGLETON))
    .limit(1);
  return rows[0] ?? null;
}

/** 用給定設定試連 broker（不影響正在運行的 gateway）；8 秒逾時 */
function testConnection(
  brokerUrl: string,
  username?: string,
  password?: string,
  caCert?: string,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const options: IClientOptions = {
      connectTimeout: 8_000,
      reconnectPeriod: 0,
      clientId: `chito-test-${Date.now()}`,
    };
    if (username) options.username = username;
    if (password) options.password = password;
    if (caCert) options.ca = [Buffer.from(caCert)];

    let done = false;
    let c: mqtt.MqttClient | null = null;
    const finish = (r: { ok: boolean; error?: string }) => {
      if (done) return;
      done = true;
      try {
        c?.end(true);
      } catch {
        /* ignore */
      }
      resolve(r);
    };

    try {
      c = mqtt.connect(brokerUrl, options);
    } catch (e) {
      resolve({ ok: false, error: e instanceof Error ? e.message : String(e) });
      return;
    }
    const timer = setTimeout(() => finish({ ok: false, error: "連線逾時（8 秒）" }), 8_500);
    c.on("connect", () => {
      clearTimeout(timer);
      finish({ ok: true });
    });
    c.on("error", (e) => {
      clearTimeout(timer);
      finish({ ok: false, error: e.message || "無法連線（請檢查位址、埠與網路）" });
    });
  });
}

export function registerMqttBrokerConfigRoutes(app: Express): void {
  // 讀設定（密碼不回明文，只回 hasPassword）+ 目前連線狀態
  app.get("/api/admin/mqtt/broker-config", requireAdminAuth, async (_req, res) => {
    try {
      const cfg = await getConfigRow();
      res.json({
        brokerUrl: cfg?.brokerUrl ?? "",
        username: cfg?.username ?? "",
        hasPassword: !!cfg?.password,
        hasCaCert: !!cfg?.caCert,
        enabled: cfg?.enabled ?? false,
        updatedAt: cfg?.updatedAt ?? null,
        status: getMqttStatus(),
      });
    } catch (e) {
      fail(res, e);
    }
  });

  // 更新設定 → 立即套用重連
  app.patch("/api/admin/mqtt/broker-config", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) return res.status(401).json({ message: "未認證" });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "參數格式錯誤" });
      }
      const d = parsed.data;

      const set: Partial<typeof mqttBrokerConfig.$inferInsert> = {
        updatedAt: new Date(),
        updatedByAdminId: req.admin.id,
      };
      if (d.brokerUrl !== undefined) set.brokerUrl = d.brokerUrl.trim() || null;
      if (d.username !== undefined) set.username = d.username.trim() || null;
      // 密碼：僅在提供非空值時更新（前端留空 = 保留原密碼）
      if (d.password) set.password = d.password;
      if (d.caCert !== undefined) set.caCert = d.caCert.trim() || null;
      if (d.enabled !== undefined) set.enabled = d.enabled;

      await db.update(mqttBrokerConfig).set(set).where(eq(mqttBrokerConfig.id, SINGLETON));

      // 套用新設定重連（enabled=false 則會斷線停用）
      const active = await reconnectMqttV1();

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "mqtt_broker_config_update",
        targetType: "mqtt_broker_config",
        fieldId: req.admin.fieldId,
        metadata: { enabled: set.enabled ?? null, active },
      });

      res.json({ ok: true, active, status: getMqttStatus() });
    } catch (e) {
      fail(res, e);
    }
  });

  // 測試連線（用表單值；密碼未提供時沿用 DB 已存的）
  app.post("/api/admin/mqtt/broker-config/test", requireAdminAuth, async (req, res) => {
    try {
      const body = (req.body ?? {}) as {
        brokerUrl?: string;
        username?: string;
        password?: string;
        caCert?: string;
      };
      if (!body.brokerUrl?.trim()) {
        return res.status(400).json({ ok: false, error: "請先填寫 broker 位址" });
      }
      let password = body.password;
      let caCert = body.caCert;
      if (!password || !caCert) {
        const cfg = await getConfigRow();
        if (!password) password = cfg?.password ?? undefined;
        if (!caCert) caCert = cfg?.caCert ?? undefined;
      }
      const result = await testConnection(
        body.brokerUrl.trim(),
        body.username?.trim() || undefined,
        password,
        caCert,
      );
      res.json(result);
    } catch (e) {
      fail(res, e);
    }
  });
}
