# 商業模式統合

> 平台商業模式、客戶分層、收費策略、變現路徑、競爭定位
> 統合散在 ADR-0006 / 0008 / 0009 / 0010 / 0012、pitch deck、phase 各 W 路徑
> 最後更新：2026-05-14（初稿）

---

## 一句話定位

> **「場域型互動遊戲 SaaS 平台」** — 把實體場域（民宿、街區、商圈、活動現場）轉成可互動、可量化、可重玩的遊戲體驗。

---

## 五大商業情境

| # | 情境 | 目標客戶 | 場景 | 收費方向 |
|---|------|---------|------|---------|
| 1 | **公部門** | 縣市府 / 文化局 / 觀光局 | 街區活化、社區培力、文化導覽 | 委辦 NT$ 80K-200K |
| 2 | **私部門活動** | 企業 / 婚禮主 / 學校 | 內訓破冰、婚禮、生日、頒獎、園遊會 | 一次性 NT$ 3K-30K |
| 3 | **活動** | 活動公司 / 旅行社 | 一次性大型活動、旅遊團 | 一次性 NT$ 5K-30K |
| 4 | **空間活化** | 民宿主 / 商圈 / 場域業者 | 持續性場域經營、回頭客 | **訂閱 NT$ 1.5K-5K/月** ⭐ |
| 5 | **交誼破冰** | 個人主辦 / 社團 | 同學會、家族聚會、社團活動 | 一次性 NT$ 3K-10K |

⭐ = 主推方向（最高 LTV / 最穩定 MRR）

---

## 收費三方案

來源：[ADR-0006](../decisions/0006-payment-recur.md) / [phase3-w10 系列](../changes/)

| 方案 | 範圍 | 客戶痛點 | 我們的解 |
|------|------|---------|---------|
| **一次性** | NT$ 3K-30K | 「我只辦一場活動」 | 一鍵建場 + 30 分鐘現場可玩 |
| **訂閱** ⭐ | NT$ 1.5K-5K/月 | 「我場域要持續經營」 | 多場域 + 持續更新 + AI 內容 |
| **委辦** | NT$ 80K-200K | 「我有預算但沒人會用」 | 全包 + 客製 + 培訓 |

### 為什麼訂閱是主推

| 指標 | 一次性 | 訂閱 | 委辦 |
|------|--------|------|------|
| 取得成本 | 中 | 中 | 高 |
| LTV | 低（單次） | **高**（12+ 月） | 中 |
| 客單價 | 中 | 中 | 高 |
| 可預測性 | 低 | **高** | 中 |
| 可複製性 | 中 | **高** | 低 |
| 適合規模化 | 是 | **最佳** | 否 |

---

## 客戶分層

| 層級 | 規模 | 收費 | 服務模式 | 例 |
|------|------|------|---------|-----|
| **長尾** | 個人 / 一次性 | NT$ 3K-10K | 自助 + LINE Bot | 婚禮主 / 同學會 / 生日 |
| **中段** | 中小場域 | NT$ 1.5K-5K/月 訂閱 | 自助 + 業務支援 | 民宿 / 街區攤商 |
| **頭部** | 公部門 / 大型企業 | NT$ 50K-200K 委辦 | 全包 + 培訓 | 文化局 / 觀光局 / 大型內訓 |

---

## 變現路徑（已交付的工具鏈）

| 工具 | ADR / 來源 | 狀態 | 變現點 |
|------|-----------|------|--------|
| 一鍵建場（admin + 12 情境模板）| Phase 2 W6 | ✅ | 降低取得成本 |
| AI 內容生成（DeepSeek）| Phase 3 W9 | ✅ | 客單價提升 |
| 付費系統（Recur.tw + Stripe）| ADR-0006 | ✅ | 收款 |
| 信件 / 發票（Resend）| ADR-0007 | ✅ | 客戶體驗 |
| Public API + SDK | ADR-0008 / Phase 3 W11-12 | ✅ | 代理商通路 |
| Webhook 雙向 | Phase 3 W12 | ✅ | 客戶整合 |
| LINE LIFF（玩家端） | Phase 4 W14 | ✅ | 玩家取得成本降低 |
| LINE Bot @chito（admin 端） | Phase 4 W15 / ADR-0010 | ✅ | admin 取得成本降低 |
| 用量配額追蹤 | Phase 3 W10 D4 | ✅ | 訂閱方案差異化 |

---

## 競爭優勢

### 護城河

1. **多場域隔離 + 跨場域玩家身份** — 玩家可在不同場域玩、戰績獨立、但身份統一（罕見組合）
2. **AI 內容生成** — admin 30 秒生成情境（DeepSeek 整合）⚡ vs 競品需手動 1 小時+
3. **完整工具鏈** — 從建場、付費、信件、API、SDK、Webhook、LINE 全閉環、不靠第三方
4. **真實場域實戰** — 賈村競技場 + 後浦小鎮 持續驗證
5. **觀測閉環** — session_reports + Web Vitals + Telegram 推送（看得到問題才能修）

### 弱項與待補

1. **真實付費客戶數仍為 0** — Phase 5 W17 招募中（[business-metrics.md](business-metrics.md)）
2. **完成率 9.5%** — 體驗有缺口（W1 完成率歸因進行中）
3. **多語系未做** — 限制國際擴張
4. **客戶自助上手仍需業務手把手** — runbook 化未完成

---

## 通路策略

### 直接通路（B2C-like）

- **LINE Bot @chito** — admin 直接對話建場
- **官網 /pricing** — 一次性方案自助下單
- **官網 /find-scenario** — 三問引導找情境

### 代理商通路（B2B）

- **Public API + SDK** — 代理商整合自己系統
- **代理商 onboarding runbook** — 已備
- **Webhook** — 整合事件流

### 業務通路

- **/pitch** — 業務簡報頁
- **客戶 onboarding runbook** — 已備
- **Pilot 反饋模板** — 業務跑完一場填模板

---

## 階段性目標

### Phase 5（當前）

- 第一個真實付費客戶（W17）
- 3-5 個 pilot 場（W17-W19）
- 真實 MRR > NT$ 0

### Phase 6 候選

- 規模化客戶招募（業務 + 代理商通路）
- 多語系（國際擴張）
- AI 內容品質升級（採用率 > 50%）

### Phase 7 候選

- 國際市場（東南亞 / 日韓觀光場域）
- 平台白標化

---

## 重要決策依據

- [ADR-0006 付費 Recur.tw](../decisions/0006-payment-recur.md) — 為什麼選 Recur.tw 而非 Stripe 主導
- [ADR-0008 Public API](../decisions/0008-public-api.md) — 為什麼開放 API
- [ADR-0009 Phase 4 方向](../decisions/0009-phase4-direction.md) — LINE LIFF 選擇
- [ADR-0010 LINE Bot](../decisions/0010-line-bot.md) — 為什麼選 LINE 而非其他平台
- [ADR-0012 Phase 5 方向](../decisions/0012-phase5-direction.md) — 真實客戶為主軸

---

## 相關文件

- [customer-feedback.md](customer-feedback.md) — 真實客戶聲音
- [business-metrics.md](business-metrics.md) — MRR / 付費客戶 SOT
- [runbooks/customer-onboarding.md](../runbooks/customer-onboarding.md)
- [runbooks/customer-pilot.md](../runbooks/customer-pilot.md)
- [runbooks/agency-onboarding.md](../runbooks/agency-onboarding.md)

---

## 狀態

🟡 **初稿** — 結構完整、待 Phase 5 真實付費客戶資料補強。

**第一個任務**（產品 actionable）：W1 完成率歸因 endpoint 上線後，把「為什麼完成率低」的歸因資料加入「弱項與待補」段、形成 actionable 修補清單。
