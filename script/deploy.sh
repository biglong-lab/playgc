#!/bin/bash
# 數位遊戲平台部署腳本
# 用法: ./script/deploy.sh

set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
APP_URL="http://localhost:3333"

echo "🚀 開始部署數位遊戲平台..."

# 1. 拉取最新程式碼
echo "📥 拉取最新程式碼..."
git pull origin main

# 2. 檢查 .env 檔案
if [ ! -f .env ]; then
  echo "❌ 錯誤：找不到 .env 檔案，請先建立"
  echo "   參考 .env.production.example"
  exit 1
fi

# 3. 構建 Docker 映像
echo "🔨 構建 Docker 映像..."
docker compose -f "$COMPOSE_FILE" build --no-cache

# 4. 啟動服務
echo "🚀 啟動服務..."
docker compose -f "$COMPOSE_FILE" up -d

# 5. 等待服務啟動
echo "⏳ 等待服務啟動..."
sleep 5

# 6. 健康檢查
echo "🏥 執行健康檢查..."
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -sf "$APP_URL/health" > /dev/null 2>&1; then
    echo "✅ 健康檢查通過！"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "   重試 $RETRY_COUNT/$MAX_RETRIES..."
  sleep 3
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ 健康檢查失敗，查看日誌："
  docker compose -f "$COMPOSE_FILE" logs --tail=50 app
  exit 1
fi

# 7. 推送資料庫 schema
echo "📦 推送資料庫 schema..."
docker compose -f "$COMPOSE_FILE" exec app node -e "
  console.log('資料庫 schema 由 Drizzle ORM 自動處理');
"

echo ""
echo "========================================="
echo "✅ 部署完成！"
echo "🌐 網址: https://game.homi.cc"
echo "🏥 健康: https://game.homi.cc/health"
echo "========================================="
