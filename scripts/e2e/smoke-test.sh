#!/usr/bin/env bash
# 🔍 Admin + Platform Smoke Test
#
# 用法：
#   ./scripts/e2e/smoke-test.sh [endpoints-file] [base-url] [token]
#
# 範例：
#   ./scripts/e2e/smoke-test.sh scripts/e2e/endpoints-platform.txt https://game.homi.cc
#   TOKEN=xxx ./scripts/e2e/smoke-test.sh scripts/e2e/endpoints-admin.txt
#
# endpoints 檔案格式（每行一個）：
#   METHOD /path expected_status [auth_required]
#   GET /api/platform/overview 401 yes
#   GET /api/health 200 no

set -uo pipefail

ENDPOINTS_FILE="${1:-scripts/e2e/endpoints-platform.txt}"
BASE_URL="${2:-https://game.homi.cc}"
TOKEN="${TOKEN:-${3:-}}"

if [ ! -f "$ENDPOINTS_FILE" ]; then
  echo "❌ 找不到 endpoints 檔案: $ENDPOINTS_FILE" >&2
  exit 1
fi

# 統計
TOTAL=0
PASS=0
FAIL=0
SKIP=0
FAILS=()

# 輸出標頭
echo "🔍 Smoke Test 開始"
echo "  Endpoints file: $ENDPOINTS_FILE"
echo "  Base URL: $BASE_URL"
echo "  Token: $([ -n "$TOKEN" ] && echo 'provided' || echo 'none (測未認證 401)')"
echo "  ────────────────────────────────────────────────────────"
printf "  %-6s %-50s %-12s %s\n" "METHOD" "PATH" "EXPECT" "RESULT"
echo "  ────────────────────────────────────────────────────────"

while IFS= read -r line || [ -n "$line" ]; do
  # 跳過註解 + 空行
  [[ -z "$line" ]] && continue
  [[ "$line" =~ ^[[:space:]]*# ]] && continue

  # 解析格式
  read -r method path expected auth <<<"$line"

  # 預設值
  expected="${expected:-200}"
  auth="${auth:-no}"

  # 跳過需要 auth 但沒 token 的 200 預期（留給其他測試）
  if [ "$auth" = "yes" ] && [ -z "$TOKEN" ] && [ "$expected" = "200" ]; then
    SKIP=$((SKIP + 1))
    printf "  %-6s %-50s %-12s ⏭️  SKIP (no token)\n" "$method" "$path" "$expected"
    continue
  fi

  TOTAL=$((TOTAL + 1))

  # 構造 curl
  url="${BASE_URL}${path}"
  curl_args=(-sS -o /dev/null -w '%{http_code}' -X "$method" --max-time 10)
  if [ -n "$TOKEN" ]; then
    curl_args+=(-H "Authorization: Bearer $TOKEN")
  fi

  actual=$(curl "${curl_args[@]}" "$url" 2>/dev/null || echo "ERR")

  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS + 1))
    printf "  %-6s %-50s %-12s ✅ %s\n" "$method" "$path" "$expected" "$actual"
  else
    FAIL=$((FAIL + 1))
    FAILS+=("$method $path expect=$expected actual=$actual")
    printf "  %-6s %-50s %-12s ❌ %s\n" "$method" "$path" "$expected" "$actual"
  fi
done < "$ENDPOINTS_FILE"

# 結果
echo "  ────────────────────────────────────────────────────────"
echo "📊 結果：通過 $PASS / 失敗 $FAIL / 跳過 $SKIP / 總共 $TOTAL"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "❌ 失敗清單："
  for f in "${FAILS[@]}"; do
    echo "  - $f"
  done
  exit 1
fi

echo "✅ 全部通過"
exit 0
