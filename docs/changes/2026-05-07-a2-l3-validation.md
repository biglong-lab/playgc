# A2 多人元件 L3 持久化驗證 — 2026-05-07

> 範圍：Phase 3 A2（按 next-action-guide 規劃）
> 狀態：✅ 程式碼層 + DB schema 層驗證完成
> 部署：尚未部署（待使用者明確指示）

---

## 背景

[next-action-guide.md](2026-05-07-next-action-guide.md) 列 Phase 3 A2 為「優先 2」：
- LockCoop / RelayMission / TerritoryCapture L1→L3 升級
- CollectiveScore / RoleAssign / QuestChain L0→L3 升級
- JigsawPuzzle / TreasureHunt / GpsCascade 補完

**接地調查發現**：9 個元件全部已在 2026-05-05（Phase 5 W18 期間）升至 L3 持久化版。next-action-guide 寫的「待升級」已過期。

實際待補：**驗證 L3 持久化真實可用**。

---

## 影響範圍

| 模組 | 變動 |
|------|------|
| `server/routes/test-only.ts` | +152 行：加 `seed-multi-game-with-page` 端點 + 9 元件 default config |
| `e2e/a2-multi-l3-smoke.spec.ts` | 新增：9 元件 × 2 test = 18 個 smoke e2e |
| `docs/runbooks/a2-l3-manual-verification.md` | 新增：實機驗證 checklist（補 e2e 不能驗的部分）|
| `.github/workflows/ci.yml` | 1 行：grep 加入 `A2 多人元件` |
| `docs/changes/2026-05-07-next-action-guide.md` | 修正 A2 狀態為「程式碼層完成 + 自動驗證通過 + 實機待驗」 |

---

## 解決方案

### 為什麼分自動 + 實機兩層

按 [ADR-0017](../decisions/0017-loop-mode-safeguards.md) 紅線 #10：「禁止用單元測試替代 e2e」、原指令要 e2e 必須用真瀏覽器跑「admin 建場 → 玩家加入 → 互動 → 持久化」完整流程。

**Playwright e2e 的本質限制**：
- 9 個元件全都需要 Firebase 玩家 auth + `isTeamMember` 檢查
- 自動化無法 bypass Firebase auth（除非改 auth 中間件，違反「auth 不能 bypass」精神）

**因此採取雙層驗證**：
1. **自動 e2e（70% 信心）**：建場 + page 載入 + DB schema 驗證
2. **實機 checklist（30% 信心）**：admin 真實登入 + 兩個瀏覽器 + 真實操作 + 重整還原

---

## 實作步驟

### `29916d7b` — A.1 擴充 test-only.ts
加 `POST /api/_test/seed-multi-game-with-page`：
- body：`{ pageType, config? }`
- 支援 9 個 L3 元件（lock_coop / relay_mission / territory_capture / collective_score / role_assign / quest_chain / jigsaw_puzzle / treasure_hunt / gps_cascade）
- 內建 `MULTI_L3_DEFAULT_CONFIGS` 提供最小可用 default config（含答案 / 點位 / 線索）
- 沿用 `seed-multi-game` 模式（gameMode=team / playerCount=2）

### A.2 + A.3 + A.4 — e2e + runbook + CI
- `e2e/a2-multi-l3-smoke.spec.ts`：18 test（9 元件 × 載入 + DB schema）
- `docs/runbooks/a2-l3-manual-verification.md`：分 G1/G2/G3 三組、逐元件勾選清單
- `.github/workflows/ci.yml`：grep 加 A2

---

## 驗證

### 自動 e2e（本地接地驗證 — 35/35 全綠）

```bash
# 殺現有 dev server
kill <npm-run-dev-pid>

# 帶 flag 重啟
ENABLE_E2E_HELPERS=true npm run dev

# 跑 e2e
npx playwright test --grep "黃金路徑|A2 多人元件"
```

結果：
- 黃金路徑（Phase 1 D4）：17/17 ✅
- A2 多人元件（本次）：18/18 ✅
- 總計 35/35 全綠

### 實機驗證（待補）

按 `docs/runbooks/a2-l3-manual-verification.md` 跑 9 個元件實機 checklist：
- G1（高風險 ws）：lock_coop / relay_mission / territory_capture
- G2（DB only）：collective_score / role_assign / quest_chain
- G3（DB 進階）：jigsaw_puzzle / treasure_hunt / gps_cascade

每個元件約 5-10 分鐘，全部約 60-90 分鐘。

**列入 next-action-guide 的「待驗事項」**，建議在下次有真實客戶 / 工作坊前跑一次。

---

## 順便修的 schema drift

接地驗證時發現本地 `gameplatform` DB 缺 3 個欄位（code 已加但 dev DB 沒同步）：
- `host_mode BOOLEAN NOT NULL DEFAULT FALSE`
- `host_token VARCHAR`
- `host_token_expires_at TIMESTAMP`

直接 ALTER TABLE 加上（dev DB only，生產應該已 push 過）。

⚠️ **如果其他 worktree 的開發者也碰到這個錯**，跑：
```bash
docker exec gameplatform-postgres psql -U postgres -d gameplatform -c "
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS host_mode BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS host_token VARCHAR;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS host_token_expires_at TIMESTAMP;
"
```

---

## 已知限制 / 後續優化

1. **e2e 沒驗 ws 即時推送**：因 auth 阻礙，需改實機驗證 checklist
2. **e2e 沒驗重整還原**：同上
3. **CI 只 grep "黃金路徑|A2 多人元件"**：其他 e2e（multi-player-components / saas-flow / battle-flow 等）仍未開放跑、若要全套放開需先確認沒 flaky

---

## 相關文件

- [Phase 3 規劃 next-action-guide](2026-05-07-next-action-guide.md)
- [Phase 1 D4 完整收尾](2026-05-07-phase-1-complete.md)
- [DBAC 整體規劃](2026-05-07-phase-dbac-plan.md)
- [實機驗證 checklist](../runbooks/a2-l3-manual-verification.md)
- [既有多人玩法 checklist](../runbooks/e2e-multiplayer-checklist.md)
- [ADR-0017 Loop 護欄](../decisions/0017-loop-mode-safeguards.md)
- [自動 e2e spec](../../e2e/a2-multi-l3-smoke.spec.ts)
