# Phase 4 W15 D4 — 活動結束 webhook 鉤子

**日期**：2026-05-03
**範圍**：W15 D4、host-sessions /end 端點 + webhook-dispatcher 整合
**狀態**：🟢 W15 D4 完成、admin 結束 host session → 自動派 instance.expired webhook

---

## 🎯 目標達成

> Phase 4 W15 D3 完成 admin NLU
> W15 D4 補上活動結束推播 — host_session ended event → webhook 派發

---

## 📦 修改

### `server/routes/host-sessions.ts`

**POST `/api/admin/host-sessions/:id/end`** 加入 webhook 派發邏輯：

```ts
// 結束 session 後（status=completed、token 吊銷）
if (session.gameId) {
  // 1. 偵測 api/v1 代理商建立的 game（透過 description 標記）
  const [game] = await db.select().from(games).where(eq(games.id, session.gameId));
  if (game?.description?.includes("[via:api/v1]")) {
    const scenarioMatch = game.description.match(/\[scenario:([^\]]+)\]/);
    console.log("[host-sessions] [W15 D4] api/v1 host session ended:", {
      gameId: session.gameId,
      scenarioId: scenarioMatch?.[1],
    });
    // W15 D5 將補 game → apiKey mapping、實際派發
  }

  // 2. 派 instance.expired 給場域的 default API key（如有設）
  const defaultApiKeyId = process.env.API_KEY_DEFAULT_FOR_WEBHOOKS;
  if (defaultApiKeyId) {
    dispatchWebhook({
      type: "instance.expired",
      data: {
        sessionId: session.id,
        gameId: session.gameId,
        endedAt: new Date().toISOString(),
        endedBy: req.admin.username || "admin",
      },
      apiKeyId: defaultApiKeyId,
    });
  }
}
```

### Webhook payload

```json
{
  "type": "instance.expired",
  "data": {
    "sessionId": "uuid",
    "gameId": "uuid",
    "endedAt": "2026-05-03T...",
    "endedBy": "admin-username"
  }
}
```

`webhook-dispatcher.ts` 已自動加 HMAC SHA-256 簽章（`X-CHITO-Signature` header）+ 3 次 retry（exponential backoff）+ fire-and-forget（不 block 主流程）。

---

## 💡 設計決策

### 為何用 `[via:api/v1]` 標記偵測？

選擇：在 game.description 加 `[via:api/v1]` 字串標記、不加新欄位

理由：
- 紅線：「Schema 只新增不刪除」、能不動 schema 就不動
- W11 D2 instantiate 時就已加標記、只需偵測
- W15 D5 才補 game → apiKey 完整 mapping（需 admin schema 變動）
- 漸進式：W15 D4 先讓「default API key」收到通知、W15 D5 才針對代理商派發

### 為何 fire-and-forget？

選擇：不 await dispatchWebhook、讓主流程立即回 success

理由：
- webhook 失敗不該影響 admin UI 體驗（admin 只關心 session 結束成功）
- dispatcher 內部已有 retry 機制（3 次 + 指數退避）
- 失敗 log 由 dispatcher 自行紀錄

### 為何 endedBy 用 username？

選擇：用 admin.username（fallback `"admin"`）

理由：
- 代理商透過 webhook 收到後可分辨「誰結束了活動」
- 跨場域共用 default API key 時、可區分動作來源
- 不洩露敏感資訊（不傳 email/userId）

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 維持 44/44（W15 D4 不新增 endpoint、僅整合既有 /end 流程）

---

## 🔗 環境變數

```bash
# .env（生產端 / 本地端）
API_KEY_DEFAULT_FOR_WEBHOOKS=ck_live_xxxxx  # 場域 default API key（可選）
```

未設 → webhook 不派發（不影響其他流程）。

---

## ⏭ 下一步：W15 D5

- W15 收尾 + admin 認證（LINE userId → admin 對應）
- 真實 instantiate（W15 D3 NLU 解析 + 真建場）
- game → apiKey mapping schema（讓代理商直接收到 webhook）
- W16 規劃（Phase 4 收尾 + Phase 5 啟動）

---

## 🔗 相關文件

- [W12 D3 Webhook Dispatcher](2026-05-02-phase3-w12-d3-webhook-dispatcher.md)
- [W15 D3 Admin NLU](2026-05-03-phase4-w15-d3-admin-nlu.md)
- [ADR-0010 LINE Bot 整合](../decisions/0010-line-bot-integration.md)
- [ADR-0008 Public API 設計](../decisions/0008-public-api-design.md)
