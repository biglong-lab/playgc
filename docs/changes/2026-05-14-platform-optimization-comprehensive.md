# 平台全站優化計劃（P0-P3 全包） — 2026-05-14

> 範圍：三週路徑，預估 15-20h，涵蓋商業閉環 / KPI 校準 / 紅線自動化 / 文件層健全
> 狀態：**規劃中（草稿）** — 等使用者確認後拆 commit 推進
> 部署：未開工

---

## 背景

技術交付完整但商業驗證脫節。盤點當下事實：

| 維度 | 數字 |
|------|------|
| 元件 | 41+ 個（主控 10/10、多人 13/13、單人 18+） |
| 情境模板 | 12 個（五大商業情境全覆蓋） |
| Smoke test | 51/51 ✅ 全綠 |
| TypeScript | 0 errors |
| 工具鏈 | AI / 付費 / 信件 / Public API / SDK / LINE 全 ✅ |
| **業主活動完成率** | **9.5%** 🚨 |
| **業主活動放棄率** | **47.5%** 🚨 |
| 真實付費客戶數 | 未追蹤 |
| MRR | 未追蹤 |
| AI 採用率 | 未追蹤 |

「技術綠燈 ≠ 商業綠燈」。Phase 5 規劃了「真實客戶招募 + 第一場付費活動」但缺乏：
1. 商業 KPI 的 single source of truth
2. 完成率歸因（為什麼放棄、卡哪步）
3. 客戶反饋與商業模式的 domain 整合
4. 紅線（loop 接地、情境必對應）的自動化檢核

本變動把 P0/P1/P2/P3 四層優化打包成三週路徑。

---

## 影響範圍

### 程式碼
- `server/routes/`：新增 admin metrics endpoints（完成率歸因、AI 採用、Bot 使用）
- `server/services/`：埋點服務、漏斗分析
- `client/src/pages/admin/`：metrics dashboard 升級
- `shared/schema.ts`：新增 `component_scenarios`、`admin_session_timings` 兩個輕量表
- `scripts/`：CI 檢核（元件→情境、loop 接地偵測）

### DB Schema（只新增、不改）
- `component_scenarios` — 元件 → 五大情境的反向 mapping
- `admin_session_timings` — admin 從「進後台」到「QR 印出」的時序埋點
- `customer_feedback`（可選）— 真實客戶聲音結構化儲存

### 文件
- 新增 `docs/domains/business-model.md` — 商業模式統合
- 新增 `docs/domains/customer-feedback.md` — 真實客戶聲音 SOT
- 新增 `docs/domains/business-metrics.md` — KPI 與 MRR 追蹤
- 升版 `docs/runbooks/customer-onboarding.md` — 接觸→付費漏斗話術
- 拆分 `~/.claude/projects/.../memory/MEMORY.md`（433 行 → 主索引 + projects/ 子檔）

### 不影響
- 五大商業情境定義
- Squad 系統
- 多場域隔離
- 既有元件 41+ 個
- 收費三方案（Recur.tw + Stripe + 委辦）

---

## 解決方案

三週路徑，每週一塊獨立可交付：

### Week 1 — P0 商業閉環（6-8h，最緊急）

**目標**：知道「為什麼完成率 9.5%」+ 把商業聲音結構化。

1. **完成率歸因儀表板**
   - 後端：分群 query（依元件、依步驟、依停留時間 distribution）
   - 前端：admin metrics 加「放棄熱點」視覺化
   - 資料源：既有 `session_reports` + Web Vitals，不新增大表

2. **客戶反饋 domain 檔**
   - 新增 `docs/domains/customer-feedback.md` — 把散在 changes/ 的業主聲音搬進來、結構化（時間 / 原話 / 影響元件 / 處理狀態）
   - 後續所有真實反饋直接寫這檔，不再散落

3. **付費客戶 SOT 表**
   - 新增 `docs/domains/business-metrics.md` — 真實付費客戶清單（場域名、方案、金額、開始日、狀態）
   - MRR / churn 月度計算（手動更新先，自動化留 Week 3）

### Week 2 — P1 KPI 校準（4-6h）

**目標**：把「設計目標」變「驗證事實」。

4. **admin 30 分鐘建場 SLA 埋點**
   - 新增 `admin_session_timings` 表
   - 後台路由進出時間戳記（進後台 / 選情境 / 一鍵建場 / QR 印出）
   - admin metrics dashboard 顯示 p50 / p90 / p95
   - 若 p90 > 30 分鐘 → 紅燈

5. **AI 採用率追蹤**
   - 既有 ai-preview endpoint 加 logging（admin 選紫色 vs 綠色）
   - dashboard 顯示週採用比例
   - 低於某閾值（先抓 20%）→ 提醒檢視 AI 品質

6. **LINE Bot @chito 使用報表**
   - 既有 webhook 加事件記錄
   - dashboard 顯示：對話量、成功建場次數、失敗原因 top 3

### Week 3 — P2+P3 紅線自動化與文件層健全（5-7h）

**目標**：防止漂移、文件 source of truth 收斂。

7. **元件 → 情境 CI check**
   - 新增 `component_scenarios` mapping 表（先手動填 41 個元件）
   - CI 規則：任何新元件 PR 必須帶情境標註（commit message 或 PR description）
   - 找不到 mapping → CI 紅燈

8. **Loop 接地驗證偵測**
   - 寫腳本：掃描最近 5 個 commit、若全部都沒跑 smoke / e2e → CLI 警告
   - 寫進 git pre-push hook（可繞過、但會警告）

9. **MEMORY.md 拆分**
   - 主檔 ≤ 200 行（只放索引）
   - 拆 `memory/projects/digital-game-platform.md` 放專案細節
   - 拆 `memory/feedback/` 放使用者偏好

10. **`business-model.md` domain 檔**
    - 統合散在 ADR-0006、0007、0008、changes 的商業模式
    - 收費三方案 + 客戶分層 + 對應情境

11. **`customer-onboarding.md` runbook 升版**
    - 加「接觸 → 試用 → 付費」漏斗各階段話術
    - 真實客戶反饋對應修正動作

---

## 實作步驟（commit 順序待開工後確認）

Week 1：
1. `feat(metrics): 完成率歸因 query + dashboard`
2. `docs(domains): customer-feedback.md 結構化客戶聲音`
3. `docs(domains): business-metrics.md MRR + 付費客戶 SOT`

Week 2：
4. `feat(schema): admin_session_timings 表`
5. `feat(admin): 30 分鐘 SLA 埋點 + dashboard`
6. `feat(metrics): AI 採用率 + LINE Bot 使用報表`

Week 3：
7. `feat(schema): component_scenarios mapping`
8. `feat(ci): 元件→情境檢核 + loop 接地偵測`
9. `chore(memory): MEMORY.md 拆分`
10. `docs(domains): business-model.md 商業模式統合`
11. `docs(runbooks): customer-onboarding.md 漏斗話術升版`

每個 commit 完成都跑 smoke + TS check 才推。

---

## 驗證

| 項目 | 通過條件 |
|------|---------|
| Week 1 完成率歸因 | admin 能看出「放棄集中在哪步 / 哪元件」 |
| Week 1 客戶反饋 SOT | 過去 1 個月所有業主聲音 ≥ 80% 入檔 |
| Week 1 付費客戶 SOT | 真實付費客戶清單存在，MRR 計算公式明確 |
| Week 2 admin SLA | dashboard 顯示 p50/p90/p95，至少 3 場真實 admin 操作有資料 |
| Week 2 AI 採用率 | dashboard 顯示週採用比例 |
| Week 2 LINE Bot | dashboard 顯示對話量與失敗原因 |
| Week 3 CI 檢核 | 故意推一個沒情境標註的 fake 元件 → CI 紅燈 |
| Week 3 loop 偵測 | 連推 5 個 no-test commit → pre-push 警告觸發 |
| Week 3 MEMORY | 主檔 ≤ 200 行 |
| Week 3 文件層 | business-model / customer-feedback / business-metrics 三檔有實質內容 |

整體成功標準：
- ✅ 三週後再次盤點，能用一張 dashboard 回答「目前商業狀態」
- ✅ 完成率 9.5% 有歸因（可能還沒解決，但知道原因）
- ✅ 五大商業情境每個都有實際付費客戶 OR 明確下一步

---

## 已知限制 / 後續優化

### 本計劃不涵蓋
- ❌ 完成率 9.5% 的實際修補（要先歸因才能修）
- ❌ 自動化的 MRR 計算（先手動）
- ❌ 真實客戶招募（屬 Phase 5 W17 業務工作，非技術）
- ❌ 元件擴充（Phase 5 規劃中，本計劃凍結元件數）

### 風險
- 🟡 中：CI 檢核可能阻塞既有 PR 流程，要漸進開（先警告、後紅燈）
- 🟡 中：MEMORY 拆分可能影響跨對話記憶連續性，需驗證新結構讀取正常
- 🟢 低：埋點影響效能（資料量小、不阻塞請求）

### 後續可能延伸
- Week 4+：自動化 MRR 計算 + 月報自動產出
- 完成率歸因若指向特定元件 → 該元件 UX 重設計
- AI 採用率若 < 20% → AI 內容品質檢視 + prompt 優化

---

## 相關文件

- 全站盤點對照：本檔上方「背景」段
- 核心紅線：[../../CLAUDE.md](../../CLAUDE.md) #9（loop 接地）#11（情境必對應）#12（拒模糊指令）
- 既有 Phase 5 規劃：[2026-05-12 系列 changes](.)
- 既有 ADR：0001（Auth）/ 0003（Squad）/ 0006（付費）/ 0007（信件）/ 0008（API）/ 0010（LINE Bot）/ 0018（Realtime）
- Session handoff：[2026-05-14-session-handoff.md](2026-05-14-session-handoff.md)

---

## 草稿狀態 → 待決策

**等使用者確認以下後展開**：

1. 三週路徑可接受嗎？或要壓縮成兩週 / 拆成獨立小批？
2. Week 1 三項是否要再拆細（例如「完成率歸因」可獨立成完整 sub-feature）？
3. Week 3 CI 檢核要從「警告」開始還是直接「紅燈」？
4. 是否需要先把這份計劃寫成 ADR（如「ADR-0019 平台優化分批節奏」）以鎖定方向？
5. 三個新文件（business-model / customer-feedback / business-metrics）內容由我先掃既有資料初稿，還是你先口述要點再整理？

確認後拆 commit 推進，並把本檔狀態從「規劃中」改為「進行中」。
