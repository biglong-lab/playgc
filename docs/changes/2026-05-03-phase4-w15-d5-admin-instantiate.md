# Phase 4 W15 D5 — Admin 認證 + LINE 真實建場 + W15 收尾

**日期**：2026-05-03
**範圍**：W15 D5 + W15 整體收尾（W15 D1-D5 完整 LINE Bot 鏈路）
**狀態**：🟢 W15 完整收尾、LINE admin 用 @chito 指令可一鍵真實建場

---

## 🎯 目標達成

> Phase 4 W15 D4 完成活動結束 webhook
> W15 D5 補上最後一塊 — admin 認證 + 真建場（W15 D3 NLU 預覽 → 真建場）

---

## 📦 新增

### 1. `server/lib/admin-line-auth.ts`

LINE userId → admin 對應（環境變數版）：

```ts
isLineUserAdmin(lineUserId): boolean
getAdminFieldId(lineUserId): string | null
getLineAdminStatus(): { configured, adminCount }
```

**為什麼用環境變數而非 schema？**
- 紅線：「Schema 只新增不刪除」、能不動 schema 就不動
- admin 數量極少（< 10）、用環境變數管理夠用
- W16 評估是否需 admin schema 補完整 mapping

**環境變數設定**：
```bash
LINE_ADMIN_USER_IDS=Uabc123def456,Uxyz789ghi012  # 逗號分隔
LINE_ADMIN_FIELD_Uabc123def=field-uuid-1         # userId 前 10 字元為 key
LINE_ADMIN_FIELD_Uxyz789ghi=field-uuid-2
```

### 2. `server/lib/scenario-instantiator-line.ts`

LINE admin 真建場（最小可用版）：

```ts
instantiateScenarioForLine({ scenarioId, displayName, fieldId })
  → { ok, hostUrl, playUrl, sessionId, expiresAt, ... } | { ok: false, error }
```

**範圍（W15 D5 簡化版）**：
- 只建情境的第 1 個 host 元件
- 預設 config（不接 AI 生成）
- W16 擴充支援多元件 + multi/solo + AI config

**為什麼不重用 `scenarios.ts` 的 instantiateComponent？**
- 該函數是 file-private、未 export
- 重構需動 scenarios.ts，違反「不破壞現有 endpoint」原則
- W15 D5 範圍只要驗證流程（admin 認證 → 真建場 → reply hostUrl）
- W16 規劃會評估是否抽 lib 統一邏輯

### 3. `line-webhook` 整合

```ts
if (cmd.intent === "create_scenario") {
  if (!isAdmin) {
    // 回 NLU 預覽 + 提示需 admin 設定
  } else {
    // 真建場
    const result = await instantiateScenarioForLine({ ... });
    // reply 完整 hostUrl + playUrl
  }
}
```

**完整訊息範例**：
```
✅ 建場成功！

📦 情境：婚禮現場互動
📝 名稱：Hung & Anita 5/15 婚禮
⏰ 有效期：12 小時

🖥 大螢幕網址（請投影）：
https://game.homi.cc/host/xxx?token=xxx

📱 玩家網址（QR 給來賓掃）：
https://game.homi.cc/play/xxx
```

### 4. `health` endpoint 擴充

```json
{
  "status": "ok",
  "lineBotConfigured": true,
  "nluConfigured": true,
  "adminConfigured": true,
  "adminCount": 2,
  "timestamp": "..."
}
```

讓 admin 可遠端確認設定狀態。

---

## 💡 設計決策

### 為何用「前 10 字元」當環境變數 key？

選擇：`LINE_ADMIN_FIELD_${userId.slice(0, 10)}`

理由：
- LINE userId 是 33 字元（U + 32 hex），太長環境變數名怪
- 前 10 字元（U + 9）碰撞機率極低（admin 不會超過 10 人）
- 避免直接用全 userId 當 key（可讀性差）

### 為何 W15 D5 只支援第 1 個 host 元件？

選擇：簡化、W16 擴充

理由：
- W15 D5 主要驗證「admin 認證 → 真建場」流程
- 多元件需要回多個 hostUrl（LINE 訊息變長）
- 婚禮 / 生日 / 同學會等情境第 1 個元件通常就是 host_polaroid_collage（最重要）
- W16 補完整版（含 multi/solo + 多元件 reply）

### 為何不重用 admin endpoint？

選擇：新建獨立 lib

理由：
- 重用需做 admin token 簽發（複雜）
- 抽既有邏輯需動 scenarios.ts（風險高）
- 獨立 lib 簡單、隔離、易維護
- W16 規劃會評估抽出共用 instantiator

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- Smoke test：44 → 45（新增 1 筆 health admin status 驗證）

---

## 📊 W15 完整收尾

### W15 五天完整鏈路

```
W15 D1: LINE Bot scaffold（webhook 收訊 + signature 驗證）
W15 D2: LINE Pusher（活動主動推播）
W15 D3: Admin NLU（DeepSeek 解析自然語言、純預覽）
W15 D4: 活動結束 webhook 鉤子（host_session ended → instance.expired）
W15 D5: Admin 認證 + 真實建場（@chito 指令一鍵建場）
```

### 業務流程

**Before W15**：
- admin 開電腦 → 登入後台 → 點選情境 → 一鍵建場 → 抄 hostUrl 給活動主辦
- 至少 5-10 分鐘

**After W15**：
- admin 在 LINE 打「@chito 婚禮 Hung & Anita 5/15」→ 30 秒內收到 hostUrl + playUrl
- ⚡ 10× 加速、隨時隨地

### 整體統計

| 項目 | 數字 |
|------|------|
| 新增檔案 | 12+ |
| 程式碼行數 | ~1,800 |
| 新增 endpoint | 6（webhook + health + push helpers）|
| Smoke test | 44 → 45 |
| Commits | 5（D1-D5）|

---

## ⏭ 下一步：Phase 4 W16

W16 規劃方向（細節 → ADR-0011）：
- **W16 D1-D2**：完整 instantiate（多元件 + multi/solo + AI config）
- **W16 D3**：admin schema 評估（取代環境變數版）
- **W16 D4**：LINE Bot 進階（圖片 / sticker / 排程推播）
- **W16 D5**：Phase 4 整體收尾 + Phase 5 啟動

---

## 🔗 環境變數總表（W15 完整）

```bash
# LINE Bot（必要）
LINE_CHANNEL_SECRET=xxx
LINE_CHANNEL_ACCESS_TOKEN=xxx

# AI NLU（選用）
OPENROUTER_API_KEY=sk-or-xxx

# Admin 認證（W15 D5 必要）
LINE_ADMIN_USER_IDS=Uabc...,Uxyz...
LINE_ADMIN_FIELD_Uabc123def=<fieldId>  # 可選

# Webhook 派發（W15 D4 選用）
API_KEY_DEFAULT_FOR_WEBHOOKS=ck_live_xxx

# 應用 base URL（讓 LINE 回的 url 帶 domain）
APP_BASE_URL=https://game.homi.cc
```

---

## 🔗 相關文件

- [W15 D1 Bot scaffold](2026-05-03-phase4-w15-d1-line-bot-scaffold.md)
- [W15 D2 LINE Pusher](2026-05-03-phase4-w15-d2-line-pusher.md)
- [W15 D3 Admin NLU](2026-05-03-phase4-w15-d3-admin-nlu.md)
- [W15 D4 Session End Webhook](2026-05-03-phase4-w15-d4-session-end-webhook.md)
- [ADR-0010 LINE Bot 整合](../decisions/0010-line-bot-integration.md)
- [ADR-0011 W16 規劃（即將）](../decisions/0011-w16-planning.md)
