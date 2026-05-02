# ADR-0005: Phase 3 方向 — 真實付費 + AI 內容 + 業務 API

> 日期：2026-05-02
> 狀態：採用中（Phase 3 啟動規劃）
> 影響：所有 Phase 3 工作的優先順序與技術選型

---

## 背景

Phase 2 W5-W8 已完成：
- HostScreen 軸線 10/10、Multi 13/13、Solo 18+ = 41+ 元件
- 12 情境模板 + 自動化建場 + QR 列印
- 完整業務工具鏈（Pitch / Wizard / 反向連結）
- Smoke test 24/24 自動化驗收

但平台仍是「免費試用」狀態：
- 沒有付費機制（admin 建場無上限、無監控）
- 沒有 API（代理商無法整合）
- 情境模板的 default content 是「範例題」（admin 要手動改）
- 沒搜集真實客戶回饋

Phase 3 的問題：**什麼樣的工作能讓 Phase 2 的工具真正開始賺錢？**

---

## 選項評估

### 選項 A：第一場真實付費活動 + LINE 通知

**內容**：
- 找一個婚禮 / 破冰 / 內訓客戶（NT$ 5K-15K）
- 全程帶他們跑「3 問 → 模板 → 一鍵建場 → QR」流程
- 活動結束後寄 LINE 統計（簽到數 / 留言數）
- 搜集回饋微調情境預設值

**優點**：
- 立即驗證 PMF（Product-Market Fit）
- 1 場活動就能寫案例（業務工具）
- 不依賴技術新增

**缺點**：
- 需要找到客戶（業務工作）
- 反饋週期長（7-14 天）

---

### 選項 B：客戶端付費機制（Stripe / Recur.tw）

**內容**：
- admin 端訂閱方案（NT$ 1,500-5,000 / 月）
- 客戶端一次性付費（NT$ 3,000-30,000 / 場）
- 訂閱含建場用量配額（10 / 50 / 無限）

**優點**：
- 立即可變現
- 訂閱可預測現金流
- 與 Phase 2 收費三方案直接對應

**缺點**：
- 技術複雜（金流接、退款、發票）
- 法遵要求（消保法、發票法）
- 需要先有客戶才有變現意義

---

### 選項 C：AI 內容生成（DeepSeek）

**內容**：
- 婚禮模板：admin 輸入新人姓名 + 感謝詞 → DeepSeek 產 PolaroidCollage 預設訊息
- 街區走讀：admin 輸入店家清單 → DeepSeek 產 GpsCascade 線索
- 內訓：admin 輸入主題 → DeepSeek 產 TriviaShowdown 題庫

**優點**：
- 大幅降低 admin 編輯成本
- 提升「一鍵建場」價值（不只 default 範例）
- DeepSeek 已整合（既有 game-generator 用）

**缺點**：
- AI 內容品質需審核
- 增加 API cost（每次建場 ~NT$ 1-3）
- 客戶可能要 review，不會「秒完成」

---

### 選項 D：業務 SDK / API + Webhook

**內容**：
- 對外 REST API（讓代理商整合）
- Webhook（活動結束自動推 LINE / Slack 通知）
- Public scenario instance API（讓代理商建場給客戶）

**優點**：
- 擴展業務通路（代理商 = 業務）
- 不用直接對最終客戶
- 一個代理商可帶來 N 個客戶

**缺點**：
- 需要文件 + SDK
- 計費複雜（按 API 用量）
- 代理商需要技術整合能力

---

### 選項 E：多語系（英 / 日 / 簡）

**內容**：
- i18n 框架
- 12 情境 + 41 元件全翻譯
- 觀光景點國際化（金門可接日韓自由行）

**優點**：
- 拓展市場（觀光景點客戶）
- 一次翻譯永久受用

**缺點**：
- 翻譯人力成本
- 不直接變現
- 若沒國際客戶，就是純成本

---

### 選項 F：WhatsApp / LINE 整合

**內容**：
- 玩家用 LINE 對話直接玩（不用 H5 網頁）
- LINE Bot 接收 user input、推回 H5 給遊戲

**優點**：
- 玩家門檻最低（不用安裝 / 開瀏覽器）
- LINE 已是台灣主流

**缺點**：
- 開發複雜度高（LINE LIFF + Bot SDK）
- 不所有元件都適合 LINE（如大螢幕投影）
- 與既有 H5 不衝突，但要重複維護

---

## 決定

**Phase 3 W9-W12 路徑（4 週、混合 + 漸進）**：

### W9：選項 A + C 起步（**第一場付費 + AI 內容生成 MVP**）
- D1-D2：找到第一個客戶（婚禮 / 破冰）+ 全程帶看
- D3-D4：DeepSeek 整合到婚禮 / TriviaShowdown 模板
- D5：搜集回饋 + 寫案例

### W10：選項 B 核心（**付費機制**）
- 一次性付費（Stripe Checkout）
- admin 訂閱（Recur.tw）
- 用量配額追蹤

### W11：選項 D（**業務 API**）
- 對外 REST API（minimal: instantiate + list scenarios）
- API key 管理
- 代理商 onboarding 文件

### W12：選項 A 收尾（**第二、第三場活動**）
- 透過 W10 + W11 工具找新客戶
- 寫業務簡報（成功案例）
- Phase 3 整體收尾

### 暫緩

- **選項 E（多語系）**：Phase 4 / 之後
  - 等 Phase 3 確定 PMF + 有國際客戶 lead
  - 機械翻譯先做、人工潤飾後做

- **選項 F（LINE 整合）**：Phase 4 / 之後
  - 等付費機制 + AI 內容穩定
  - 屬於擴展通路、不是核心改造

---

## 理由（≤ 5 點）

1. **驗證 PMF 優先**：Phase 2 工具完整，但沒人用 = 無意義。W9 必須有真實客戶。

2. **選項 A + C 互補**：客戶要的不是「會 demo 的平台」而是「立即能用的內容」。AI 內容生成讓 default 從「範例題」變「客製題」。

3. **選項 B 緊接其後**：客戶用了 = 願意付。W10 補上付費機制，立即啟動現金流。

4. **選項 D 擴大規模**：個人客戶累到 5-10 個就到瓶頸，需要代理商 / API 擴展。

5. **選項 E、F 暫緩**：技術投入大、不直接變現。等 PMF 確定後再做。

---

## 影響

### 程式碼面
- W9：scenarios.ts 加 AI content generation hook
- W10：新建 `payments/` 模組（Stripe / Recur.tw）
- W11：新建 `api/v1/` 公開 API + API key middleware

### 紅線
- AI 內容生成失敗時要 fallback 到 default 範例（不能讓 instantiate 失敗）
- 付費失敗不能影響既有 admin 流程
- API 必須有 rate limit（避免代理商濫用）

### 已知限制
- AI 內容品質不穩定 → admin 需 review UI
- 付費機制需法遵諮詢（發票、退款）
- API 公開後安全要求提升（API key 旋轉、log）

---

## 後續可能變動

- 若 W9 第一場活動回饋顯示「客戶不需要 AI 內容」 → 縮 W9 D3-D4 範圍、提早 W10
- 若 W10 付費機制因法遵卡關 → 改用 Stripe 國際版先收 USD，後補台幣發票
- 若 W11 沒有代理商需求 → 改 Phase 4 自有業務團隊擴張

每階段結束評估、必要時調整 ADR。

---

## 相關文件

- [Phase 2 完整收尾](../changes/2026-05-02-phase2-complete.md)
- [W7 PitchDeck（含收費三方案）](../changes/2026-05-02-phase2-w7-d4-pitch-deck.md)
- [Runbook 情境啟動 SOP](../runbooks/scenario-launch.md)
- [ADR-0004 HostScreen 軸線](0004-host-screen-axis.md)
