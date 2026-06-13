# 現場模式 + Telegram 群組通知 + 體驗預約強化 — 2026-06-13

> 範圍：現場營運工具｜狀態：完成待部署｜部署：待使用者確認

## 背景
使用者需求：(1) 現場工作人員手機固定選單、只看現場工具不看一堆設定；(2) @twchito_bot
通報賈村群組（預約/今日預約/賈村遊戲）；(3) 體驗預約加人工登記 + 今日/本月/未來檢視。

## 一、現場模式（純前端、不動角色）
- 修 bug：`PlayerBottomNav` 漏排除 `/pos` → 玩家選單(遊戲/擂台/我的)蓋掉 POS 選單。補 `/pos`。
- `PosLayout` 底部 6 選單改現場常用：首頁/掃描/預約/收款/核銷/**排解**（排除遊戲障礙→/admin/troubleshoot）
- `PosDashboard` 加大按鈕：今日小結 + 排除障礙
- `AdminDashboard` 加「🏪 進入現場模式」醒目入口 → /pos
- 排解中心加「← 返回現場模式」

## 二、Telegram 群組通知
既有 `internal-notifier.ts` 已有 notifyBookingCreated / notifyPlayerJoined / notifyDailyReport。
- **分流設計**：個人 chat(`TELEGRAM_NOTIFY_CHAT_IDS`)收全部 ops；新增
  `TELEGRAM_FIELD_GROUP_CHAT_IDS`(賈村群組 `-5126162505`)只收 3 種顧客事件，不被部署/錯誤洗版
- `telegram-bot.ts` 加 `getFieldGroupChatIds()`；`internal-notifier.ts` 加 `sendToFieldGroup()`
- **預約通知** → notifyBookingCreated 加發群組
- **賈村遊戲開玩** → `notifyFieldGamePlay`（時間/遊戲名/帳號），wire 在 `player-sessions.ts`
  首次建立進度處，env `TELEGRAM_GAME_NOTIFY_FIELD_ID`(賈村 fieldId) 過濾、fire-and-forget
- **今日預約晨報** → 新 `today-bookings-cron.ts`（每天 08:00 Taipei）查賈村今日預約推群組

## 三、體驗預約強化
- **人工登記**（電話預約）：`createManualBooking`（直接 insert、不受 schedule template 限制、
  直接 confirmed、產 bookingCode+qrToken 可 POS 掃描）+ `POST /api/admin/bookings/:fieldId/manual`
  + AdminBookings 「➕ 人工登記」dialog
- **檢視**：AdminBookings 加 今日/本月/未來/全部 快速篩選（reuse 既有 list 端點 from/to）

## 新增 env（需加到生產 .env）
```
TELEGRAM_FIELD_GROUP_CHAT_IDS=-5126162505
TELEGRAM_GAME_NOTIFY_FIELD_ID=72cc204d-8481-4276-b913-0033d69bf654
```

## 驗證
- tsc PASS；單元 742 passed（2 既有 failing：battle-registration/locations，DB drift，非本次）
- bot 可存取群組「賈村點卷舖紀錄」(getChat 驗證)
- today-bookings-cron 啟動正常；今日預約 SQL(AT TIME ZONE)驗證可跑
- 現場模式路由 smoke 無崩潰

## 四、場域執行者現場帳號（純前端 + 權限）
- `ProtectedAdminRoute`：field_executor 只能停在 /pos、/admin/troubleshoot、scenario-qr-print，
  其餘 /admin 導回 /pos → 登入即現場、看不到設定
- `PosLayout` 對 field_executor 隱藏「後台」鈕
- field_executor 角色加 `game:edit`（seed + DB grant）→ 可做排障（重置/卡關救援）
- 退款權限 `field:manage`→`game:edit`（現場可退、仍強制理由+紀錄）

## 五、全域變更稽核（完備操作歷史）
- 新增 `server/middleware/audit-mutations.ts`：所有 /api/admin、/api/pos 的
  POST/PUT/PATCH/DELETE 成功後自動寫 audit_log（actor_admin_id + created_at + path +
  body 摘要 + ip），action 前綴 `http:`。掛在 routes/index.ts adminAuthMiddleware 後。
- 敏感欄位（password/token/secret…）自動遮罩；只記成功變更（<400）
- 既有語意化 logAuditAction 保留（細節）；中介層當完整覆蓋安全網、未來端點自動涵蓋
- audit_logs 不被 observability-cleanup-cron 刪（長期保留供查詢比對）
- 退款另存 refunds 表（reason min5 + 金額 + 操作者 + 時間）

## 需在生產 DB 跑的 grant（部署時）
```sql
INSERT INTO role_permissions (id, role_id, permission_id, allow)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r CROSS JOIN permissions p
WHERE r.system_role='field_executor' AND p.key='game:edit'
AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id=r.id AND rp.permission_id=p.id);
```

## 已知限制
- 賈村遊戲通報的 fieldId 用 env 過濾（單場域）；多場域未來可改 mapping
- 人工登記繞過容量檢查（現場人員自行判斷）
- 稽核中介層對有 logAuditAction 的端點會產生 1 筆 http: + 1 筆語意紀錄（刻意，完整性優先）
- 玩家自助流程（/api/bookings 等）暫不納入中介層（聚焦後台/現場操作）
