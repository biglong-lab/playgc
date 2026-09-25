# ADR-0029: 大螢幕互動（HostScreen 軸線）移交 PhotoGo，CHITO 完整移除

> 日期：2026-09-25
> 狀態：✅ 採用中（取代 [ADR-0004](0004-host-screen-axis.md)）
> 影響：客戶端 host 軸整條（17 個元件、3 個頁面、編輯器分類）、WebSocket 三種訊息、情境模板（13 → 7）、LINE 建場、代理商 API、後台選單與模組登錄表；資料表不動

## 背景

使用者反饋「大螢幕互動（/host + /play）無法順利使用」。2026-09-25 逐項查證（[完整評估](../changes/2026-09-25-hostscreen-stability-evaluation.md)）：

- 架構性不可靠：狀態唯一來源是大螢幕的瀏覽器、server 只有記憶體快取（重啟、重整、閒置 30 分鐘歸零）；所有失敗不顯示；限流每秒 10 則靜默丟包；多人同時點擊掉票；Trivia 契約壞了 4 個月；token 12 小時硬過期不能續
- 生產從沒有真實觀眾用過：18 場全內部測試、6 月起全部 abandoned、`trivia_answers` 0 筆、觀測管線對 host 全盲
- 另一產品 PhotoGo（photogo.aihomi.cc）已有同源改寫的互動模組：狀態每筆落 Postgres、大螢幕只讀、手機免 JS、8 個情境正好涵蓋 CHITO 的 6 個純大螢幕情境

## 選項

| 方案 | 優點 | 缺點 |
|---|---|---|
| A 修 CHITO HostScreen（換成 server 權威） | 一站式 | 12–16 天，做完 = PhotoGo 現在的架構；兩套並存各自維護；CHITO 失焦 |
| B 只藏起來（模組預設關） | 1 天、可逆 | 程式碼與 13 個情境模板仍纏著 host，維護負擔不減；業務講不清楚 |
| **C 完整移除，PhotoGo 接手** | 一套、在對的地方；CHITO 專注場域；6 個熱場情境 PhotoGo 已有 | 3–4 天清除；CHITO 模板市集少 6 個社交 / 熱場情境（轉為 PhotoGo 業務） |

## 決定

採 **C**。業主原話：「把功能完整的移動到 PhotoGo，CHITO 就清乾淨，大螢幕遊戲都沒有再用，所以不用擔心會有問題。」

1. CHITO 移除整條 host 軸：元件、頁面、路由、WS 訊息、編輯器分類、情境模板的 host 元件、LINE / 代理商 API 的 host 建場、後台入口、`host` 模組登錄
2. **資料表不動**：`game_sessions.host_mode / host_token / host_token_expires_at` 與 `trivia_answers` 保留（表只加不刪），schema 加「已停用」註解
3. 守護測試鎖住：全專案不得再出現 `host_` pageType、`/host` 路由、`hostMode: true` 寫入、`host_screen` WS 訊息
4. PhotoGo 先補到現場等級（限流、壓測、獨立主機、告警、免配對大螢幕網址）並跑過一場真實活動，才對外賣；功能對等項（排行榜、隊伍自訂、搶答多題、進度任務、場域地圖打卡）依需求補

## 影響

- 程式碼：見 [changes/2026-09-25-host-removal-photogo-migration.md](../changes/2026-09-25-host-removal-photogo-migration.md) R1–R5
- 商業情境：#2 私部門活動、#3 活動、#5 交誼破冰的「大螢幕熱場」轉為 PhotoGo 業務；CHITO 保留 #1 公部門、#4 空間活化與企業內訓的手機協作
- 講法：「CHITO 讓場域可以玩；PhotoGo 讓螢幕會互動」
- 紅線：CHITO 不再新增任何「大螢幕 + 手機」類元件；有此需求一律做在 PhotoGo

## 後續可能變動

- 若 CHITO 客戶要「一鍵從 CHITO 開一場 PhotoGo 互動」且 ≥ 3 個客戶提出 → 在 PhotoGo 做對外 API，CHITO 只放連結
- 場域地圖打卡（KnowledgeMap）若場域客戶需要，在 CHITO 做成一般玩家頁（非大螢幕），不違反本 ADR

## 相關文件

- 取代：[ADR-0004 HostScreen 第三軸線](0004-host-screen-axis.md)
- 評估：[changes/2026-09-25-hostscreen-stability-evaluation.md](../changes/2026-09-25-hostscreen-stability-evaluation.md)
- 執行：[changes/2026-09-25-host-removal-photogo-migration.md](../changes/2026-09-25-host-removal-photogo-migration.md)
- 歷史：[archive/host-screen-components.md](../archive/host-screen-components.md)、[archive/host-multi-pairing.md](../archive/host-multi-pairing.md)
