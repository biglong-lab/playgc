# Phase 4 W16 D4 — 排程推播：活動即將過期 reminder

**日期**：2026-05-03
**範圍**：W16 D4（依 ADR-0011 規劃）
**狀態**：🟢 W16 D4 完成、admin 過期前 1 小時自動收到 LINE reminder

---

## 🎯 目標達成

> ADR-0011 W16 D4 規劃：排程推播（cron）— 活動前 1 小時 reminder
> 從「靜默等過期」→「過期前 1 小時自動推 LINE 提醒」（避免活動意外結束）

---

## 📦 新增

### 1. `server/lib/expiring-session-checker.ts`

核心檢查 + 推播邏輯：

```ts
checkExpiringSessionsAndNotify(): Promise<{ scanned, notified, skipped, errors }>
pruneRemindedCache(): void  // 清快取（避免長期累積）
```

**規則**：
- 過濾：`hostMode=true` + `status='playing'` + `expiresAt ∈ [now+50min, now+70min]`
- ± 10 分鐘 buffer：搭配每小時 cron 不會漏 / 不會重複
- 已送過用 `Set<sessionId>` 防重複（記憶體 cache、重啟清空）
- 對所有 `LINE_ADMIN_USER_IDS` 推播（簡化版）

**LINE 訊息範本**：
```
⏰ 活動即將過期提醒

📦 Hung & Anita 婚禮 - 紀念牆
🆔 abc12345
⏰ 將於 1 小時內過期（14:30 UTC）

🖥 大螢幕：https://game.homi.cc/host/...

💡 用「@chito 結束 abc12345」可手動結束
```

### 2. `server/routes/cron-endpoints.ts`

兩個 endpoint：

**`GET /api/cron/health`**（公開）
- 不洩漏 secret、回 cronSecretConfigured / lineConfigured / adminConfigured 狀態
- 給監控系統 ping

**`POST /api/cron/check-expiring-sessions`**（CRON_SECRET 認證）
- `Authorization: Bearer <CRON_SECRET>`
- 觸發 `checkExpiringSessionsAndNotify()`
- 回 `{ ok, timestamp, result: { scanned, notified, skipped, errors } }`

### 3. 註冊到 server

`server/routes/index.ts` 加 `registerCronEndpoints(app)` 呼叫。

### 4. Smoke test 加 3 筆驗證

```
✅ GET /api/cron/health（公開、不洩漏 secret）
✅ POST /api/cron/check-expiring-sessions（無 token → 401/503）
✅ POST /api/cron/check-expiring-sessions（錯誤 token → 401/503）
```

Smoke test 從 45 → 48。

---

## 💡 設計決策

### 為何用 endpoint 而非 cron 容器？

選擇：HTTP endpoint + 系統 crontab 觸發

理由：
- 既有 `cron-daily.cjs` 容器只跑一天一次、不適合每小時任務
- 加新 cron 容器需 docker-compose 變動（風險高）
- HTTP endpoint：systemd / crontab / k8s CronJob 都可觸發
- 本地測試方便（直接 curl）

**部署範例 crontab**：
```bash
# 每小時跑（每小時 00 分）
0 * * * * curl -X POST https://game.homi.cc/api/cron/check-expiring-sessions \
          -H "Authorization: Bearer $CRON_SECRET" -s
```

### 為何 ± 10 分鐘 buffer？

選擇：偵測 [50min, 70min] 範圍

理由：
- 假設每小時 00 分跑、若只看「正好 60 分」會漏掉 :05 / :10 後到期的
- ± 10 分鐘 = 偵測一個 20 分鐘窗口、足以涵蓋
- 上下界搭配 `remindedSessions` Set 不會重複送
- 萬一 cron 漏跑一次（系統重啟）下次仍可補

### 為何用 Set 而非 DB column？

選擇：`Set<sessionId>` 記憶體快取

理由：
- 紅線：「Schema 只新增不刪除」
- 加 `lastReminderSentAt` column 需 migration
- Reminder 是「短期事件」（1 小時內過期 → 重啟後 session 早結束）
- 重啟頻率低（每次部署）+ 重啟最多重送 1 次（admin 不太困擾）
- 簡化 + 可運作 = 足夠

### 為何不用個別 admin 對應 fieldId？

選擇：所有 admin 都收到通知（broadcast）

理由：
- W15 D5 已有 `LINE_ADMIN_FIELD_<short>` 環境變數對應
- 但活動即將過期是「重要事件」、所有 admin 知道沒壞處
- 簡化 W16 D4 範圍（避免增加 fieldId 過濾邏輯）
- W17 評估若噪音太多再加過濾

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- Smoke test：45 → 48（cron health + 兩個 unauthorized 驗證）

---

## 🔗 環境變數（W16 D4 新增）

```bash
# 必要：cron secret
CRON_SECRET=<random-32-char-secret>

# 必要：LINE 推播
LINE_CHANNEL_ACCESS_TOKEN=xxx

# 必要：admin 名單
LINE_ADMIN_USER_IDS=Uabc...,Uxyz...

# 可選：base URL（讓訊息 URL 帶 domain）
APP_BASE_URL=https://game.homi.cc
```

---

## 📊 admin LINE 工具鏈完整性（W15-W16 累積）

| 操作 | 觸發方式 | 階段 |
|------|----------|------|
| 建場 | admin 主動 LINE | W15 D5 |
| 看用法 / list / active | admin 主動 LINE | W15-W16 D3 |
| 結束某場 | admin 主動 LINE | W16 D3 |
| **過期前 reminder** | **系統自動推 LINE** | **W16 D4** |

完整 admin 體驗 ✅

---

## ⏭ 下一步：W16 D5

依 ADR-0011 規劃：
- W16 D5：Phase 4 整體收尾（W13-W16 retro）+ ADR-0012 Phase 5 規劃
- 評估 Phase 5 方向：國際化 / 第二場域擴張 / 客戶招募

---

## 🔗 相關文件

- [W16 D3 LINE admin 管理](2026-05-03-phase4-w16-d3-line-admin-actions.md)
- [W15 D5 admin 真建場](2026-05-03-phase4-w15-d5-admin-instantiate.md)
- [ADR-0011 W16 規劃](../decisions/0011-w16-planning.md)
