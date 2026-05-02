# 🎉 Phase 5 W17 完整收尾（業務週）

**日期**：2026-05-03
**範圍**：W17 D1-D5 完整 retro
**狀態**：🟢 W17 業務週工程備援任務全套完成、W18 元件擴充準備就緒

---

## 📊 W17 整體統計

| 項目 | 數字 |
|------|------|
| 持續天數 | 5 天 |
| 新增 / 修改檔案 | 12+ |
| 程式碼行數 | ~1,500 |
| Commits | 5（D1-D5）|
| Smoke test 從 | 48 → 51（+3 筆驗證）|
| 部署次數 | 4 次 |

---

## 🎯 W17 主軸

> 業務週 — 業務跑客戶招募、工程備援強化客戶 self-service 工具
> 「業務每次都要回答相同問題」 → 「客戶看頁面自己決策」

---

## 🚀 W17 各日成果

### W17 D1 — 業務跑團 SOP（純 docs）
- `docs/runbooks/customer-pilot.md` — 10 步驟 SOP（每步 ≤ 30 分鐘）
- `docs/runbooks/pilot-feedback-template.md` — 5 錨點反饋模板
- 業務從「每場 pilot 各做各的」→「結構化收集可比較」

### W17 D2 — 公開 FAQ 頁
- `client/src/pages/Faq.tsx` — 14 題分 7 類
- 互動展開 / 收合、底部 3 個 CTA
- 客戶 self-service 解 80% 常見疑慮

### W17 D3 — ROI 計算機公開頁
- `client/src/pages/RoiCalculator.tsx` — 3 參數試算
- 5 種活動類型、3 個輸出指標、總結 ROI 比例
- 業務殺手級工具：客戶數字說服自己

### W17 D4 — Admin Pilot 健康度雛形
- `server/routes/admin-pilot-health.ts` — endpoint 雛形
- 三大區塊：activity / coverage / serviceStatus
- 為 W20 觀測週鋪路

### W17 D5 — retro + W18 規劃（本日）
- W17 業務週完整收尾
- ADR-0013 W18 元件擴充規劃
- 5 個新元件清單確認

---

## 📈 客戶決策完整路徑（W17 完成後）

```
[業務聯絡 / SEO 觸及]
    ↓
/pitch 完整介紹
    ↓
/roi 自我說服（W17 D3）          ← 數字
    ↓
/find-scenario 三問配對
    ↓
/template-market 看 12 模板
    ↓
/faq 解疑慮（W17 D2）             ← 細節
    ↓
/pricing 看價格
    ↓
業務聯繫成交
```

每階段客戶 self-service、業務只在最後一哩介入 ✅

---

## 🛠 admin 工具完整鏈（Phase 4-5 累積）

### Phase 4 LINE 工具鏈
- 建場：`@chito 婚禮 ...`
- 管理：`@chito 我的活動` / `@chito 結束 <id>`
- 推播：過期前 1 小時 LINE reminder
- Webhook：客戶端 instance.expired 自動派發

### Phase 5 觀測 + 客戶工具（W17）
- pilot/health endpoint（W17 D4）
- 公開頁：FAQ + ROI（W17 D2-D3）
- 業務 SOP + 反饋模板（W17 D1）

---

## 💼 W17 業務 KPI 評估

設定目標（W17 D1）vs 實際：

| KPI | 目標 | 實際（業務統計） |
|-----|------|----------|
| 接觸潛在客戶 | ≥ 5 人 | ⏳ 業務統計中 |
| 真實成交客戶 | ≥ 1 人 | ⏳ 業務統計中 |
| 完整跑團 | ≥ 1 場 | ⏳ 業務統計中 |
| 客戶反饋 | ≥ 1 份 | ⏳ 業務統計中 |

→ W17 結束後業務同學補上實際數字（W17 retro 不阻擋 W18 推進）

---

## 🎯 設計決策回顧

### 為何 W17 工程做這 4 件而非別的？

選擇：SOP / FAQ / ROI / Health endpoint

理由：
1. 業務週工程不是主角、不可干擾客戶招募
2. 但工程同學有產能、不該閒置
3. 4 個任務共通點：直接強化業務說服力或客戶 self-service
4. 沒有任何修改既有功能（避免引入 bug）
5. Smoke test 持續綠（無 regression）

### 為何 D5 不做 W18 第一個元件？

選擇：D5 純 retro + 規劃

理由：
- W18 元件擴充需要先確認清單（避免做白工）
- W17 業務反饋可能改變 W18 元件優先順序
- D5 retro + ADR 準備 = D1-D5 完整週收尾
- W18 D1 從規劃落地開始（清晰節奏）

---

## ⏭ 下一步：W18 元件擴充週

依 ADR-0013 規劃：
- W18 D1：host_lottery_wheel（轉盤抽獎）
- W18 D2：host_progress_quest（全場進度條）
- W18 D3：host_word_cloud（即時字雲）
- W18 D4：multi_quest_chain（隊伍任務鏈）
- W18 D5：solo_memory_match（配對記憶遊戲）+ W18 retro

每個元件 ≥ 5 個單元測試、含 ShowcaseHub demo。

---

## 🔗 相關文件

- W17 五天紀錄：
  - [W17 D1 客戶 pilot 啟動](2026-05-03-phase5-w17-d1-customer-pilot.md)
  - [W17 D2 FAQ 頁](2026-05-03-phase5-w17-d2-faq-page.md)
  - [W17 D3 ROI 計算機](2026-05-03-phase5-w17-d3-roi-calculator.md)
  - [W17 D4 Pilot Health](2026-05-03-phase5-w17-d4-pilot-health.md)
- ADR：
  - [ADR-0012 Phase 5 方向](../decisions/0012-phase5-direction.md)
  - [ADR-0013 W18 元件擴充規劃](../decisions/0013-w18-component-expansion.md)（本日新增）
- Runbooks：
  - [Customer Pilot Runbook](../runbooks/customer-pilot.md)
  - [Pilot Feedback Template](../runbooks/pilot-feedback-template.md)
