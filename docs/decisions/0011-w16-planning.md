# ADR-0011: Phase 4 W16 規劃 — 完整 Instantiate + 進階 LINE 互動 + Phase 5 啟動

> **日期**：2026-05-03
> **狀態**：採用中
> **影響**：Phase 4 收尾 + Phase 5 啟動方向

---

## 背景

W15 完整收尾：LINE Bot 五天鏈路（D1 scaffold → D2 push → D3 NLU → D4 webhook → D5 真建場）。

W15 D5 有兩個已知簡化（避免拖到 W16+）：
1. `instantiateScenarioForLine` 只建第 1 個 host 元件（不支援多元件 / multi / solo）
2. admin 認證用環境變數（不是 schema）

W16 要決定：
- 是否擴充 LINE 真建場到完整版？
- 是否做 admin schema 取代環境變數？
- 是否進入 Phase 5（國際化 / 第二場域 / 更多情境模板）？

---

## 選項

### 方案 A：W16 全力補完整 instantiate + admin schema

| 優點 | 缺點 |
|------|------|
| LINE Bot 流程 100% 完整 | 重構 scenarios.ts 風險 |
| admin 數量未來 > 10 時不需重做 | admin 數量目前 < 5、過度設計 |
| 與 admin endpoint 統一邏輯 | 5 天用在重構不在新功能 |

### 方案 B：W16 補完整 instantiate（多元件）+ 不動 admin schema

| 優點 | 缺點 |
|------|------|
| LINE 體驗完整（多元件） | 環境變數 admin 管理仍是限制 |
| 不動 schema 紅線 | 未來 admin > 10 才需處理 |
| 用 5 天做新東西（W16 D4 進階 LINE / D5 Phase 5）| - |

### 方案 C：W16 進入 Phase 5 / 接客戶（W15 已可用）

| 優點 | 缺點 |
|------|------|
| 業務優先、開發配合需求 | LINE 真建場仍只支援單一 host 元件 |
| 真實使用反饋驅動優化 | 早期客戶可能踩到限制 |

---

## 決定

**採方案 B：W16 補完整 instantiate + 不動 schema**

理由（≤ 5 點）：
1. LINE Bot 完整體驗是商業關鍵（admin 隨時建場 = 業務加速器）
2. admin schema 過度設計（目前 < 5 admin）
3. scenarios.ts 重構風險可控（W16 D1-D2 兩天投入）
4. 留 D4 D5 給進階 LINE + Phase 5 規劃，平衡近期與長期
5. 環境變數方案可再撐 6 個月（admin 數成長慢）

### W16 五天細節

| 天 | 主題 | 範圍 |
|----|------|------|
| D1 | scenario-instantiator-line 擴充 | 支援所有 components（host + multi + solo + shared）|
| D2 | LINE reply 多元件範本 | 多 hostUrl 的訊息排版 + truncate 邏輯 |
| D3 | LINE 進階互動 | sticker reply / image / quick reply buttons |
| D4 | 排程推播（cron） | 活動前 1 小時 reminder / 活動結束摘要 |
| D5 | Phase 4 收尾 + Phase 5 規劃 | 完整 retro + ADR-0012 Phase 5 方向 |

---

## 影響

### 程式碼對應

- `server/lib/scenario-instantiator-line.ts` 擴充（D1-D2）
- `server/lib/line-bot.ts` 加 sticker / image / quick reply（D3）
- `server/lib/line-pusher.ts` 加排程能力（D4）
- 新建 `docs/decisions/0012-phase5-direction.md`（D5）

### 紅線

- ✅ 不動 admin schema（保持環境變數方案）
- ✅ Schema 只新增不刪除（W16 不變動 schema）
- ✅ 保持 admin endpoint 向後相容

### 已知限制

- LINE 訊息長度上限 5000 字、多元件需 truncate
- LINE 免費方案每月 1000 則訊息上限（W16 D4 排程推播需注意）
- admin 環境變數方案在 admin > 10 時需重做（預計 6+ 個月後）

---

## 後續可能變動

什麼情境會讓我們重新評估？
- admin 數量超過 10 → 評估 admin schema
- 客戶回饋多元件 reply 體驗不佳 → 改用 LIFF page 統一管理
- LINE 訊息額度耗盡 → 改用 rich menu / push 替代
- Phase 5 國際化 → 改用通用 messaging 抽象（取代 LINE-only）

---

## 相關文件

- [W15 D5 admin instantiate](../changes/2026-05-03-phase4-w15-d5-admin-instantiate.md)
- [ADR-0010 LINE Bot 整合](0010-line-bot-integration.md)
- [ADR-0009 Phase 4 方向](0009-phase4-direction.md)
