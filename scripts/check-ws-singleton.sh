#!/usr/bin/env bash
# 🌐 ADR-0018 規範檢查：禁止 new WebSocket() 在 Provider 之外
#
# 用途：CI 阻擋誤加新 ws connection
# 加進 .github/workflows/ci.yml
#
# 用法：
#   bash scripts/check-ws-singleton.sh
# 退出碼：
#   0 = 全部 OK
#   1 = 有違規

set -e

ALLOWED_FILES=(
  "client/src/contexts/WebSocketContext.tsx"
  # Phase 5 待處理（暫時例外）
  "client/src/components/game/solo/ShootingMissionPage.tsx"
  "client/src/hooks/use-match-websocket.ts"
)

VIOLATIONS=()

# 找所有 new WebSocket( 的出現
while IFS= read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  # 排除測試檔
  if [[ "$file" == *"__tests__"* ]] || [[ "$file" == *".test."* ]]; then
    continue
  fi

  # 檢查是否在白名單
  is_allowed=false
  for allowed in "${ALLOWED_FILES[@]}"; do
    if [[ "$file" == *"$allowed" ]]; then
      is_allowed=true
      break
    fi
  done

  if [[ "$is_allowed" == "false" ]]; then
    VIOLATIONS+=("$file")
  fi
done < <(grep -r "new WebSocket(" client/src --include="*.ts" --include="*.tsx" 2>/dev/null || true)

if [[ ${#VIOLATIONS[@]} -gt 0 ]]; then
  echo "❌ ADR-0018 違規：偵測到非 Provider 的 new WebSocket()："
  for v in "${VIOLATIONS[@]}"; do
    echo "   - $v"
  done
  echo ""
  echo "規範：所有 ws 通訊必須透過 useWebSocket() Provider"
  echo "詳情：docs/decisions/0018-realtime-architecture.md"
  exit 1
fi

echo "✅ ADR-0018 規範通過：所有 new WebSocket() 在白名單內"
exit 0
