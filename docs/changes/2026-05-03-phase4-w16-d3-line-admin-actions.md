# Phase 4 W16 D3 — LINE Admin 直接管理活動

**日期**：2026-05-03
**範圍**：W16 D3（依 ADR-0011 規劃）
**狀態**：🟢 W16 D3 完成、admin 不必開電腦也能 list/end active sessions

---

## 🎯 目標達成

> ADR-0011 W16 D3 規劃：LINE 進階互動（admin 直接管理活動）
> 從「只能建場」→「LINE 看活動清單 + 結束指定活動」（完整 admin 工具鏈）

---

## 📦 新增

### 1. `server/lib/admin-line-actions.ts`

新增兩個核心 action：

```ts
listActiveSessionsForLineAdmin(lineUserId)
  → { ok: true, sessions: [{sessionId, gameTitle, expiresAt, hostUrl, playUrl}] }
  | { ok: false, error, code }

endSessionForLineAdmin({ lineUserId, sessionId })
  → { ok: true, sessionId } | { ok: false, error, code }
```

**特色**：
- 認證透過 W15 D5 環境變數（不動 schema）
- 場域過濾：admin 有 fieldId 才篩、無則回所有
- end 後自動派 instance.expired webhook（與 admin endpoint 行為一致）
- endedBy 記錄為 `line/<userId 前 8 字元>`（追蹤誰結束）

### 2. `server/lib/admin-nlu.ts`

加兩個 intent + 快速路徑（regex，不耗 AI）：

```ts
type AdminCommandIntent =
  | "create_scenario"
  | "help"
  | "list_scenarios"
  | "list_active"      // W16 D3
  | "end_session"      // W16 D3
  | "unknown";

// 快速路徑
"@chito 我的活動"     → list_active
"@chito active"       → list_active
"@chito 進行中"        → list_active
"@chito 結束 abc12345" → end_session (sessionId="abc12345")
"@chito end abc12345"  → end_session
```

### 3. `server/routes/line-webhook.ts`

新增三個 helper + 兩個 intent handler：

**`formatActiveSessionsReply(sessions, baseUrl)`**：
```
📋 您的 active 活動（3 個）

1. Hung & Anita 婚禮 - 紀念牆
   🆔 abc12345
   ⏰ 剩餘 11 小時
   🖥 https://game.homi.cc/host/...

2. ...

💡 結束某場：「@chito 結束 <sessionId>」
   sessionId 取訊息中前 8 字元即可
```

**`postEndQuickReply()`** — 結束後給 admin 繼續操作的按鈕：
- 📋 看剩餘活動
- 💒 再開一場
- 📖 用法

**Intent handler**：
- `list_active` → 查 DB → 回列表 + adminQuickReply
- `end_session` → 支援前 8 字元（從 active list 找完整 ID）→ 結束 → 回成功訊息 + postEndQuickReply

### 4. Quick Reply 加「📋 我的活動」按鈕

放在第一順位（admin 最常用的管理操作）：
```
[📋 我的活動] [📖 用法] [📦 情境] [💒 婚禮] [🎂 生日] [❄️ 破冰] [🎓 同學會]
```

---

## 💡 設計決策

### 為何 end_session 支援前 8 字元？

選擇：admin 只需打 8 個字元、系統自動補完整 sessionId

理由：
- LINE 訊息中顯示的 sessionId 是 8 字元（`s.sessionId.slice(0, 8)`）
- 完整 UUID 36 字元打字麻煩、可能出錯
- 前 8 字元碰撞機率：admin 場域同時 active < 100 場 → 16^8 = 42 億，極低
- 找不到匹配時 fall through 到原 sessionId、回「session 不存在」

### 為何不用 LINE Postback events？

選擇：用 message action 而非 postback

理由：
- message action：admin 看得到送什麼字（透明、可學習）
- postback：data 隱藏（admin 不知道指令）
- W16 D3 重點是建立 admin 工具鏈、用透明指令更符合產品理念
- 未來如有「不想暴露」的功能再用 postback

### 為何 end 後派 webhook？

選擇：複用 W15 D4 的 dispatchWebhook 邏輯

理由：
- 確保 admin 不論透過 admin endpoint 或 LINE 結束、外部系統都能收到通知
- endedBy 用 `line/<userId 前 8>` 區分來源（webhook 接收方可以追蹤）
- 一致性：所有 end 路徑行為一致

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- Smoke test：維持 45/45（W16 D3 不新增 endpoint、僅擴充 LINE webhook 行為）

---

## 📊 admin 完整 LINE 工具鏈（W15-W16 累積）

| 操作 | LINE 指令 | 階段 |
|------|-----------|------|
| 建場 | `@chito 婚禮 ...` | W15 D5 |
| 看用法 | `@chito help` | W15 D3 |
| 看情境清單 | `@chito list` | W15 D3 |
| 看 active 活動 | `@chito 我的活動` | **W16 D3** |
| 結束某場 | `@chito 結束 <id>` | **W16 D3** |

**business value**：admin 在咖啡廳 / 路上完整管理活動、不必開電腦 ⚡

---

## ⏭ 下一步：W16 D4

依 ADR-0011 規劃：
- W16 D4：排程推播（cron）— 活動前 1 小時 reminder / 活動結束摘要
- 評估：是否要把推播時機讓 admin 設定（W16 D4 補簡易設定）

---

## 🔗 相關文件

- [W15 D5 admin instantiate](2026-05-03-phase4-w15-d5-admin-instantiate.md)
- [W16 D2 quick reply + sticker](2026-05-03-phase4-w16-d2-line-quick-reply.md)
- [ADR-0011 W16 規劃](../decisions/0011-w16-planning.md)
