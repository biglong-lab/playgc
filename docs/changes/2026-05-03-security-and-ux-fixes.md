# 安全補強 + 使用者新問題修法 — 2026-05-03

> **範圍**：使用者回報 3 個 P0/UX 問題 + grep 找其他類似 silent fallback 補強
> **狀態**：已部署
> **部署 commit 範圍**：`f02b1652 .. 28218cdb`

---

## 背景

Codex 9 輪審查結束後（commit `355ea092` 部署）、繼續 /loop 推進過程：

1. **grep TODO 半成品**找到 Recur webhook 簽章驗證 stub（未爆彈、啟用付費前必修）
2. **使用者回報** 2 個 user-facing 問題：
   - super_admin 不需區域代號就能進後台、最近變成不輸入就無法登入
   - 單人遊戲對講機自動進入登入、不論玩家是否需要對講
3. **延伸 grep** 找其他 webhook signature 實作品質、發現 2 個次級問題

---

## 影響範圍

### Server
- `server/lib/recur-tw.ts` — 實作真正 HMAC SHA-256（之前 stub 直接 return true）
- `server/routes/payments.ts` — 簽章不通過直接 return 401（之前只 warn）
- `server/routes/auth.ts` — super_admin firebase-login 改用 db.select join 篩、防 findFirst 隨機抓非 super_admin
- `server/services/recur-client.ts` — verifyWebhookSignature 加長度檢查 + try/catch（防 throw 變 200 OK）
- `server/services/aihomi-adapter.ts` — verifyAihomiWebhookSecret 改用 timingSafeEqual

### Client
- `client/src/components/walkie/WalkieFloatingButton.tsx` — 加 hasTeam prop、單人模式不自動連
- `client/src/pages/GamePlay.tsx` — 傳 hasTeam={!!myTeam?.id}

### Tests
- `server/__tests__/recur-tw-signature.test.ts` — 10 個 HMAC SHA-256 unit tests
- `server/__tests__/auth.test.ts` — 加 vi.hoisted mockSelectChain + 22/22 全綠

---

## 解決方案

### P0-Security：Recur webhook 簽章驗證 stub
**未爆彈**：admin 一旦啟用 RECUR_KEY 就變 email spam 跳板
- 攻擊者 POST 假 `checkout.session.completed` → 寄付款成功 email 給 victim
- 修法：實作 HMAC SHA-256 hex + crypto.timingSafeEqual + 401 阻擋

### P0-User：super_admin 不需區域代號進後台
**根因**：同 firebaseUserId 有多個 admin_accounts、findFirst 隨機抓非 super_admin
- 生產 DB 確認：twfam4@gmail.com 有 4 個 accounts（3 field_director + 1 super_admin）
- 修法：用 `db.select().innerJoin(roles).where(super_admin + active).limit(1)` 篩出唯一 super_admin

### UX-User：單人遊戲對講機自動登入
**問題**：之前只看 sessionId、不論單人/多人都自動連 session 對講群
- 修法：加 hasTeam prop、auto-join 加 hasTeam 條件
- 多人組隊：自動連、體驗不變
- 單人模式：點開才看選單（邀請朋友 / 掃 QR / 輸入代碼）

### Security-Polish：補強另 2 個 webhook signature
- `services/recur-client.ts:verifyWebhookSignature` — 加長度檢查（防 timingSafeEqual throw 變 200 OK）
- `services/aihomi-adapter.ts:verifyAihomiWebhookSecret` — `===` → `crypto.timingSafeEqual`
- 4 個 webhook signature 全部統一安全姿態

---

## 實作步驟

| commit | 內容 |
|--------|------|
| `f02b1652` | P0-security: Recur webhook 簽章 HMAC SHA-256 + 10 tests + 401 阻擋 |
| `04b68d99` | P0: super_admin firebase-login 改 join 篩、findFirst 隨機抓非 super_admin |
| `df2c5855` | UX: 對講機 hasTeam prop、單人模式不自動連 |
| `cd766036` | Security-polish: recur-client 防 throw + aihomi timingSafeEqual |
| `0505212b` | docs: 紀錄 14:10 部署 |
| `28218cdb` | docs: 紀錄 14:25 webhook 統一 |
| `2fb3b9f5` | docs: 紀錄 14:35 milestone 156/2190 |

---

## 驗證

每個修法都經過：
- `npx tsc --noEmit` 0 錯誤
- `node scripts/smoke-test-scenarios.mjs` 51/51
- 對應路徑單元測試（auth / recur-tw-signature / webhook-recur）
- **完整 test:run：156 檔 / 2190 tests 全綠**

部署後 production e2e：
- `/api/scenarios/health` 200 + 12 情境 live
- `/api/v1/openapi.json` 200
- `/api/webhooks/line/health` 200 status:ok
- `/api/cron/health` 200
- `/api/payments/recur/webhook` POST → 503（KEY 未設、預期）
- `/api/admin/firebase-login` POST → 401（無 token、預期）
- 主頁 `/` 200
- CPU 0% / Memory 327MiB (21%)

---

## 已知限制 / 後續優化

1. **PhotoMosaic 候選 #2** 還沒實作（婚禮+場域用、玩家拍照即時拼貼）
2. **WebSocket schema 化**（用 zod 約束所有 ws 訊息防再次 silent 不一致）— 長期防護建議
3. **ShootingMissionPage hardcode userId/userName** 待後續修
4. **chart.tsx dangerouslySetInnerHTML** CSS 注入（目前無 client import、零攻擊面）

---

## 反思

**為何 Codex 9 輪結束後仍有真 bug**：
- Codex 9 輪聚焦 realtime 協定一致性、看不到「未爆彈 stub」這類「TODO 待補」silent fallback
- 使用者使用報告（super_admin 無法登入）來自實際操作、grep 看不出
- 4 個 webhook signature 風格不一是橫向問題、grep TODO 抓不到、靠延伸思考發現

**啟示**：
- Codex 自動掃 + 使用者回報 + 主動 grep 三條路徑互補、各自挖到不同類型 bug
- 上線前的「掃描階段」應包含：1) 自動審查 2) 使用者測試回報 3) 主動 grep TODO/stub
- 在 4 個地方做同樣事（webhook signature 驗證）→ 應該寫一個 shared util

---

## 相關文件

- [ADR-0014 Realtime 協定清理](../decisions/0014-realtime-protocol-cleanup.md)
- [docs/changes/2026-05-03-codex-realtime-cleanup.md] — 9 輪 Codex 審查紀錄
- [codex-claude/logs/2026-05-03.md](../../codex-claude/logs/2026-05-03.md) — 完整時序紀錄
