# 切背景回來被踢出隊伍 — 2026-08-05

> 範圍：WS 斷線重連的 DB 一致性 + 踢人漏洞
> 狀態：🟡 開發與本機端到端驗證完成，**尚未部署**
> 需要 schema 變更：`team_members` ADD COLUMN `left_reason`

---

## 背景

業主回報三個症狀：

1. 玩家切出去再回來就被踢出隊伍
2. 隊友之間畫面不同步
3. 連線時不時斷掉、要重新整理

原本在評估要不要導入 Ably 或 Centrifugo 來解決，查證後發現**三個症狀是同一個根因，
且與訊息層完全無關**——換 Ably 或 Centrifugo 一點幫助都沒有。

---

## 根因

`auto_leave`（斷線寬限過期）會寫 DB：

```ts
db.update(teamMembers).set({ leftAt: new Date() })   // websocket.ts:271
```

但玩家重連時的 `team_join` 只做三件事：加入記憶體 `teamClients`、取消寬限計時器、
廣播 reconnected —— **完全沒有碰 DB**。

於是 **WS 說「他在」、DB 說「他離隊了」**：

| 症狀 | 成因 |
|------|------|
| 被踢出隊伍 | 重整後從 DB 讀成員 → 自己不在 |
| 隊友畫面不同步 | 有的畫面讀 DB（看不到他）、有的讀 WS 記憶體（看得到） |
| 一直要重整 | 重整後狀態更亂 |

### 生產資料實測

| 項目 | 數字 |
|------|------|
| auto_leave 後該玩家**仍有 WS 活動**（人還在玩） | **71 / 279 次（25%）** |
| `team_members` 被標記離隊的比例 | **157 / 159（98.7%）** |
| 被標離隊後又反覆 grace_start 的案例 | 同一人同一隊 9 次、8 次、6 次 |

斷線關閉碼分佈也顯示這不是「網路爛」：

| code | 意義 | 次數 |
|---|---|---|
| `1001` | Going Away（**手機鎖屏 / 切 app / 分頁切換**） | 186 |
| `1000` | 應用主動關閉 | 170 |
| `1006` | 真異常斷線 | 96（集中在 5-6 月，近期無） |

最大宗是行動裝置的**正常行為**，不是故障。

---

## 🐛 連帶發現：踢人踢不掉

`onSelfKicked` 前端 callback **沒有任何使用端**。玩家被踢後：

```
server 踢人 → close ws → 前端 exp backoff 重連 → onopen 自動送 team_join
→ server 看 memberHistory 有他 → 加回房間
```

目前是「DB 說他離隊了」擋住了一部分，兩個 bug 互相抵消。所以**修 leftAt 時
不能無條件清除**，否則被踢的人會真的回來，變成嚴重迴歸。

---

## 解決方案

| 步驟 | 內容 |
|------|------|
| 1 | `team_members` 加 `left_reason`（ADD COLUMN，符合只增不刪紅線） |
| 2 | 三個寫入點分別標記：`auto_leave` / `manual` / `kicked` |
| 3 | 重連時 `revokeAutoLeave()` 撤銷，**只撤銷 `auto_leave`** 且隊伍須為 `forming/ready/playing` |
| 4 | 前端收到 `team_kicked` 時清除 rejoin config，堵住踢不掉的漏洞 |
| 5 | 補記 `reconnect` 事件（型別早就定義卻從沒被寫入） |

### 兩個限制條件不可放寬

```
1. 只清 left_reason='auto_leave'  → 否則被踢的人一重連就自己回來
2. 隊伍必須還在進行中             → 不把玩家加回已結束/解散的隊伍
```

---

## 影響範圍

```
shared/schema/teams.ts              加 leftReason 欄位 + TEAM_LEFT_REASONS
shared/schema/observability.ts      加 auto_leave_revoked 事件型別
server/lib/team-membership.ts       新增 revokeAutoLeave()（可測、可重用）
server/routes/websocket.ts          auto_leave 標記 + team_join 撤銷 + reconnect 記錄
server/routes/team-lifecycle.ts     manual / kicked 標記
client/src/contexts/WebSocketContext.tsx  被踢後清 rejoin config
```

---

## 驗證

**單元/整合測試 8 項**（`server/__tests__/team-rejoin-auto-leave.test.ts`），
重點不在「撤銷會成功」，而在**不會誤傷**：

- 被踢的、主動離隊的、已結束隊伍的 → 一律不得加回
- 不波及其他隊伍的同一玩家、不波及同隊的其他帳號
- 冪等（重複呼叫回 false，不出錯）

**端到端真實 WS 驗證**（非 mock，用實際 WebSocket 連線走完整流程）：

```
① 初始              left_at=null
② 加入隊伍          left_at=null
③ 斷線→寬限過期     left_at=有值, left_reason=auto_leave   ← 前提成立
④ 玩家切回來重連    left_at=null, left_reason=null         ← 修復生效
```

測試時用 `DISCONNECT_GRACE_MS=1000 AUTO_LEAVE_AFTER_GRACE_MS=1000` 縮短等待。
注意實際流程是 **5s 延遲廣播 + 30s 寬限 + 120s auto-leave = 155 秒**，
那 5 秒延遲容易被忽略導致誤判測試前提。

全套 **3334 passed**、`tsc` 零錯誤。

---

## ⚠️ 部署注意

**不可用 `npm run db:push`**。實測它會嘗試對無關的 `booking_configs` 加 unique
constraint，並詢問是否 **truncate 該表** —— 在非互動環境會直接失敗，在互動環境
若誤按 yes 會清空資料。

改用手動 ADD COLUMN：

```sql
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS left_reason varchar(20);
```

此欄位 nullable、向後相容，可在部署程式碼**之前**先加。

---

## 已知限制

1. **歷史資料不回填**：88 個殘留成員（52 隊）都在 6-7 月的殭屍隊伍，
   回填等於把人加回三個月前的隊。新場次不受影響。
2. `teamMemberHistory` 仍是進程記憶體，server 重啟會清空。重啟後重連的玩家
   會被判定為「初次加入」而非「重連」，但 `revokeAutoLeave` 不依賴它，
   DB 一致性仍正確。
3. 上百人規模的容量問題**未處理** —— 那是 ADR-0023 的 Phase D，與本次無關。

---

## 相關文件

- [ADR-0023 WS 單 worker 拓撲](../decisions/0023-ws-single-worker-topology.md)
- 計算基準：`server/lib/team-membership.ts`
