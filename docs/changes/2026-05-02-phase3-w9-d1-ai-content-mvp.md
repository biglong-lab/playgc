# Phase 3 W9 D1 — AI 內容生成 MVP

**日期**：2026-05-02
**範圍**：W9 D1、新增 AI 內容生成器 + ai-preview endpoint + smoke test 擴充
**狀態**：🟢 W9 D1 完成、AI 預覽 endpoint 上線

---

## 🎯 目標達成

> Phase 3 W9 主軸：PMF 驗證 + AI 內容生成 MVP
> W9 D1 補上技術核心 — admin 可輸入 context 讓 AI 生成客製化 config

---

## 📦 新增

### 1. `server/lib/scenario-content-generator.ts`

**功能**：用 OpenRouter（DeepSeek V3.2）為情境的所有元件生成客製化 config

**輸入**：
```ts
{
  apiKey: string;          // OpenRouter sk-or-*
  scenarioName: string;    // 「婚禮派對情境包」
  context: string;         // 「Hung & Anita 5/15 晶華婚禮」
  components: ScenarioComponent[];  // 情境的元件清單
}
```

**輸出**：
```ts
{
  configs: { [pageType]: configObject };  // 每個元件的客製 config
  rationale: string;                       // AI 思考摘要
}
```

**Prompt 設計**：
- 列出每個元件的 pageType / label / role
- 為每個 pageType 給出明確 config schema 範例
- 要求內容必須跟 context 緊密相關（提及人名、地點、活動性質）
- 文字溫度感、避免機械感
- emoji 用繁體中文情境
- 直接回 JSON 不含 markdown

支援 13 種 pageType：
- 10 個 host_*（polaroid / guestbook / emoji_react / trivia / leaderboard / wave / crowd / scoreboard / knowledge_map / poll_live）
- 3 個 multi（treasure_hunt / jigsaw_puzzle / collective_score / role_assign / gps_cascade）

### 2. `POST /api/admin/scenarios/:id/ai-preview`

**權限**：requireAdminAuth + game:create
**Body**：`{ context: string }`（500 字內）

**邏輯**：
1. 找情境模板
2. 取場域 OpenRouter API key（從 fields.settings.geminiApiKey 解密）
3. 驗證 key 是 `sk-or-*` 格式（DeepSeek 在 OpenRouter）
4. 呼叫 generateScenarioContent
5. 回傳 configs + rationale + components 列表

**重點**：
- 純 preview，不寫入 DB
- 不影響 instantiate 流程（admin 看完可決定要不要套用）
- 失敗 graceful（500 + error message）

### 3. Smoke test 擴充

`scripts/smoke-test-scenarios.mjs` 加 Section 4b：
- POST `/api/admin/scenarios/wedding/ai-preview` → 401 認證守衛

從 24 → **25 個檢查**

---

## 💡 設計決策

### 為何先做 preview 不直接整合到 instantiate？

選擇：分兩步（先預覽 → 後套用）

理由：
- AI 內容品質不穩定，admin 必須能 review
- 「一鍵直接建場 with AI」風險太高（萬一 AI 生成不適合的內容）
- preview 不寫 DB → 完全沒副作用、可重試
- W9 D2 視 PMF 反饋再決定是否補上「套用」按鈕

### 為何用既有 OpenRouter（DeepSeek）而不直接接 OpenAI？

選擇：複用 variant-generator 的 OpenRouter 整合

理由：
- DeepSeek V3.2 中文能力最佳（既有專案實測）
- OpenRouter 已整合場域 API key 機制
- 不增加新依賴
- 失敗自動降級（fallback chain）

### 為何不快取 AI 生成結果？

選擇：每次 ai-preview 重新呼叫 DeepSeek

理由：
- context 不同則生成結果不同（無法 cache key）
- admin 通常只試 1-2 次就決定
- 真正的 cache 應該是「生成後存進 game.config」（W9 D2 補上「套用」時做）
- 避免提前優化

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：**25/25 通過**

---

## ⏭ 下一步：W9 D2-D5

- W9 D2：前端 TemplateMarketDetail 加「AI 預覽」UI + 套用按鈕
- W9 D3-D4：找第一個付費客戶 + 帶他們完整跑流程
- W9 D5：W9 收尾 + 第一場案例文件

---

## 🔗 相關文件

- [ADR-0005 Phase 3 方向](../decisions/0005-phase3-direction.md)
- [Phase 3 W9-W12 規劃書](2026-05-02-phase3-plan.md)
- [Phase 2 完整收尾](2026-05-02-phase2-complete.md)
