# 後台導航重構 + 排解中心 — 2026-05-19 起

> 範圍：選單依使用情境 5 群重組、新增「排解中心」處理現場問題
> 狀態：🟡 Phase A 完成、B-E 推進中
> 觸發：業主 5/19 凌晨「整體選單超級複雜、希望優化」+ POS 修正後續

---

## 背景

5/18 多活動 POS 整合上線後、admin 端累積 40+ 個選單項目分 5 中心、業主回饋：

> 「整體超級複雜、使用情境（設計遊戲 / 管理設定 / 現場 POS / 遊戲紀錄 / 排解）切換不易」

業主歸納的 5 大實際使用情境：

| 情境 | 頻率 | 主要使用者 |
|------|------|------|
| 🎮 設計遊戲 | 偶爾 | 業主自己 |
| ⚙️ 管理設定 | 偶爾 | 業主 |
| 💰 現場營運（POS） | 每天 | 工讀生 / 業主 |
| 📊 紀錄查詢 | 不定 | 業主 |
| 🆘 排解問題 | 發生時 | 業主 + 工讀 |

並要求新增「現場可排解問題」能力：
- **遊戲重置**：客人遊戲出狀況、現場讓他重新來、需注記原因 + 時間 + 操作者
- **退款處理**：客人爭議、現場退錢、留紀錄
- **預約調整**：改梯次（已實作於 POS）、強制核銷
- **操作審計**：所有操作都應記錄時間 + 操作者、才能事後追查

---

## 解決方案：5 群情境化選單 + 排解中心

### Phase A：選單重組（✅ 完成）

從 12 分組 / 40+ 項收斂成 5 群：

```
🎮 設計（violet） — 開發遊戲、設定活動、做素材
   ├─ 遊戲管理 / 模組庫 / 活動管理 / 預約管理
   ├─ 進行中場次 / 即時連線監控 / 主控大螢幕
   ├─ 活動結束報告 / 元件健康度 / 元件開關
   └─ 對戰系統 5 項（需 battle 模組）

💰 現場（amber） — POS 收款、報到、券核銷（手機優先）
   ├─ POS 工作站 / QR 掃描 / 今日預約
   ├─ 現場收款 / 券核銷 / 今日小結
   └─ 設備管理 / QR Code 發布

🆘 排解（red） — 客人現場出問題：重來、退款、改梯次、補償 ★新增
   ├─ 排解中心首頁
   ├─ 遊戲重置 / 退款處理 / 預約調整 / 玩家補償
   └─ 排解紀錄（過濾 audit_logs 排解類）

📊 紀錄（blue） — 數據、營收、玩家、操作歷史
   ├─ 儀表板 / 數據分析 / PWA 分析 / 排行榜
   ├─ 玩家管理
   ├─ 營收 4 項（需 payment 模組）
   └─ 操作記錄

⚙️ 設定（slate） — 場域、帳號、權限、計費、整合
   ├─ 我的方案 / 場域基本 / 進階設定 / LINE 設定
   └─ 角色管理 / 管理員帳號 / 系統設定
```

#### 實作細節
- `client/src/config/admin-menu.ts` v2 → v3
- 新增 `description` 欄位（給 sidebar group label tooltip 用）
- 新增 `comingSoon` 欄位（標記未實作功能、顯示「規劃中」徽章）
- `filterMenuByPermissions` + `filterMenuByModules` 保留不動
- 對戰、財務不再獨立分組、依屬性分散到「設計」「紀錄」

#### 排解中心佔位
- 建 `client/src/pages/admin/troubleshoot/TroubleshootComingSoon.tsx`
- 6 個排解子路由全部指向佔位頁、顯示 Phase + 一句話描述
- 業主點到時知道「正在做、預期 X」、不會 404

#### UnifiedAdminLayout 強化
- group label 加 `title` 屬性（hover 顯示 description）
- item 加「規劃中」Badge（comingSoon 時）

#### Phase A 變動檔案
| 檔案 | 變動 |
|------|------|
| `client/src/config/admin-menu.ts` | 完全重寫、5 群結構 |
| `client/src/components/UnifiedAdminLayout.tsx` | +description tooltip / +comingSoon badge |
| `client/src/pages/admin/troubleshoot/TroubleshootComingSoon.tsx` | 新檔（佔位頁）|
| `client/src/App.tsx` | +TroubleshootComingSoon lazy import / +6 routes |

---

### Phase B：審計覆蓋（⏳ 待實作）

盤點目前**未記錄**到 `auditLogs` 表的操作、補上 `logAuditAction()`：

| 操作 | endpoint | 動作 key |
|------|---------|----------|
| 預約報到 | `POST /pos/bookings/:id/check-in` | `booking_checkin` |
| 強制核銷 | 同上 + `force: true` | `booking_force_checkin` |
| 改梯次 | `POST /pos/bookings/:id/reschedule` | `booking_reschedule` |
| 預約取消（業主） | （新）`POST /admin/bookings/:id/cancel` | `booking_cancel` |
| 券核銷 | `POST /pos/voucher/redeem` | `voucher_redeem` |
| POS 收款 | `POST /pos/checkout` | `pos_checkout` |
| 密碼修改 | `POST /admin/me/password` 等 | `password_change` |

每筆 audit 帶 `actor_admin_id` / `action` / `targetType` / `targetId` / `metadata`（含原因 / 強制原因）/ `ipAddress`。

---

### Phase C：遊戲重置（⏳ 待實作）

#### Schema（ADD COLUMN only）
```sql
ALTER TABLE game_sessions ADD COLUMN reset_count int DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN reset_history jsonb DEFAULT '[]'::jsonb;
-- reset_history: [{ at, byAdminId, reason, fromChapterId, fromScore }]
```

#### 後端：`POST /api/admin/sessions/:id/reset`
- 必填 `reason`（≥ 10 字）
- 記錄到 `reset_history` + 寫 `auditLogs`
- 清 `playerProgress` 對應 session 紀錄
- 推 LINE 通知玩家「您的遊戲已被工作人員重置、原因：XXX」

#### 前端
- `/admin/troubleshoot/reset` 取代佔位頁
- 流程：輸入 session ID 或預約碼 → 顯示當前進度 → 輸入原因 → 二段確認

---

### Phase D：退款（⏳ 待實作、等金流商戶帳號）

#### Schema
```sql
CREATE TABLE refunds (
  id serial PRIMARY KEY,
  field_id varchar(50) NOT NULL,
  transaction_id varchar NOT NULL,
  booking_id int,
  amount_cents int NOT NULL,
  reason text NOT NULL,
  refund_method varchar(20) NOT NULL, -- cash / recur / stripe
  status varchar(20) NOT NULL,
  processed_by_staff_id varchar NOT NULL,
  processed_at timestamp,
  metadata jsonb,
  created_at timestamp DEFAULT NOW()
);
```

#### 範圍
- cash 退款：直接 completed（業主現場退錢）
- 線上退款：先 pending、等 Recur.tw / Stripe API 串接

---

### Phase E：排解中心首頁（⏳ 待實作）

`/admin/troubleshoot` 一頁含：
- **快速操作**：4 大卡片（重置 / 退款 / 改梯次 / 補償）
- **今日異常**：自動列出（status=cancelled 但已 paid、reset_count > 0、refund pending）
- **最近排解**：拉 `audit_logs` 過濾「排解類 action」近 50 筆
- **搜尋**：用預約碼 / session ID / LINE ID 跳到對應的工具
- **玩家補償**：補券 / 補進度 / 補積分

---

## 設計取捨

| 取捨 | 選擇 | 理由 |
|------|------|------|
| 完全替換 vs 加切換按鈕 | 完全替換 | 業主說「整體超級複雜」→ 不留舊版混淆 |
| Phase A 同時新增佔位頁 vs 等 B-E 一起做 | 同時新增 | 業主可立即看到「排解」分組、知道方向 |
| comingSoon 用灰階 vs 帶徽章 | 帶徽章 | 業主能一眼分辨「現在能用」vs「規劃中」 |
| 對戰 / 財務 獨立分組 vs 併入 | 併入 | 5 群比 12 群好認；對戰歸「設計」、財務歸「紀錄」更符合使用情境 |

---

## 業主 5 個未確認決策（影響 Phase C-E）

1. **遊戲重置權限**：`field_manager` 以上才能、或 `field_executor` 可申請？
2. **退款上限防呆**：單筆 ≥ NT$1000 是否需 super_admin 確認？
3. **玩家補償範圍**：補券 / 補進度 / 補積分 三選哪些先做？
4. **重置通知範圍**：只有 LINE 通知玩家、還是同時通知業主 LINE？
5. **遲到強制核銷**：是否要設「遲超過 60 分鐘禁止 force checkin」防誤觸？

業主同日已回 yes、但上述 5 點細節仍可在 Phase B/C 開工前確認。

---

## 風險與緩解

| 風險 | 等級 | 對應 |
|------|------|------|
| 既有 admin 找不到舊位置 | 🟡 中 | CommandPalette（⌘K）仍可搜尋；group description tooltip 引導 |
| 排解功能誤觸破壞玩家資料 | 🔴 高 | 必填原因 ≥ 10 字、二段確認、保留 reset_history 不刪 |
| audit_logs 表暴增 | 🟢 低 | 已有 fieldId 索引、每月歸檔 |
| 跨場域 admin 看到別場資料 | 🟡 中 | 所有新 endpoint 一律 `inArray(scope.identifiers)`、延用 POS pattern |

---

## 相關文件

- [2026-05-19-pos-rescue.md](2026-05-19-pos-rescue.md) — POS fieldId 修正（先做的前置）
- [2026-05-18-multi-activity-pos.md](2026-05-18-multi-activity-pos.md) — 母計畫
- 待寫：ADR-0021 「為什麼用 5 群情境而非 12 群功能」
