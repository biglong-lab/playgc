#!/usr/bin/env bash
# 🧹 排除自動存檔雜訊的 git 查詢
#
# 背景（ADR-0024）：本 repo 有外部工具持續產生 `chore(auto): 自動存檔` commit，
# 近 6 個月 7162 個 commit 中有 5878 個（82%）是這種雜訊。
# 結果是 git log / blame / bisect 幾乎失效 —— 要追「這個 bug 什麼時候進來的」時，
# 訊號被雜訊蓋住，每次除錯都被拖慢。
#
# 這支不改寫歷史（安全），只是查詢時把雜訊濾掉。
#
# 用法：
#   npm run log                              最近 20 筆真實 commit
#   npm run log -- -50                       最近 50 筆
#   npm run log -- -- server/routes/x.ts     某檔案的真實修改史
#   npm run log:stat -- -- <file>            含變更行數
#   npm run log:who -- <file>                誰改過這個檔案（取代 blame）
set -euo pipefail

NOISE='chore(auto)'
MODE="${1:-log}"
shift || true

case "$MODE" in
  log)
    exec git log --invert-grep --grep="$NOISE" --oneline --decorate "${@:--20}"
    ;;
  stat)
    exec git log --invert-grep --grep="$NOISE" --stat --format="%C(yellow)%h%Creset %ad %s" \
      --date=format:'%m/%d' "${@:--10}"
    ;;
  who)
    # blame 沒有 --invert-grep，改用「誰在真實 commit 中動過此檔」
    if [[ $# -eq 0 ]]; then echo "用法: npm run log:who -- <file>"; exit 1; fi
    git log --invert-grep --grep="$NOISE" --format="%an" -- "$@" \
      | sort | uniq -c | sort -rn
    ;;
  count)
    total=$(git log --oneline "$@" | wc -l | tr -d ' ')
    noise=$(git log --oneline --grep="$NOISE" "$@" | wc -l | tr -d ' ')
    real=$(git log --oneline --invert-grep --grep="$NOISE" "$@" | wc -l | tr -d ' ')
    awk -v t="$total" -v n="$noise" -v r="$real" 'BEGIN{
      printf "全部 %s / 雜訊 %s (%.0f%%) / 真實 %s\n", t, n, (t>0? n*100/t : 0), r
    }'
    ;;
  *)
    echo "未知模式: $MODE（可用 log / stat / who / count）"; exit 1
    ;;
esac
