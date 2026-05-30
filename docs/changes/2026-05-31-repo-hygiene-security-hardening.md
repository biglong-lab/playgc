# Repo 衛生 + 安全護欄 + CI 可信度 — 2026-05-31

> **範圍**：repo 衛生、安全護欄、CI/工具鏈可信度
> **狀態**：Phase 0/1/2 完成並**已部署上線**（commit `20b1c8b6`）；Phase 3/4/5/6 待議
> **部署 commit 範圍**：`0bbe24c9..20b1c8b6`（2026-05-31 部署，生產驗證全綠）
> **觸發**：唯讀盤點報告 + `/plan` 通盤分析

---

## 背景

一輪唯讀盤點發現多項 repo 衛生、安全與 CI 可信度問題。逐項親自核實後（行號全對得上），依「低風險→高風險、每階段獨立可驗證可回滾」分階段修補。核心約束：不自動部署、不自動 push、Schema 只加不刪、force push 需明確授權。

關鍵釐清：
- sandbox 的「測試 574 失敗 / smoke 0/51」是**執行環境限制造成的假數據**，正常本機重跑後真實只有 **53 個既有失敗**（測試 mock 品質債，非產品 bug）。
- `backups/prod-*.dump` 確認是含生產資料的完整 pg_dump。但 repo **未推到公開 GitHub**，故非公開外洩，歷史清理（Phase 4）降為非緊急、延後處理。

---

## 影響範圍

| 檔案 | 變更 |
|------|------|
| `.gitignore` | 補 `backups/ coverage/ playwright-report/ test-results/` |
| `backups/ coverage/ playwright-report/ test-results/` | `git rm --cached` 停止追蹤（本機檔保留）|
| `eslint.config.js` | ignores 補 `.cache/** coverage/** playwright-report/** test-results/** backups/**` 等 |
| `vitest.config.ts` | `retry` 由全域 `2` 改 `CI ? 0 : 1` |
| `.github/workflows/ci.yml` | 補 ESLint 步驟（暫 `continue-on-error`）；移除 E2E drizzle push 的 `continue-on-error` |
| `server/index.ts` | API logger 加敏感欄位遮罩 + 截斷，production 不記 response body；`/api/health/detail` 加 `HEALTH_SECRET` 守門 |
| `server/utils/rate-limiters.ts` | 用 `ipKeyGenerator` 正規化 IPv6，防後綴繞限速 |
| `scripts/deploy.sh` | 移除自動 `git add -A` + 自動 commit，改成「工作區不乾淨即中止」 |
| `.github/workflows/deploy.yml` | health check 失敗 `exit 1`；修正預設路徑為 `game.homi.cc`；注入 `GIT_SHA` |
| `scripts/seed.ts` | production 守門（需 `SEED_FORCE=1`）；admin 密碼改吃 `SEED_ADMIN_PASSWORD` |

---

## 解決方案（依階段）

- **Phase 0 止血**：停止追蹤 DB dump 與 CI 產物，補 gitignore。僅停止追蹤、不動歷史。
- **Phase 1 CI/工具鏈可信度**：修 ESLint ignores（lint 結果從 16 萬噪音→真實 345 errors/1514 warnings）、CI 補 lint、移除掩蓋 schema 問題的 continue-on-error、retry 在 CI 設 0（測試從 547 秒→約 30 秒）。
- **Phase 2 安全護欄**：logger 遮罩、health/detail 守門、IPv6 限速、deploy.sh 不再自動收檔、deploy.yml health 失敗即失敗、seed 生產守門 + 密碼環境變數化。

---

## 驗證

- `npx tsc --noEmit`：零錯誤（Phase 1、Phase 2 後各驗一次）。
- `CI=1 npm run test:run`：**53 failed / 3082 passed / 2 skipped**，與改動前基線一致；9 個失敗檔全為 WebSocketProvider context mock 洩漏 + db mock 未設好的既有測試品質債，無一是本次改動的檔案。失敗檔數在 9↔10 擺動，證實為 flake 非確定性 regression。
- 受影響的 `server/__tests__/playerSessions.test.ts` 隔離跑 17/17 通過。

---

## 已知限制 / 後續優化

- **Phase 3（body 上限）**：`express.json` 全域 `50mb` 是上傳所需（圖片/影片/音訊以 base64 走 JSON body），上傳端點散落多個路徑前綴，盲降會讓生產上傳噴 413。需可測試的審慎變更（路徑分層或遷移 multipart）。**待專門處理。**
- **Phase 4（Git 歷史清理 dump）**：repo 未公開，非緊急。轉公開前須先做 `git filter-repo` + force push（需明確授權）。
- **Phase 5（大檔拆分）**：25 檔超 800 行（最大 `shared/scenario-templates.ts` 5106 行）。需在 Phase 1 可信測試基線上分小 PR 進行，獨立週期。
- **Phase 6（文件/維運）**：PROGRESS/STATUS 落後、runbook scp 與全域禁 scp 矛盾、`docker-compose.prod.yml` LiveKit `:latest` 待鎖版本（需先確認生產實際版本）。
- CI 的 ESLint 暫 `continue-on-error`，待 345 errors 清乾淨後轉硬閘門。

## 相關文件

- 文件機制：[docs/README.md](../README.md)
- 部署 runbook：[docs/runbooks/deploy.md](../runbooks/deploy.md)
