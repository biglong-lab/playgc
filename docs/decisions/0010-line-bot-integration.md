# ADR-0010: LINE Bot 整合策略

> 日期：2026-05-03
> 狀態：採用中（Phase 4 W15 啟動規劃）
> 影響：W15 全部工作 + 後續活動推播

---

## 背景

Phase 4 W14 完成 LIFF（玩家從 LINE 進入遊戲）。
W15 主軸：LINE Bot — 雙向溝通（CHITO ↔ 玩家 / admin）。

LIFF vs Bot 差異：
- LIFF：玩家點連結進入網頁（單向、玩家驅動）
- Bot：CHITO 主動發訊息 / 接收文字（雙向）

W15 要解決的問題：
- 活動結束後客戶 / 玩家如何收到通知？
- admin 是否可以用「@chito 婚禮」一句話建場？
- 玩家是否可以用 Bot 報名？

---

## 候選功能

### 功能 A：活動推播（admin → 玩家）

**內容**：
- 活動建立後 24h 推播玩家：「您的活動連結已到」
- 活動前 1h 提醒：「活動即將開始」
- 活動結束後寄回顧：「您的拍立得 / 留言已存好」

**優點**：
- 接觸玩家最直接
- 提升轉換率（從建場 → 真實參與）
- 活動後素材回收（評論 / 推薦）

**缺點**：
- 需取得玩家 LINE userId（W14 LIFF 已有）
- 推播 cost（LINE Messaging API 1000 訊息/月免費）

### 功能 B：admin 文字建場（admin → CHITO Bot）

**內容**：
- admin 在 LINE 對 Bot 說「@chito 婚禮 Hung & Anita 5/15」
- Bot 回應：「✅ 已建場、QR 連結 ...」
- 不需開瀏覽器、不需登入後台

**優點**：
- admin 體驗極佳（手機就能建場）
- 適合活動現場臨時加場
- 業務帶看時即時 demo

**缺點**：
- Bot 需 NLU 解析自然語言（DeepSeek 已整合）
- 安全：admin 認證 → 用 LINE userId 對應 admin 帳號（要建表）

### 功能 C：玩家報名（玩家 → CHITO Bot）

**內容**：
- 玩家對 Bot 說「報名 Hung Anita 婚禮」
- Bot 確認 + 給玩家 LIFF 連結

**優點**：
- 玩家不用記網址
- 報名流程順暢

**缺點**：
- 真實需求不確定（玩家通常從邀請函拿連結）
- 需建報名 / 名單功能（額外 schema）

### 功能 D：客服 / 詢問（玩家 → CHITO）

**內容**：
- 玩家對 Bot 問「我可以怎麼玩？」
- Bot 回答 + 提供連結

**優點**：
- 24/7 自動客服
- 降低 admin 客訴負擔

**缺點**：
- 需要 NLU + 知識庫
- 投入多、產出短期不明顯

### 功能 E：CRM / 數據蒐集

**內容**：
- 自動加好友 → 收集 LINE userId
- 後續寄行銷訊息（節慶優惠 / 新情境上線）

**優點**：
- 建立長期客戶關係
- 行銷 retention 通路

**缺點**：
- LINE 訊息免費上限低（1000/月）
- 用戶易封鎖

---

## 決定

**主軸**：功能 A（活動推播）+ 功能 B（admin 文字建場）

### W15 路徑

| 日 | 重點 |
|----|------|
| W15 D1 | LINE Bot scaffold（Webhook receiver + signing 驗證 + reply）|
| W15 D2 | 推播：activity reminder（24h / 1h 前）|
| W15 D3 | admin 文字建場（NLU → DeepSeek 解析 → instantiate）|
| W15 D4 | 活動後推播 + 回顧連結 |
| W15 D5 | W15 收尾 + W16 規劃 |

### 暫緩

- **功能 C（玩家報名）**：W14 LIFF 已是低門檻入口、Bot 報名重複工
- **功能 D（客服 NLU）**：投入大、優先做核心 use case
- **功能 E（CRM 行銷）**：留 Phase 5+、等客戶量足夠

---

## 理由（≤ 5 點）

1. **接觸玩家最直接**：活動推播是「玩家為什麼下次要再用 CHITO」的關鍵

2. **admin 文字建場放大商業效果**：手機即建場 → admin 好用 → 推薦增加

3. **避免過度工程**：客服 NLU / CRM 等 Phase 5+ 再做

4. **複用既有基礎**：DeepSeek（W9 D1）+ Resend（W10 D5）+ Webhook（W12 D3）

5. **LINE 訊息成本可控**：核心通知用 push（免費內）、行銷類延後

---

## 影響

### 程式碼面
- W15 D1：`server/lib/line-bot.ts` Webhook + reply
- W15 D2：`server/lib/line-pusher.ts` 推播 + 排程整合
- W15 D3：`server/lib/admin-nlu.ts` DeepSeek 解析 admin 指令
- W15 D4：activity-end 推播鉤子（從 host_session 完成事件）

### 紅線
- LINE Bot signature 必須驗證（避免假請求）
- admin 認證：LINE userId 對應 admin 帳號表（W15 D3 加 schema）
- 推播訊息含一次性 token URL（不直接放 hostUrl）

### 已知限制
- LINE Messaging API 免費 1000 訊息/月（W15-W16 階段夠用）
- LIFF / Bot 共用同一個 LINE Channel（admin 申請流程）
- 推播失敗無 retry 機制（W15 D5 補）

---

## 後續可能變動

- 若推播 1000 訊息/月不夠 → 升級 Standard（NT$ 20,000/月、150K 訊息）
- 若 admin 文字建場使用率低 → 取消、留 W14 LIFF 即可
- 若客服詢問量大 → 加 NLU + 知識庫（W17+）

---

## 相關文件

- [W14 完整收尾](../changes/2026-05-03-phase4-w14-complete.md)
- [ADR-0009 Phase 4 方向](0009-phase4-direction.md)
- [LINE Messaging API 文件](https://developers.line.biz/en/docs/messaging-api/)
- [LINE Webhook 文件](https://developers.line.biz/en/reference/messaging-api/#webhooks)
