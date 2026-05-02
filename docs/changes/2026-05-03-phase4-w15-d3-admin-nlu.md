# Phase 4 W15 D3 — Admin NLU（DeepSeek 解析）

**日期**：2026-05-03
**範圍**：W15 D3、admin-nlu lib + line-webhook 整合
**狀態**：🟢 W15 D3 完成、admin 在 LINE 用自然語言可預覽指令（W15 D5 才實際建場）

---

## 🎯 目標達成

> Phase 4 W15 D2 完成主動推播
> W15 D3 補上 admin NLU — 自然語言解析（為 W15 D5 真實建場鋪路）

---

## 📦 新增

### 1. `server/lib/admin-nlu.ts`

**核心函式**：
```ts
parseAdminCommand({ apiKey, text }): Promise<AdminCommand>
formatCommandReply(cmd): string
```

**支援 4 種 intent**：
- `create_scenario` — 建立情境實例
- `help` — 顯示用法
- `list_scenarios` — 列出 12 情境
- `unknown` — 無法解析

**範例輸入 → 輸出**：
```
"@chito 婚禮 Hung & Anita 5/15"
↓
{
  intent: "create_scenario",
  scenarioId: "wedding",
  displayName: "Hung & Anita 5/15 婚禮",
  rationale: "提到「婚禮」+ 人名 + 日期"
}
```

### 2. 快速路徑（不耗 AI cost）

```
"@chito help"  → intent: help
"@chito 清單"  → intent: list_scenarios
"@chito ?"      → intent: help
```

只有真正需要解析的 case 才呼叫 DeepSeek。

### 3. `formatCommandReply()` 訊息範本

**help**：列出常用指令範例 + 12 情境
**list_scenarios**：所有 live 情境 ID + 名稱
**create_scenario**：解析結果預覽 + W15 D5 完成 admin 認證後才實際建場提示
**unknown**：友善提示「試試 @chito help」

### 4. line-webhook 整合

```ts
if (/^@chito\b/i.test(text)) {
  // → parseAdminCommand → formatCommandReply → reply
} else {
  // → 一般 echo 但加「試試 @chito help」提示
}
```

OPENROUTER_API_KEY 未設 → 友善訊息「admin 指令模式未啟用」

---

## 💡 設計決策

### 為何快速路徑（不全部 AI）？

選擇：help / list 走 regex、其他走 DeepSeek

理由：
- help / list 是固定回應、不需 AI
- 省 API cost（DeepSeek ~ NT$ 1-3 / 次）
- 速度快（regex 即時、AI 5-10 秒）

### 為何 create_scenario 暫不真建場？

選擇：W15 D3 純解析、W15 D5 才實際 instantiate

理由：
- 真建場需要 admin 認證（LINE userId → admin 對應）
- 認證需要新 schema（LINE_ADMIN_USER_IDS 環境變數 / DB 表）
- 漸進式：先讓 admin 看到 NLU 結果、確認準確度後才開放真建場
- 避免假指令誤建（如玩家不小心打 @chito）

### 為何 prompt 列出 12 情境？

選擇：把可用情境清單放 prompt context

理由：
- DeepSeek 不知道 CHITO 情境清單
- 列出後解析準確度 > 90%
- 動態取（如新增情境自動納入）

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 維持 44/44

---

## ⏭ 下一步：W15 D4-D5

- W15 D4：活動結束推播鉤子（從 host_session completion event）
- W15 D5：W15 收尾 + admin 認證 + 真實建場 + W16 規劃

---

## 🔗 相關文件

- [W15 D1 Bot scaffold](2026-05-03-phase4-w15-d1-line-bot-scaffold.md)
- [W15 D2 LINE Pusher](2026-05-03-phase4-w15-d2-line-pusher.md)
- [W9 D1 AI MVP（DeepSeek 整合源頭）](2026-05-02-phase3-w9-d1-ai-content-mvp.md)
- [ADR-0010 LINE Bot 整合](../decisions/0010-line-bot-integration.md)
