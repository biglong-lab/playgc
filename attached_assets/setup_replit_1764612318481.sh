#!/bin/bash

# MQTT 設備整合 - Replit 一鍵安裝腳本
# 此腳本會自動完成所有設定步驟

echo "========================================"
echo "  MQTT 設備整合 - Replit 安裝程式"
echo "========================================"
echo ""

# 檢查是否在 Replit 環境
if [ -z "$REPL_ID" ]; then
  echo "⚠️  警告: 此腳本設計用於 Replit 環境"
  echo "是否繼續? (y/n)"
  read -r response
  if [ "$response" != "y" ]; then
    echo "安裝已取消"
    exit 0
  fi
fi

echo "📦 步驟 1/5: 安裝依賴..."
if command -v pnpm &> /dev/null; then
  pnpm add mqtt
else
  npm install mqtt
fi

if [ $? -eq 0 ]; then
  echo "✅ 依賴安裝完成"
else
  echo "❌ 依賴安裝失敗"
  exit 1
fi

echo ""
echo "📁 步驟 2/5: 建立目錄結構..."
mkdir -p server/services
mkdir -p server/routes
mkdir -p client/src/pages/Admin

echo "✅ 目錄建立完成"

echo ""
echo "📝 步驟 3/5: 檢查環境變數..."
if [ -z "$MQTT_BROKER_URL" ]; then
  echo "⚠️  未設定 MQTT_BROKER_URL"
  echo "請在 Replit Secrets 中設定以下環境變數:"
  echo "  - MQTT_BROKER_URL"
  echo "  - MQTT_PORT"
  echo "  - MQTT_USERNAME"
  echo "  - MQTT_PASSWORD"
  echo "  - MQTT_USE_TLS"
  echo ""
  echo "是否已設定完成? (y/n)"
  read -r response
  if [ "$response" != "y" ]; then
    echo "請先設定環境變數後再執行此腳本"
    exit 1
  fi
else
  echo "✅ 環境變數已設定"
fi

echo ""
echo "🗄️  步驟 4/5: 建立資料表..."
if [ -n "$DATABASE_URL" ]; then
  echo "執行 SQL..."
  psql $DATABASE_URL << 'EOF'
-- 建立 arduino_devices 資料表
CREATE TABLE IF NOT EXISTS arduino_devices (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) UNIQUE NOT NULL,
  device_name VARCHAR(100) NOT NULL,
  device_type VARCHAR(50) NOT NULL DEFAULT 'shooting_target',
  location VARCHAR(100),
  status VARCHAR(20) DEFAULT 'offline',
  last_heartbeat TIMESTAMP,
  battery_level INTEGER,
  firmware_version VARCHAR(20),
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 建立 shooting_records 資料表
CREATE TABLE IF NOT EXISTS shooting_records (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  game_session_id INTEGER,
  player_id INTEGER,
  target_zone VARCHAR(20),
  score INTEGER NOT NULL,
  hit_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES arduino_devices(device_id)
);

-- 建立 device_logs 資料表
CREATE TABLE IF NOT EXISTS device_logs (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  log_type VARCHAR(20) NOT NULL,
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES arduino_devices(device_id)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_device_id ON arduino_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_status ON arduino_devices(status);
CREATE INDEX IF NOT EXISTS idx_game_session ON shooting_records(game_session_id);
CREATE INDEX IF NOT EXISTS idx_device_shooting ON shooting_records(device_id);
CREATE INDEX IF NOT EXISTS idx_hit_timestamp ON shooting_records(hit_timestamp);
CREATE INDEX IF NOT EXISTS idx_device_logs ON device_logs(device_id, created_at DESC);
EOF

  if [ $? -eq 0 ]; then
    echo "✅ 資料表建立完成"
  else
    echo "❌ 資料表建立失敗"
    exit 1
  fi
else
  echo "⚠️  未找到 DATABASE_URL,跳過資料表建立"
fi

echo ""
echo "📋 步驟 5/5: 複製檔案..."

# 檢查檔案是否存在
if [ -f "mqtt_integration/server_mqtt_service.ts" ]; then
  cp mqtt_integration/server_mqtt_service.ts server/services/mqttService.ts
  echo "✅ 已複製 mqttService.ts"
else
  echo "⚠️  找不到 server_mqtt_service.ts"
fi

if [ -f "mqtt_integration/DeviceManagement.tsx" ]; then
  cp mqtt_integration/DeviceManagement.tsx client/src/pages/Admin/DeviceManagement.tsx
  echo "✅ 已複製 DeviceManagement.tsx"
else
  echo "⚠️  找不到 DeviceManagement.tsx"
fi

echo ""
echo "========================================"
echo "  ✅ 安裝完成!"
echo "========================================"
echo ""
echo "📚 接下來的步驟:"
echo ""
echo "1. 整合 MQTT 服務到後端"
echo "   在 server/index.ts 中加入:"
echo "   import { initMQTTService } from './services/mqttService';"
echo "   initMQTTService();"
echo ""
echo "2. 整合 API 路由"
echo "   將 server_device_routes.ts 的內容加入到 server/routes.ts"
echo ""
echo "3. 整合前端路由"
echo "   在 client/src/App.tsx 中加入:"
echo "   <Route path=\"/admin/devices\" element={<DeviceManagement />} />"
echo ""
echo "4. 重啟 Replit"
echo ""
echo "📖 詳細說明請參考 INTEGRATION_CHECKLIST.md"
echo ""
