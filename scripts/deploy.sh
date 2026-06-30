#!/bin/bash
# 🚀 完整部署 + 嚴格驗證（防止 build fail 但 exit 0 偽成功）
# pipefail：確保 pipe 中任何一步 fail 都 exit 非零（否則 | tail 會吞 exit code）
set -eo pipefail
#
# 背景：docker compose up -d --build app 即使 build fail 也會用舊 image 重啟，
#      exit 0 騙人以為成功。過去 5 輪部署因為 auto-hook 漏檔導致 build fail
#      但沒人發現。
#
# 這支腳本做：
#   1. 檢查本地 uncommitted 檔案
#   2. git push
#   3. SSH pull + docker build（抓 build 錯誤）
#   4. 比對 git HEAD（local vs server）
#   5. 比對 bundle hash（container 內 vs 外部 curl）
#   6. 若任一驗證失敗 → 退出並報錯
#
# 用法：
#   npm run deploy             # 正常部署
#   VERIFY_SYMBOL=xxx npm run deploy  # 額外 grep container 確認新 symbol

SSH_HOST="${SSH_HOST:-root@172.233.89.147}"
SSH_PORT="${SSH_PORT:-52099}"   # ⚠️ 生產 SSH 在 52099（非 22），漏帶會 connection refused
PROD_PATH="${PROD_PATH:-/www/wwwroot/game.homi.cc}"
APP_CONTAINER="${APP_CONTAINER:-gamehomicc-app-1}"
PROD_URL="${PROD_URL:-https://game.homi.cc}"

# ═══ 色彩輸出 ═══
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_step()  { echo -e "\n${BLUE}═══ $1 ═══${NC}"; }
log_ok()    { echo -e "${GREEN}✓${NC} $1"; }
log_warn()  { echo -e "${YELLOW}⚠️ ${NC} $1"; }
log_fail()  { echo -e "${RED}❌${NC} $1"; }

# ═══ 1/6 檢查本地狀態 ═══
log_step "1/6 檢查本地狀態"

# 🔒 安全原則：部署前工作區必須乾淨。
#    不再自動 git add -A / 自動 commit —— 那會把無關半成品、DB dump、報告一起送上線。
#    請先自行 commit 想部署的變更，再執行部署。
if [[ -n "$(git status -s)" ]]; then
  log_fail "工作區有未提交的變更，為避免誤把無關檔案部署上線，已中止。"
  log_fail "請先檢視並自行 commit 要部署的內容後再試："
  git status -s
  # 急用時可用 DEPLOY_FORCE=1 略過（自負風險，不會自動 commit）
  [[ "$DEPLOY_FORCE" != "1" ]] && exit 1
  log_warn "DEPLOY_FORCE=1：略過乾淨度檢查（未提交變更不會被部署）"
fi

LOCAL_SHA=$(git rev-parse HEAD)   # 🔧 改用完整 40 字元 SHA，避免 git 短 SHA 長度不一致的誤判
log_ok "本地 HEAD: ${LOCAL_SHA:0:7} ($(git log -1 --format='%s' | head -c 60))"

# ═══ 1.5/6 TypeScript 型別檢查 ═══
# 背景：vite build 用 esbuild，會忽略 type 錯誤，type bug 會悄悄上線。
#      這裡用 tsc --noEmit 擋掉，10-20 秒換無 type bug 的 deploy。
# 跳過：SKIP_TYPECHECK=1 npm run deploy（特別急時）
if [[ "$SKIP_TYPECHECK" != "1" ]]; then
  log_step "1.5/6 TypeScript 型別檢查"
  if ! npx tsc --noEmit 2>&1 | head -50; then
    log_fail "TypeScript 有型別錯誤，deploy 中止（修完再試，或用 SKIP_TYPECHECK=1 強制）"
    exit 1
  fi
  # tsc 成功時沒 output，再補 ok
  log_ok "TypeScript 零錯誤"
else
  log_warn "SKIP_TYPECHECK=1 跳過型別檢查"
fi

# ═══ 2/6 push 到 GitHub ═══
log_step "2/6 push 到 GitHub"
git push origin main
log_ok "已推送"

# ═══ 3/6 SSH pull + docker build ═══
log_step "3/6 生產端 pull + docker build（約 2-4 分鐘）"
# 🆕 傳 GIT_SHA 給 docker build，讓前端能顯示 bundle 版本
BUILD_OUTPUT=$(ssh -p "$SSH_PORT" -o StrictHostKeyChecking=accept-new "$SSH_HOST" \
  "cd $PROD_PATH && git pull origin main 2>&1 && GIT_SHA=\$(git rev-parse --short HEAD) docker compose -f docker-compose.prod.yml up -d --build app 2>&1" || true)

echo "$BUILD_OUTPUT" | tail -12

# 抓 build 錯誤（docker compose up --build fail 時仍 exit 0，要自己 parse）
# 只 match docker buildkit / npm / esbuild 的明確失敗訊號，避免誤中 log 裡的 "error" 單字
BUILD_ERR_PATTERN='^#[0-9]+ ERROR|^failed to solve:|^Error: Build failed with|^npm ERR!|did not complete successfully'
if echo "$BUILD_OUTPUT" | grep -qE "$BUILD_ERR_PATTERN"; then
  log_fail "docker build 失敗！匹配到的錯誤行："
  echo "$BUILD_OUTPUT" | grep -E "$BUILD_ERR_PATTERN" | head -10
  echo ""
  log_fail "詳細 log（末 30 行）："
  echo "$BUILD_OUTPUT" | tail -30
  exit 1
fi

# 另外正面確認「Container gamehomicc-app-1 Started」出現
if ! echo "$BUILD_OUTPUT" | grep -q "Container $APP_CONTAINER Started"; then
  log_fail "看不到 'Container $APP_CONTAINER Started'，docker 可能沒重啟 app"
  echo "$BUILD_OUTPUT" | tail -15
  exit 1
fi
log_ok "docker build + container 重啟（Image Built + Container Started 都有）"

# ═══ 4/6 等 container 健康 ═══
log_step "4/6 等 container 穩定（15 秒）"
sleep 15

# ═══ 5/6 驗證 git HEAD 一致 ═══
log_step "5/6 驗證 git HEAD 一致"
REMOTE_SHA=$(ssh -p "$SSH_PORT" "$SSH_HOST" "cd $PROD_PATH && git rev-parse HEAD")   # 🔧 同步用完整 SHA
if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
  log_fail "git HEAD 不一致：本地 ${LOCAL_SHA:0:7} != 伺服器 ${REMOTE_SHA:0:7}"
  exit 1
fi
log_ok "git HEAD 一致: $LOCAL_SHA"

# ═══ 6/6 驗證 bundle hash 一致 ═══
log_step "6/6 驗證 bundle hash 一致"
CONTAINER_HASH=$(ssh -p "$SSH_PORT" "$SSH_HOST" \
  "docker exec $APP_CONTAINER cat /app/dist/public/index.html 2>/dev/null | grep -oE 'index-[A-Za-z0-9_-]+\\.js' | head -1" || echo "")
if [[ -z "$CONTAINER_HASH" ]]; then
  log_fail "container 內找不到 bundle（docker build 可能沒真的生成前端）"
  exit 1
fi
log_ok "container bundle: $CONTAINER_HASH"

EXT_HASH=$(curl -s "$PROD_URL/?_t=$(date +%s)" \
  -H "Cache-Control: no-cache" \
  | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1 || echo "")
if [[ -z "$EXT_HASH" ]]; then
  log_warn "外部 curl 失敗，跳過此檢查"
elif [[ "$CONTAINER_HASH" != "$EXT_HASH" ]]; then
  log_warn "container ($CONTAINER_HASH) vs 外部 ($EXT_HASH) 不同，可能 nginx 快取"
  log_warn "等 1 分鐘後再次 curl 確認"
else
  log_ok "外部 curl 一致: $EXT_HASH"
fi

# 額外：grep 指定 symbol（可選）
if [[ -n "$VERIFY_SYMBOL" ]]; then
  log_step "進階驗證: grep '$VERIFY_SYMBOL'"
  COUNT=$(ssh -p "$SSH_PORT" "$SSH_HOST" "docker exec $APP_CONTAINER grep -rc '$VERIFY_SYMBOL' /app/dist/public/assets/ 2>/dev/null | grep -v ':0' | head -3")
  if [[ -z "$COUNT" ]]; then
    log_warn "找不到 symbol '$VERIFY_SYMBOL'（可能被 minify，但 bundle 有更新就算 OK）"
  else
    log_ok "symbol 在 bundle 內：$COUNT"
  fi
fi

echo ""
echo -e "${GREEN}🎉 部署完成${NC}"
echo -e "   commit: $LOCAL_SHA"
echo -e "   bundle: $CONTAINER_HASH"
echo -e "   URL:    $PROD_URL"
echo ""
