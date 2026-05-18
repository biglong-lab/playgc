# POS 修正 + 智慧排解流程 — 2026-05-19

> 範圍：fieldId 根因修正、智慧錯誤狀態、強制核銷、現場改梯次
> 狀態：✅ 已部署（commit 63e94805、85034598）
> 部署：ssh root@172.233.89.147 + docker compose 重建
> 觸發：業主 5/19 凌晨 iPhone 現場測試「找不到 預約：BK_fji_PhaDmVSM... / ADGF3Z」

---

## 背景

業主在凌晨現場測試 POS 掃描、不論 QR 還是手動輸入預約碼都回報「找不到」。業主原本推測是「時段未到不能掃」、要求設計：
1. 未到時段顯示明確提醒（不是 generic「找不到」）
2. 工作人員可現場「強制核銷」（客人提前到、現場有位置）
3. 工作人員可現場「改梯次」（避免無法核銷的情況）
4. 所有操作要留紀錄

---

## 根因發現

不是時段問題、是**資料模型不一致**：

| 表 | field_id 存什麼 | 範例 |
|----|---------------|------|
| `bookings.field_id` | 場域**代碼** | `JIACHUN` |
| `admin_accounts.field_id` | 場域 **UUID** | `72cc204d-8481-4276-b913-0033d69bf654` |

POS 所有 query 用 `resolveFieldId(req)` 拿 admin 的 UUID、然後 `WHERE bookings.field_id = UUID` 永遠 0 筆 →「找不到」。

生產 DB 確認：9 筆預約全部存場域代碼 `JIACHUN`、admin 全部存 UUID。**100% 命中率失敗**。

---

## 解決方案

### 1. resolveFieldScope 雙識別碼策略（不破壞既有資料）

```ts
async function resolveFieldScope(req): Promise<{ id, code, identifiers: string[] }> {
  const raw = resolveFieldId(req);           // 拿 admin 給的（可能 UUID 或 code）
  const row = await db.select({ id, code })
    .from(fields)
    .where(or(eq(fields.id, raw), eq(fields.code, raw)));
  return { id, code, identifiers: [id, code] };
}
```

所有 POS query 改用 `inArray(bookings.fieldId, scope.identifiers)`、同時匹配 UUID + 代碼。

**為什麼不直接 migration 統一資料**：
- 9 筆預約風險低、但其他關聯表（payment、game_session）也可能用混
- 灰度策略：query 雙容、未來新預約逐步收斂為 UUID
- 寫入新預約時 `bookings.fieldId = input.fieldId`（前端傳 code）→ 維持現狀
- 等所有讀寫點都換成 scope.id 為主、再做 migration

### 2. checkin 5 種智慧錯誤狀態

舊行為：任何匹配失敗都回 generic 404「找不到」。

新行為：先全域查預約、再分流 5 種狀態：

| 狀態 | HTTP | 訊息 |
|------|------|------|
| `not_found` | 404 | 「查無預約編號 XXX。請確認 QR 來源或編號輸入正確」|
| `wrong_field` | 403 | 「此預約屬於『XXX 場域』、不是本場域（JIACHUN）」|
| `too_early` | 200 + issue | 「早 N 分鐘到」（issues 陣列含 `"too_early"`）|
| `too_late` | 200 + issue | 「過時段 N 分鐘」 |
| `cancelled` / `no_show` | 200 + issue | 「此預約狀態為 cancelled、需強制核銷」 |

**新回傳 response**：

```jsonc
{
  "type": "booking",
  "booking": {...},
  "activity": {...},
  "timing": "early" | "on_time" | "late",
  "minutesBeforeStart": 4320,
  "minutesAfterEnd": -4320,
  "issues": ["too_early"]
}
```

前端依 issues 顯示對應 banner + 修正按鈕。

### 3. 強制核銷 API

`POST /api/pos/bookings/:id/check-in` 新增 `{ force: true, note?: string }`：
- 忽略狀態 + 時段限制
- 自動 reactivate cancelled / no_show → confirmed
- 寫入 `adminNote`：`[強制核銷] {note}` 留軌跡
- 回 `{ booking, forced: true }`

### 4. 現場改梯次 API

`POST /api/pos/bookings/:id/reschedule`：

```jsonc
{
  "slotStart": "2026-05-19T14:00:00Z",
  "durationMinutes": 30,
  "reason": "客人提前到場、現場有位置安排"
}
```

- **不檢查容量**（業主已現場判斷）
- 寫 `adminNote`：`[改梯次 2026-05-19T02:00] 原 X → Y：客人提前到場...`
- 修改 `slotStart` + `slotEnd`

### 5. 前端 PosScanResultCard.tsx（拆獨立 component）

從 PosScan.tsx 拆出 379 行新 component。針對 5 狀態顯示：

| 狀態 | banner 顏色 | 修正按鈕 |
|------|------------|---------|
| `not_found` | 紅色 toast | — |
| `wrong_field` | 紅色 toast 「不在本場域」 | —（super admin 可手動切場） |
| `too_early` | 琥珀色 banner「早 N 分鐘」 | ✅ 強制核銷 + 📅 改梯次 |
| `too_late` | 紅色 banner「遲 N 分鐘」 | ✅ 強制核銷 + 📅 改梯次 |
| `cancelled` / `no_show` | 紅色 banner「狀態 X」 | ✅ 強制核銷（reactivate） |

「強制核銷」按鈕觸發 `confirm()` 對話框、列出強制原因：
```
⚠️ 強制核銷確認
• 早 4320 分鐘到
• 此預約原本是「已取消」

確定要核銷？此動作會留紀錄到 admin note。
```

「改梯次」按鈕開 Dialog、含 `<input type="datetime-local">` + 原因 textbox。

---

## 影響範圍

### 後端

| 檔案 | 變動 |
|------|------|
| `server/routes/pos.ts` | +228 / -147 行 |
| | 新增 `resolveFieldScope()` helper |
| | 改 7 個 endpoint（dashboard / checkin / check-in / no-show / checkout / voucher/redeem / summary） |
| | 新增 `POST /api/pos/bookings/:id/reschedule` |

### 前端

| 檔案 | 變動 |
|------|------|
| `client/src/pages/pos/PosScan.tsx` | -90 行（移除 inline result card、改 import） |
| `client/src/pages/pos/PosScanResultCard.tsx` | +379 行（**新檔**） |

### Schema

**無變動**。問題出在邏輯層、不在 schema。

---

## 驗證 SOP（業主測試）

1. 開 `/pos/scan`、手動輸入 `ADGF3Z`
2. 應**找得到**、顯示客人資訊 + 「賈村射擊體驗」（活動）+ 5/21 14:30
3. 因為距離預約還早 2 天 → 顯示橘色 banner「早 X 分鐘到」
4. 點「✅ 強制核銷」→ confirm 對話框 → 完成、看到 toast「已強制核銷」
5. 或點「📅 改梯次」→ 改成「現在 + 30 分鐘」→ 完成
6. 重新掃同預約 → 顯示「✓ 已於 HH:mm 報到」

---

## 已知限制 / 後續

1. **audit_logs 還沒掛**：force / reschedule 目前只寫 adminNote、沒進 `auditLogs` 表
   → 等業主確認「後台導航重構 + 排解中心」計畫後、統一 Phase B 補齊
2. **wrong_field 不能切換**：super_admin 看到 wrong_field 訊息、但 UI 沒給「切換到該場域」按鈕
   → 後續可加 deep link `?fieldId=XXX`
3. **重複強制核銷**：理論上同預約可重複 force checkin（會 update checkedInAt）
   → 目前用 frontend `alreadyArrived` 擋、後端可加 `if (existing.checkedInAt) return 409`

---

## 相關文件

- [2026-05-18-multi-activity-pos.md](2026-05-18-multi-activity-pos.md) — 母計畫
- [owner-acceptance-checklist.md](../runbooks/owner-acceptance-checklist.md) — 驗收清單（5/18 docx + 後續打磨）
- 未來：[2026-05-19-troubleshoot-center.md](.) — 排解中心（規劃中、等業主確認）

---

## 業主後續決策

業主同日提出「整體選單重構 + 排解中心」需求、我已產出計畫等業主回覆：
- 後台 5 大情境分組（設計 / 設定 / 現場 / 紀錄 / 排解）
- 遊戲重置 API + 退款 API + 操作審計覆蓋
- 估時 17h、可分 5 階段獨立部署

詳見對話中的 plan response。等業主 yes / modify / 部份先做 後再進入實作。
