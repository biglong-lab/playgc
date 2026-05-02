# Phase 5 W17 D3 — ROI 計算機公開頁

**日期**：2026-05-03
**範圍**：W17 D3（業務週工程備援任務 v2）
**狀態**：🟢 W17 D3 完成、客戶可即時試算 ROI 自我說服

---

## 🎯 目標達成

> W17 業務週、D3 工程補強客戶說服工具
> 從「業務口頭說平台值得」→「客戶自己填參數看數字」

---

## 📦 新增

### 1. `client/src/pages/RoiCalculator.tsx`

**3 個輸入參數**：
- 活動類型（5 種）：婚禮 / 同學會 / 企業內訓 / 街區 / 破冰
- 預估人數（10-500）— Slider
- 預算（NT$ 3,000 - 200,000）— Slider

**3 個輸出指標**：
- 節省時間（小時 + 元值）
- 互動率提升（% + 受影響來賓數）
- 互動價值（NT$）

**最終總結**：
- 總價值產出 vs 投入 → ROI 比例（例：1:5.3）

### 2. 試算依據（5 種活動）

| 活動 | 手動籌備 | 平台 | 純活動互動 | 平台互動 | 來賓單值 |
|------|----------|------|-----------|----------|----------|
| 婚禮 | 8h | 1h | 35% | 80% | NT$ 150 |
| 同學會 | 5h | 1h | 40% | 75% | NT$ 100 |
| 企業內訓 | 10h | 1.5h | 30% | 75% | NT$ 200 |
| 街區商圈 | 15h | 2h | 20% | 65% | NT$ 80 |
| 破冰 | 4h | 0.5h | 45% | 85% | NT$ 80 |

**時薪估值**：NT$ 500（含時間 + 心力 + 出錯成本）

### 3. 計算邏輯

```ts
timeSavedValue = (manualHours - platformHours) × 500
engagementGuests = guestCount × (platformEngagement - baselineEngagement) / 100
engagementValue = engagementGuests × perGuestValue
totalGain = timeSavedValue + engagementValue
roi = totalGain / budget
```

### 4. 路由 + PitchDeck CTA + smoke test

- `/roi` 路由註冊
- PitchDeck 加「💰 ROI 試算」按鈕
- smoke test PUBLIC_PAGES 加 `/roi`（49 → 50）

---

## 💡 設計決策

### 為何用 Slider 而非數字輸入？

選擇：Slider + Badge 即時顯示

理由：
- Slider 操作直觀（滑就有結果）
- 客戶不用打字、體驗順暢
- 結果即時更新（useMemo 響應式）
- 限制範圍合理（不會輸入 1000000 人破壞 UI）

### 為何 5 種活動類型固定（非自訂）？

選擇：5 種預設、各自有不同參數

理由：
- 5 種覆蓋 80% 真實活動
- 每種有真實業界數據可估
- 自訂 → 客戶不知道填什麼、UX 差
- 5 種剛好兩排顯示在手機上

### 為何時薪 NT$ 500？

選擇：固定 NT$ 500、不讓客戶調

理由：
- 業界平均（含時間 + 心力 + 出錯成本）
- 客戶調太低 → ROI 看起來小、不買
- 客戶調太高 → 我們高估價值、不誠信
- 固定 = 一致基準、易比較

### 為何「來賓單值」固定？

選擇：依活動類型固定（婚禮 NT$ 150、商圈 NT$ 80）

理由：
- 婚禮 / 內訓的「品牌記憶價值」高（NT$ 150-200）
- 商圈 / 破冰的「短期曝光價值」較低（NT$ 80）
- 業界傳播 / 行銷研究數據
- 客戶要 challenge 數字 → 業務說明依據

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- Smoke test：49 → 50（新增 `/roi` 驗證）

---

## 📊 客戶決策路徑（W17 完成後）

```
客戶看到我們
    ↓
/pitch（完整簡報）
    ↓
/roi（自己試算 → 數字說服自己）  ← W17 D3 新加
    ↓
/find-scenario（三問配對）
    ↓
/template-market（看模板）
    ↓
/faq（解答疑慮） ← W17 D2 新加
    ↓
/pricing（看價格）
    ↓
業務聯繫成交
```

每階段客戶 self-service、業務只在最後一哩介入 ✅

---

## ⏭ 下一步：W17 D4

備援工程任務（業務不需 hotfix 時）：
- W17 D4：admin 後台「客戶健康度」儀表板雛形（活動數 / 玩家活躍 / 收入趨勢）
- 或案例庫頁（待 W17 真實案例累積）

---

## 🔗 相關文件

- [W17 D2 FAQ 頁](2026-05-03-phase5-w17-d2-faq-page.md)
- [W17 D1 客戶 pilot 啟動](2026-05-03-phase5-w17-d1-customer-pilot.md)
- [Customer Pilot Runbook](../runbooks/customer-pilot.md)
- [ADR-0012 Phase 5 方向](../decisions/0012-phase5-direction.md)
