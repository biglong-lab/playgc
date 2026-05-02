# ADR-0009: Phase 4 方向

> 日期：2026-05-03
> 狀態：採用中（Phase 4 啟動規劃）
> 影響：Phase 4 工作的優先序

---

## 背景

Phase 1+2+3 累計成果（2026-04-19 起算）：
- 41+ 元件（HostScreen 10/10、Multi 13/13、Solo 18+）
- 12 情境模板 + 一鍵建場 + QR 列印
- AI 內容生成（DeepSeek）
- 付費（Recur.tw 主路徑、Stripe fallback）
- 信件（Resend）
- 用量配額追蹤
- Public API v1（含 SDK + Webhook）
- 完整 onboarding 文件（客戶 + 代理商）
- Smoke test 自動化（40/40）

**目前狀態**：技術後援已完整、業務變現待客戶啟動。

**Phase 4 核心問題**：
- 第一批真實付費客戶在哪？
- 已建好的工具如何最大化使用？
- 哪些技術投入能放大商業效果？

---

## 候選方向評估

### 選項 A：真實付費客戶 + 案例累積（業務優先）

**內容**：
- 找 5-10 個真實付費客戶（婚禮 / 破冰 / 內訓）
- 每場活動寫案例文章
- 收集照片 / 影片素材給 PitchDeck

**優點**：
- 立即驗證 PMF
- 案例 = 銷售工具
- 真實反饋驅動產品改善

**缺點**：
- 業務人力成本（找客戶 / 跑活動）
- 需要時間（4-8 週）
- 不是純技術工作

---

### 選項 B：LINE LIFF 整合（玩家不離開 LINE）

**內容**：
- 玩家用 LINE 開啟 game URL → LIFF（LINE Frontend Framework）
- 不需開瀏覽器、不需重複註冊
- LINE Bot 可推播活動結束通知

**優點**：
- 台灣覆蓋率最高的入口
- 玩家門檻最低
- LINE Bot 可雙向溝通（玩家輸入 → 遊戲反應）

**缺點**：
- 需 LINE Channel + Login（申請流程）
- 不是所有元件適合 LINE（host 主控大螢幕仍要瀏覽器）
- 開發複雜度高（LIFF SDK + Bot Framework）

---

### 選項 C：多語系 / 國際化

**內容**：
- 英 / 日 / 簡體中文版
- 觀光客場域（金門、台南、台北 101）國際化
- 公開頁 SEO 多語

**優點**：
- 拓展觀光客市場（金門近年陸客 / 日韓自由行回流）
- 一次翻譯永久受用

**缺點**：
- 翻譯人力成本
- 不直接變現（要等國際客戶上門）
- 維護成本（每改一段話要翻譯 4 次）

---

### 選項 D：AI 影像生成（情境 demo 影片）

**內容**：
- 用 AI 為每個情境生成 30 秒 demo 影片
- 用於 PitchDeck / TemplateMarket / 社群行銷
- DALL-E / Midjourney + 影片合成工具

**優點**：
- 視覺化銷售大幅提升
- 業務帶看時更有說服力
- 公開頁 SEO 加分

**缺點**：
- AI 影片技術仍不穩定（人臉 / 文字常出錯）
- 12 情境 × 30 秒 = 6 分鐘影片成本
- 不是核心商業變現

---

### 選項 E：進階分析儀表板

**內容**：
- 完成率 / 留言情緒分析（NLP）
- 客戶 LTV（Lifetime Value）
- 場次 ROI 計算
- 配合 Recur.tw / 付費資料整合

**優點**：
- admin 看數據做決策
- 業務報告自動化（每月寄客戶 / 代理商）
- 數據驅動產品改善

**缺點**：
- 需要累積足夠資料（至少 50 場活動）
- 開發複雜（chart / NLP / 資料 pipeline）
- W12 dashboard 已有基礎、進階版優先級不高

---

### 選項 F：API key DB 表 + admin UI

**內容**：
- 取代 W11/W12 的環境變數方式
- 加 `api_keys` 表（含 metadata / quota / fieldId / webhookUrl）
- admin UI 自助發放 / 撤銷 / 查用量

**優點**：
- 代理商規模擴大時必要
- admin 不用每次改環境變數重啟
- 自助管理（reduce friction）

**缺點**：
- 代理商 < 5 個前過早優化
- 需要 schema 變更
- 不直接變現

---

### 選項 G：手機端 PWA 強化

**內容**：
- 玩家手機端離線可用（PWA + Service Worker）
- 推播通知（PWA Push）
- 主畫面 icon

**優點**：
- 玩家體驗大幅提升
- 不依賴網路也能玩部分元件
- 推播 = 二次接觸機會

**缺點**：
- iOS PWA 限制多（推播 iOS 16.4+ 才支援）
- Service Worker 開發複雜
- 對「現場活動」不一定必要（現場通常有 Wi-Fi）

---

## 決定

**主軸**：選項 A（真實付費客戶）+ 選項 B（LINE LIFF）

### Phase 4 W13-W16 路徑

| 週 | 主軸 | 重點 |
|----|------|------|
| W13 | 真實客戶（業務 + 反饋）| 找 1-2 個婚禮 + 1-2 個破冰、跑活動、寫案例 |
| W14 | LINE LIFF MVP | 玩家 LINE 入口 + LIFF 整合 |
| W15 | LINE Bot 推播 | 活動結束通知 + 報名管理 |
| W16 | Phase 4 收尾 + Phase 5 規劃 | 案例彙整 + ROI 分析 |

### 暫緩

- **選項 C（多語系）**：等 W13 反饋確認需求
- **選項 D（AI 影像）**：等成功案例累積後再做（用真實素材）
- **選項 E（進階分析）**：等資料量足
- **選項 F（API key DB）**：代理商規模 > 5 才做
- **選項 G（PWA 強化）**：先驗證 LINE LIFF 體驗再決定

---

## 理由（≤ 5 點）

1. **驗證 PMF 優先**：技術後援已超完整、現在最缺真實客戶反饋

2. **A + B 互補**：A 是業務（人力）、B 是技術（程式）— 可平行推進

3. **LINE 是台灣最大入口**：玩家 99% 都裝 LINE、降低進入門檻最直接

4. **暫緩 C-G 的共通理由**：都需要更多資料 / 客戶 / 案例後再做

5. **W16 收尾留 review 空間**：依 W13-W15 反饋決定 Phase 5 方向

---

## 影響

### 程式碼面
- W13：依客戶反饋微調（情境 default config / AI prompt / UI 文字）
- W14：新增 `client/src/pages/PlayLiff.tsx`、LINE Channel 申請
- W15：`server/lib/line-bot.ts` 整合
- W16：Phase 4 整體收尾

### 紅線
- LINE Bot 不洩漏 hostToken / 玩家敏感資料
- 真實客戶反饋優先於技術完美主義
- 案例素材必須有客戶授權

### 已知限制
- LINE LIFF 需要 SSL（已有）+ HTTPS subdomain（可能需要新 cert）
- W13 業務反饋週期不可控（取決客戶活動排程）
- 國際客戶（如有）會被推遲到 Phase 5+

---

## 後續可能變動

- 若 W13 找客戶超快 → 提早 W14、把更多時間給 W15-W16
- 若 LINE LIFF 體驗好 → 全平台主推 LINE 入口、暫緩 PWA 強化
- 若代理商 W12-W13 突然超過 5 個 → 提早做選項 F

---

## 相關文件

- [Phase 3 完整收尾](../changes/2026-05-03-phase3-complete.md)
- [Phase 3 主規劃](../changes/2026-05-02-phase3-plan.md)
- [代理商 onboarding](../runbooks/agency-onboarding.md)
- [客戶 onboarding](../runbooks/customer-onboarding.md)
