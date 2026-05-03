# 📖 賈村數位遊戲平台 — 元件 + 情境 + 運作說明手冊

> **對象**：業務、行銷、客戶 onboarding、合作夥伴、新進工程師
> **目的**：一份就能搞清楚平台所有資產、如何運作、誰用什麼
> **版本**：v1.0（2026-05-03）
> **更新節奏**：新元件 / 新情境上線時同步更新

---

## 🎯 平台一句話

> 「核心穩定、元件豐富、情境化套用」 — 公部門 / 企業 / 活動 / 空間 / 交誼五大市場通用的數位互動 SaaS。

我們**不賣複雜遊戲**，我們提供：
- **穩定的平台核心**（Auth、付費、資料庫、即時通訊）
- **可組合的元件庫**（28 個現役元件、可繼續加）
- **預設情境模板**（12 個現成模板、客戶 30 分鐘現場可玩）
- **業務工具鏈**（簡報、找情境、API、後台、QR 列印）

商業彈性：一次性活動 NT$ 3K-30K、訂閱 NT$ 1.5K-5K/月、委辦案 NT$ 80K-200K。

---

## 📚 手冊目錄

| 章節 | 內容 | 適合誰看 |
|------|------|---------|
| [01-host-components](01-host-components.md) | 14 個 **HostScreen 軸線**元件（大螢幕主視覺）| 設計師、活動企劃、業務 |
| [02-multi-components](02-multi-components.md) | 14 個 **多人軸線**元件（玩家手機端互動）| 設計師、遊戲企劃、客戶 |
| [03-scenario-templates](03-scenario-templates.md) | 12 個 **情境模板**（5 大市場全覆蓋）| 業務、客戶、活動承辦 |
| [04-business-pages](04-business-pages.md) | 業務簡報、找情境精靈、後台、API 文件等 8 個工具頁 | 業務、客戶、API 開發者 |
| [05-platform-flow](05-platform-flow.md) | 整體運作流程：業務→客戶→admin→玩家 | 全員、新進人員 |

---

## 🧩 三大軸線設計

平台元件分為**三條軸線**，技術契約不同、不可混用：

```
┌─────────────────────────────────────────────┐
│  HOST 軸線（host_*）                          │
│  📺 一對多廣播 → 大螢幕                       │
│  - 用於：園遊會、婚禮、頒獎、企業大會           │
│  - 認證：hostToken（無 Firebase）              │
│  - 玩家：手機 QR 掃描即可加入、無需登入         │
│  - 數量：14 個元件                            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  MULTI 軸線（無 host_ 前綴、multi/）          │
│  👥 多人協作 / 對戰                           │
│  - 用於：街區走讀、企業內訓、員工旅遊、密室逃脫  │
│  - 認證：Firebase auth + Squad 隊伍系統        │
│  - 玩家：需登入、組隊、有戰績累積               │
│  - 數量：14 個元件                            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  SOLO 軸線（單機、未來擴充）                   │
│  📱 個人闖關                                  │
│  - 用於：故事體驗、學習測驗                    │
│  - 認證：Firebase auth                        │
│  - 數量：暫合併在 game-templates.ts            │
└─────────────────────────────────────────────┘
```

**設計依據**：[ADR-0004 host-screen-axis](../decisions/0004-host-screen-axis.md)

---

## 🏪 5 大市場速查

| 市場 | 代表情境 | 主打元件 | 收費 |
|------|---------|---------|------|
| 🏛 **公部門** | 街區走讀、商圈打卡 | GpsCascade、TerritoryCapture、KnowledgeMap | NT$ 80K-200K/季委辦 |
| 💼 **私部門** | 企業內訓、員工旅遊 | TriviaShowdown、RoleAssign、PhotoTeamFlow | NT$ 1.5K-5K/月訂閱 |
| 🎉 **活動** | 園遊會、破冰、頒獎 | EmojiReact、WaveResponse、PollLive、CrowdGather | NT$ 5K-30K/場 |
| 🏠 **空間** | 民宿、咖啡廳、博物館 | TreasureHunt、QuestChain、PolaroidCollage | NT$ 800-2.5K/月 |
| 💝 **交誼** | 婚禮、生日、同學會 | PolaroidCollage、GuestbookDigital、WordCloud | NT$ 2K-15K/場 |

---

## 🚀 快速上手

### 我是業務 → 先看
1. [04-business-pages](04-business-pages.md) §1 PitchDeck 簡報頁
2. [03-scenario-templates](03-scenario-templates.md) 看 12 情境
3. [05-platform-flow](05-platform-flow.md) §3 業務動線

### 我是客戶 / 活動承辦 → 先看
1. [04-business-pages](04-business-pages.md) §2 FindScenarioWizard
2. [03-scenario-templates](03-scenario-templates.md) 找最像你的情境
3. [05-platform-flow](05-platform-flow.md) §4 客戶 30 分鐘現場可玩

### 我是工程師 / 設計師 → 先看
1. [01-host-components](01-host-components.md) + [02-multi-components](02-multi-components.md)
2. [05-platform-flow](05-platform-flow.md) §5 admin 後台
3. [`docs/architecture/`](../architecture/) 系統架構

### 我是 API 開發者 / 代理商 → 先看
1. [04-business-pages](04-business-pages.md) §3 ApiDocs
2. [`docs/runbooks/agency-onboarding.md`](../runbooks/agency-onboarding.md)
3. `/api/v1/openapi.json` OpenAPI 規格

---

## 📊 平台現況快照（2026-05-03）

| 項目 | 數量 / 狀態 |
|------|------------|
| Host 元件 | 14 個 ✅ live |
| Multi 元件 | 14 個 ✅ live |
| 情境模板 | 12 個（10 live、2 preview）|
| 業務工具頁 | 8 個 ✅ 全公開 |
| 公開 API endpoints | 5 個（v1）|
| Smoke test | 51/51 ✅ |
| 完整 test:run | 157 檔 / 2207 tests ✅ |
| 生產站 | https://game.homi.cc ✅ |

---

## 🔗 相關文件

- [docs/CHANGELOG.md](../CHANGELOG.md) — 版本紀錄
- [docs/CLAUDE.md](../../CLAUDE.md) — 工程師工作指南
- [docs/runbooks/customer-onboarding.md](../runbooks/customer-onboarding.md) — 客戶上手 SOP
- [docs/runbooks/agency-onboarding.md](../runbooks/agency-onboarding.md) — 代理商接入
- [docs/decisions/](../decisions/) — 16 個 ADR 設計決策
