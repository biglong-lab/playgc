# 大螢幕互動工具的歸屬：CHITO（game.homi.cc）vs PhotoGo（photogo.aihomi.cc）— 分析報告 2026-09-25

> ⚠️ **結論已被取代**：業主補充驅動力是「穩定度」而非定位，並提供使用者反饋「HostScreen 無法順利使用」。
> 以穩定度為準的完整評估見 [2026-09-25-hostscreen-stability-evaluation.md](2026-09-25-hostscreen-stability-evaluation.md)，
> 其結論改為「CHITO 退出大螢幕互動、PhotoGo 接手（先補到現場等級）」。本文保留作為現況對照與定位論述。
>
> 類型：分析與建議／狀態：**已被取代（2026-09-25 同日）**／部署：無
> 業主提問：「`/showcase` 這個大螢幕遊戲互動工具，要不要拆到 PhotoGo（廣告機、拍照機）服務？讓 CHITO 更精準，還是整合在一起不影響、或對銷售有幫助？」
> 依據：兩個專案的程式碼實查（2026-09-25）；PhotoGo 在 `/Users/hung-macmini/projects/互動`

## 結論先講

1. **`/showcase` 不是工具，是純前端的業務展示頁**（1,716 行、0 後端、不連網、不登入）。真正的大螢幕互動執行環境是 **HostScreen**（`/host/:id` 大螢幕 + `/play/:id` 手機，ADR-0004 定為「第三軸」）。
2. **「拆解」其實已經發生了**：PhotoGo 的「互動大螢幕」模組（21 種玩法、8 個情境、手機免登入掃碼、大場 300 人限流）就是從 CHITO 的 `components/game/host/` 搬過去改寫的。現在的真實問題不是「要不要拆」，而是**兩份拷貝沒有主從、會各自長**。
3. **建議：產品定位分開、程式碼不合併、互動玩法以 PhotoGo 為正本。** CHITO 只保留跟場域遊戲流程綁在一起的大螢幕（現場計分板、主持人帶隊流程），`/showcase` 拆成兩半。這樣 CHITO 的故事變精準（「讓場域可以玩」），PhotoGo 的故事也精準（「讓螢幕會互動」），而且一個經銷代碼可以賣兩邊。

## 現況對照（實查）

| 項目 | CHITO HostScreen | PhotoGo 互動大螢幕 |
|---|---|---|
| 定位 | 遊戲平台的第三軸（solo / multi / host） | 獨立產品模組（與看板、拍照機並列） |
| 玩法數 | 17 個 host 元件（配 51 個玩家端元件） | 21 種玩法 + 8 情境模板（投票、搶答、抽獎、賓果、紅包雨、拔河、祝福牆、詞雲、自拍牆…） |
| 進入方式 | `/host/:id?token=`（12 小時）；手機 `/play/:id` 匿名 | 播放器 PWA 6 碼配對；手機 `/m/interactive/:token` 免登入、**免 JavaScript** |
| 狀態權威 | **大螢幕的瀏覽器**；server 只在記憶體快取最後一份 | **server**（HTTP 為準，WS 只「提醒來拿」） |
| 裝置管理 | 無（ADR-0004 寫「一場域一 session」但**程式沒強制**） | screens 配對、60 秒心跳、離線告警、遠端指令、本機代理程式（印表機、看門狗） |
| 多租戶 | fieldId 只在後台建場時擋權限；大螢幕與手機兩端不看場域 | `tenant_id` 列級隔離 + 守護測試 |
| 方案 / 計費 | 走 CHITO 4 方案；host 不是可開關模組 | plans + 訂閱 + Recur / TapPay（線上付款尚未開通） |
| 經銷 | 尚未（本日另有規劃） | partner 積木已上線（負責人 / 業務、開客戶配額、託管機台） |
| 離線 | 無 | 看板離線輪播、拍照機先印後傳 |
| 規模 | 前端 ~7.3k 行 + 後端 ~0.5k 行；17 個元件測試、2 支 e2e、**0 個後端測試** | 全專案 ~87k 行、~200 測試檔、52 支 e2e |
| 已知缺口 | > 500 人要 Redis；一場域一 session 未強制；共用全域 WS context 出過 bug | 線上付款未開；主機 2GB 吃緊（swap 1.26GB）；拍照牆無相機 |
| 兩者共用 | **零執行期共用**：不同主機、不同 DB、不同 Firebase 專案；只有「技術棧一樣、元件曾一次性搬移」 | |

`/showcase` 的耦合：只 import host / multi 元件與 `scenario-templates`（純靜態）；被 Pricing、PitchDeck、Faq、FieldEntry、TemplateMarket 以**連結**引用，沒有程式碼依賴。

## 三個選項

| 選項 | 做法 | 優 | 缺 |
|---|---|---|---|
| A 全部搬去 PhotoGo | CHITO 移除 HostScreen；情境模板、LINE 建場、v1 API、編輯器 host_* 全改成呼叫 PhotoGo API | 一份程式碼；CHITO 最純 | 跨主機、跨 Firebase 的硬依賴；場域現場計分板這種跟 game session 綁死的畫面變成跨系統呼叫；估 10–15 天，會打斷經銷（P3）；PhotoGo 主機記憶體先要升級 |
| B 維持現狀 | 兩邊各自長 | 零工 | 玩法漂移（同一種玩法兩邊各修各的）；業務講不清楚差在哪；重工 |
| **C 定位分工 + 正本制（建議）** | 產品：CHITO = 場域遊戲，PhotoGo = 螢幕互動。程式：互動玩法正本在 PhotoGo，CHITO 的 `host/` 凍結為「場域流程配套」。銷售：互相導流、經銷同碼賣兩邊 | 工期最小（3–4 天）；兩產品故事都精準；不動已上線客戶 | 短期仍是兩份拷貝（用凍結 + 守護控制）；客戶兩產品都用時要兩個帳號 |

## 建議 C 的具體動作（可分批、每批可獨立部署）

| # | 動作 | 內容 | 天 |
|---|---|---|---|
| 1 | 拆 `/showcase` | 互動 demo 段（`InteractiveDemo`、`W22DemoSection`，517 行）改成「更多互動玩法 → PhotoGo」連結區（或搬去 PhotoGo 產品頁）；CHITO 留協作 demo（`CoopDemo`：拼圖 / 尋寶 / GPS 接力 / 集體計分 / 角色分配）與情境反查 | 0.5 |
| 2 | 導航與文案 | 後台「主控大螢幕」改名「活動現場大螢幕」，說明加「更多互動玩法在 PhotoGo」；Pricing / Pitch / Faq 對應改 | 0.5 |
| 3 | 凍結宣告 | `host/README.md` 加「正本在 PhotoGo、CHITO 只修不加」；守護測試鎖 `host_*` 元件數 = 17（只減不增，同 confirm/prompt 棘輪） | 0.5 |
| 4 | 模組化 | `module-registry` 加 `host` 模組（menu `/admin/host-sessions`、API `/api/admin/host-sessions` `/api/host-sessions` `/api/trivia`），預設開；方案功能鍵加 `host_screen` → 沒買的場域看不到、打 API 403 | 1 |
| 5 | 補洞 | 實作「一場域同時一個 host session」（ADR-0004 寫了沒做）；補 host-sessions API 與 WS 三種訊息的後端測試 | 1–2 |
| 6 | 經銷對齊（併入 P3） | 兩產品共用同一個經銷代碼；表結構與角色對齊 PhotoGo partner 積木；對帳單同格式 | 0（P3 內） |

之後的觸發條件（不是現在做）：
- 同一玩法兩邊都要改 ≥ 3 次 → 再評估抽共用套件（同 repo 內封閉發行，不上 npm）
- CHITO 客戶要 > 500 人大場 → 直接用 PhotoGo 互動（server 權威、已做限流），不替 CHITO 加 Redis

## 對銷售的影響

- **一句話講法**：「CHITO 讓場域可以玩；PhotoGo 讓螢幕會互動。」
- **客戶分流**：民宿 / 街區 / 觀光工廠 / 場域經營（要預約、POS、對戰、GPS）→ CHITO；活動公司 / 婚宴 / 尾牙 / 展場 / 店面看板 / 拍照機 → PhotoGo；場域辦活動日 → 套餐（CHITO 訂閱 + PhotoGo 活動短租）。
- **經銷**：同一家經銷、同一個代碼可以賣兩邊；分潤各自算、對帳單同格式；區域專屬規則兩邊一致。
- **不影響現有客戶**：賈村現在用的活動現場大螢幕照舊。

## 風險

| 風險 | 處理 |
|---|---|
| 客戶兩產品都用時要兩個帳號（不同 Firebase） | 短期接受；長期可評估 SSO，不在本批 |
| PhotoGo 主機 2GB，導流客戶進來會更吃緊 | 導流前先升級（PhotoGo ADR-0004 已設 1.5GB 門檻） |
| PhotoGo 線上付款未開通 | 導流客戶先人工帳單，同 CHITO P7 前做法 |
| 兩份拷貝在凍結前又長出新玩法 | 動作 3 的守護測試擋住 |

## 需業主決定

| 事項 | 選項 | 建議 |
|---|---|---|
| 採哪個選項 | A / B / C | **C** |
| `/showcase` 互動段 | 改連結到 PhotoGo（最省）／整段搬去 PhotoGo 產品頁 | 先改連結 |
| CHITO 的大螢幕要不要變成可購買模組 | 是（`host` 模組 + `host_screen` 功能鍵）／否 | 是 |
| 經銷分帳預設 | CHITO 50%（業主 09-25 指示）vs PhotoGo 訂閱 20% / 營運 30%（PhotoGo ADR-0011）→ 統一／各自 | **統一一套政策**（「收費方式一致」），數字由業主定 |

## 相關

- CHITO：[ADR-0004 host-screen-axis](../decisions/0004-host-screen-axis.md)、[domains/host-screen-components.md](../domains/host-screen-components.md)、[changes/2026-06-19-showcase-interactive-demos.md](2026-06-19-showcase-interactive-demos.md)
- PhotoGo（`/projects/互動`）：`docs/domains/interactive.md`、`docs/domains/partners.md`、`docs/decisions/0011-partner-tier.md`、`docs/changes/2026-09-25-business-loop.md`
- 本日經銷規劃：[2026-09-25-partner-territory-revenue-share.md](2026-09-25-partner-territory-revenue-share.md)
