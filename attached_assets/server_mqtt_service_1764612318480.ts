/**
 * 賈村競技體驗場 - 後端 MQTT 服務
 * 
 * 功能:
 * - 連接 MQTT Broker
 * - 訂閱設備 Topics
 * - 處理設備訊息
 * - 儲存資料到資料庫
 * - 提供 WebSocket 即時更新
 * 
 * 檔案位置: server/services/mqttService.ts
 */

import mqtt from 'mqtt';
import { db } from '../db';
import { 
  arduinoDevices, 
  shootingRecords, 
  deviceLogs,
  gameSessions 
} from '@db/schema';
import { eq, and } from 'drizzle-orm';

// MQTT 設定
const MQTT_CONFIG = {
  broker: process.env.MQTT_BROKER_URL || 'xxxxxxxx.s1.eu.hivemq.cloud',
  port: parseInt(process.env.MQTT_PORT || '8883'),
  username: process.env.MQTT_USERNAME || 'your_username',
  password: process.env.MQTT_PASSWORD || 'your_password',
  useTLS: process.env.MQTT_USE_TLS === 'true',
};

// MQTT 客戶端
let mqttClient: mqtt.MqttClient | null = null;

// WebSocket 連線池 (用於即時推送)
const wsConnections = new Set<any>();

/**
 * 初始化 MQTT 服務
 */
export function initMQTTService() {
  console.log('🚀 初始化 MQTT 服務...');
  
  const protocol = MQTT_CONFIG.useTLS ? 'mqtts' : 'mqtt';
  const brokerUrl = `${protocol}://${MQTT_CONFIG.broker}:${MQTT_CONFIG.port}`;
  
  console.log(`連接 MQTT Broker: ${brokerUrl}`);
  
  // 建立 MQTT 客戶端
  mqttClient = mqtt.connect(brokerUrl, {
    username: MQTT_CONFIG.username,
    password: MQTT_CONFIG.password,
    clientId: `GameServer_${Date.now()}`,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    keepalive: 60,
  });
  
  // 連線成功
  mqttClient.on('connect', () => {
    console.log('✅ MQTT 連線成功!');
    
    // 訂閱所有設備的 Topics
    const topics = [
      'jiachun/devices/+/status',
      'jiachun/devices/+/heartbeat',
      'jiachun/devices/+/hit',
    ];
    
    topics.forEach(topic => {
      mqttClient?.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`❌ 訂閱失敗: ${topic}`, err);
        } else {
          console.log(`📡 已訂閱: ${topic}`);
        }
      });
    });
  });
  
  // 接收訊息
  mqttClient.on('message', handleMQTTMessage);
  
  // 連線錯誤
  mqttClient.on('error', (error) => {
    console.error('❌ MQTT 錯誤:', error);
  });
  
  // 斷線
  mqttClient.on('offline', () => {
    console.warn('⚠️ MQTT 離線');
  });
  
  // 重新連線
  mqttClient.on('reconnect', () => {
    console.log('🔄 MQTT 重新連線中...');
  });
}

/**
 * 處理 MQTT 訊息
 */
async function handleMQTTMessage(topic: string, payload: Buffer) {
  try {
    const message = payload.toString();
    const data = JSON.parse(message);
    
    console.log(`📨 收到訊息 [${topic}]:`, data);
    
    // 解析 Topic
    const topicParts = topic.split('/');
    const deviceId = topicParts[2];
    const action = topicParts[3];
    
    // 根據 action 處理訊息
    switch (action) {
      case 'status':
        await handleStatusMessage(deviceId, data);
        break;
      case 'heartbeat':
        await handleHeartbeatMessage(deviceId, data);
        break;
      case 'hit':
        await handleHitMessage(deviceId, data);
        break;
      default:
        console.warn(`未知的 action: ${action}`);
    }
    
    // 即時推送到前端
    broadcastToWebSockets({
      type: 'device_message',
      deviceId,
      action,
      data,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('處理 MQTT 訊息時發生錯誤:', error);
    
    // 記錄錯誤到資料庫
    await logDeviceError('unknown', 'message_parse_error', error);
  }
}

/**
 * 處理設備狀態訊息
 */
async function handleStatusMessage(deviceId: string, data: any) {
  console.log(`📊 設備狀態更新: ${deviceId} - ${data.status}`);
  
  try {
    // 檢查設備是否存在
    const existingDevice = await db
      .select()
      .from(arduinoDevices)
      .where(eq(arduinoDevices.deviceId, deviceId))
      .limit(1);
    
    if (existingDevice.length === 0) {
      // 新設備,自動註冊
      await db.insert(arduinoDevices).values({
        deviceId: deviceId,
        deviceName: data.device_name || `設備 ${deviceId}`,
        deviceType: 'shooting_target',
        status: data.status,
        firmwareVersion: data.firmware_version,
        ipAddress: data.ip_address,
        lastHeartbeat: new Date(),
      });
      
      console.log(`✨ 新設備已註冊: ${deviceId}`);
    } else {
      // 更新設備狀態
      await db
        .update(arduinoDevices)
        .set({
          status: data.status,
          firmwareVersion: data.firmware_version,
          ipAddress: data.ip_address,
          lastHeartbeat: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(arduinoDevices.deviceId, deviceId));
    }
    
    // 記錄日誌
    await logDeviceInfo(deviceId, 'status_update', `狀態更新為: ${data.status}`);
    
  } catch (error) {
    console.error('處理狀態訊息時發生錯誤:', error);
    await logDeviceError(deviceId, 'status_update_error', error);
  }
}

/**
 * 處理心跳訊息
 */
async function handleHeartbeatMessage(deviceId: string, data: any) {
  console.log(`💓 心跳: ${deviceId}`);
  
  try {
    // 更新最後心跳時間
    await db
      .update(arduinoDevices)
      .set({
        lastHeartbeat: new Date(),
        status: 'online',
        updatedAt: new Date(),
      })
      .where(eq(arduinoDevices.deviceId, deviceId));
    
  } catch (error) {
    console.error('處理心跳訊息時發生錯誤:', error);
  }
}

/**
 * 處理射擊命中訊息
 */
async function handleHitMessage(deviceId: string, data: any) {
  console.log(`🎯 射擊命中: ${deviceId} - 得分: ${data.score}`);
  
  try {
    // 儲存射擊記錄
    await db.insert(shootingRecords).values({
      deviceId: deviceId,
      gameSessionId: data.game_id || null,
      targetZone: 'center', // 可根據實際情況調整
      score: data.score,
      hitTimestamp: new Date(),
    });
    
    // 如果有 game_session_id,更新遊戲分數
    if (data.game_id) {
      await updateGameScore(data.game_id, data.score);
    }
    
    // 記錄日誌
    await logDeviceInfo(deviceId, 'shooting_hit', `命中得分: ${data.score}`);
    
  } catch (error) {
    console.error('處理射擊訊息時發生錯誤:', error);
    await logDeviceError(deviceId, 'hit_record_error', error);
  }
}

/**
 * 更新遊戲分數
 */
async function updateGameScore(gameSessionId: number, score: number) {
  try {
    const session = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.id, gameSessionId))
      .limit(1);
    
    if (session.length > 0) {
      const currentScore = session[0].score || 0;
      const newScore = currentScore + score;
      
      await db
        .update(gameSessions)
        .set({
          score: newScore,
          updatedAt: new Date(),
        })
        .where(eq(gameSessions.id, gameSessionId));
      
      console.log(`🎮 遊戲 ${gameSessionId} 分數更新: ${currentScore} → ${newScore}`);
    }
  } catch (error) {
    console.error('更新遊戲分數時發生錯誤:', error);
  }
}

/**
 * 記錄設備日誌 (資訊)
 */
async function logDeviceInfo(deviceId: string, logType: string, message: string, metadata?: any) {
  try {
    await db.insert(deviceLogs).values({
      deviceId,
      logType: 'info',
      message: `[${logType}] ${message}`,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (error) {
    console.error('記錄設備日誌時發生錯誤:', error);
  }
}

/**
 * 記錄設備錯誤
 */
async function logDeviceError(deviceId: string, logType: string, error: any) {
  try {
    await db.insert(deviceLogs).values({
      deviceId,
      logType: 'error',
      message: `[${logType}] ${error.message || error}`,
      metadata: JSON.stringify({
        stack: error.stack,
        ...error,
      }),
    });
  } catch (err) {
    console.error('記錄設備錯誤時發生錯誤:', err);
  }
}

/**
 * 發送控制指令到設備
 */
export function sendControlCommand(deviceId: string, command: string, params?: any) {
  if (!mqttClient || !mqttClient.connected) {
    throw new Error('MQTT 客戶端未連線');
  }
  
  const topic = `jiachun/devices/${deviceId}/control`;
  const payload = JSON.stringify({
    command,
    ...params,
    timestamp: Date.now(),
  });
  
  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error(`發送控制指令失敗: ${deviceId}`, err);
      throw err;
    } else {
      console.log(`✅ 已發送控制指令: ${deviceId} - ${command}`);
    }
  });
}

/**
 * 更新設備設定
 */
export function updateDeviceConfig(deviceId: string, config: any) {
  if (!mqttClient || !mqttClient.connected) {
    throw new Error('MQTT 客戶端未連線');
  }
  
  const topic = `jiachun/devices/${deviceId}/config`;
  const payload = JSON.stringify(config);
  
  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error(`更新設備設定失敗: ${deviceId}`, err);
      throw err;
    } else {
      console.log(`✅ 已更新設備設定: ${deviceId}`);
    }
  });
}

/**
 * 控制設備 LED
 */
export function controlDeviceLED(deviceId: string, color: string, mode: string = 'solid') {
  if (!mqttClient || !mqttClient.connected) {
    throw new Error('MQTT 客戶端未連線');
  }
  
  const topic = `jiachun/devices/${deviceId}/led`;
  const payload = JSON.stringify({ color, mode });
  
  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error(`控制 LED 失敗: ${deviceId}`, err);
      throw err;
    } else {
      console.log(`✅ 已控制 LED: ${deviceId} - ${color} (${mode})`);
    }
  });
}

/**
 * 檢查離線設備
 * 每分鐘執行一次,將超過 90 秒未心跳的設備標記為離線
 */
export async function checkOfflineDevices() {
  try {
    const ninetySecondsAgo = new Date(Date.now() - 90 * 1000);
    
    const result = await db
      .update(arduinoDevices)
      .set({
        status: 'offline',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(arduinoDevices.status, 'online'),
          // @ts-ignore
          arduinoDevices.lastHeartbeat < ninetySecondsAgo
        )
      );
    
    if (result.rowCount && result.rowCount > 0) {
      console.log(`⚠️ 已標記 ${result.rowCount} 個設備為離線`);
    }
  } catch (error) {
    console.error('檢查離線設備時發生錯誤:', error);
  }
}

/**
 * 註冊 WebSocket 連線
 */
export function registerWebSocket(ws: any) {
  wsConnections.add(ws);
  console.log(`📱 WebSocket 已註冊,目前連線數: ${wsConnections.size}`);
  
  ws.on('close', () => {
    wsConnections.delete(ws);
    console.log(`📱 WebSocket 已移除,目前連線數: ${wsConnections.size}`);
  });
}

/**
 * 廣播訊息到所有 WebSocket 連線
 */
function broadcastToWebSockets(message: any) {
  const payload = JSON.stringify(message);
  
  wsConnections.forEach(ws => {
    try {
      if (ws.readyState === 1) { // OPEN
        ws.send(payload);
      }
    } catch (error) {
      console.error('發送 WebSocket 訊息時發生錯誤:', error);
    }
  });
}

/**
 * 關閉 MQTT 服務
 */
export function closeMQTTService() {
  if (mqttClient) {
    mqttClient.end();
    console.log('🔌 MQTT 服務已關閉');
  }
}

// 啟動定時任務
setInterval(checkOfflineDevices, 60000); // 每分鐘檢查一次
