# 大螢幕互動（HostScreen）穩定度評估與去留建議 — 2026-09-25

> 類型：完整評估／狀態：**待業主決定**／部署：無
> 業主補充：「主要是功能與系統穩定度。HostScreen（/host + /play）使用者反饋無法順利使用，才有拆到 PhotoGo 的規劃；CHITO 專注在場域管理、預約、遊戲。」
> 取代：[2026-09-25-showcase-photogo-positioning.md](2026-09-25-showcase-photogo-positioning.md) 的結論（該文以定位為出發點；本文以穩定度為出發點，結論不同）
> 依據：兩專案程式碼逐項查證（file:line 在附錄）＋ 兩邊生產資料庫實查

## 結論先講

1. **HostScreen 不是「有幾個 bug」，是架構性的不可靠**：大螢幕的瀏覽器是唯一狀態來源、server 只有記憶體快取、所有失敗都不顯示。修到能在現場放心用，要換成 server 持有狀態 —— 那正是 PhotoGo 已經做好的。
2. **生產證據：HostScreen 從來沒有被真實觀眾用過**。上線至今 18 場全是內部測試，6 月起 10 場全部 abandoned、沒有一場完成；觀測管線對 host 模式是盲的（5 份場次報告全 0）。
3. **PhotoGo 互動模組結構正確（狀態進 Postgres、大螢幕只讀、手機免 JS），但也是 0 真實使用、沒壓測、有一條會在現場被打爆的限流、主機是 2GB 共用機**。它是對的起點，不是現成的終點。
4. **建議：CHITO 退出大螢幕互動（止血、下架、不再投資修），PhotoGo 接手，但先花 5–7 天把 PhotoGo 補到「現場可用」再導客戶過去**。場域地圖打卡（KnowledgeMap）這種本質是場域功能的，留在 CHITO 當一般玩家頁。

## 一、生產證據（2026-09-25 實查）

### CHITO（game.homi.cc）

| 指標 | 數字 | 解讀 |
|---|---|---|
| host 場次總數（上線至今） | **18** | 全部是內部測試遊戲（`activities test`、`活動TEST｜全元件示範流程`、生日派對情境包試開、`刪除`） |
| 2026-05 | 8 場，7 完成 | 開發期自測 |
| 2026-06 ～ 08 | **10 場，0 完成，全部 abandoned** | 其中 9 場在 08-06 被「清理超時場次」批次標掉；1 場到今天還卡在 playing |
| 每場 `player_count` | 恆為 1 | 手機參與者從不進 DB，人數統計對 host 無效 |
| `trivia_answers` | **0 筆** | 小問答從沒有人成功作答過 |
| host 場次的 `session_reports` | 5 份，**全部欄位為 0** | 觀測管線看不到 host 模式的連線、延遲、斷線 |
| `audit_logs` 含 host 的動作 | 0 | 建場、結束都不進稽核 |
| 對照：一般遊戲場次近 30 天 | 57 場、完成率 100%、平均異常斷線 0.07 | **平台 WS 本身是健康的，問題在 host 這一軸** |

### PhotoGo（photogo.aihomi.cc）

| 指標 | 數字 | 解讀 |
|---|---|---|
| 互動場次 / 參與 / 投票 / 抽獎 … 12 張 `interactive_*` 表 | **全部 0** | 2026-09-19 上線至今沒有真實活動 |
| 租戶 / 螢幕 / 經銷 | 1 / 1 / 0 | 上線清單自己寫「還沒有任何螢幕」 |
| 主機 | 2GB 共用機，跑 8 個容器（含 browserless Chrome、election、temple、rsshub） | 可用記憶體 690MB；app 上限 350MB；文件寫 < 300MB 要升級 |
| 近 7 天 app 錯誤 | 0 | 因為沒人在用 |
| 線上付款 / Telegram 告警 | 未開通 / 未接 | 現場出事沒人會收到通知 |

## 二、HostScreen 為什麼「無法順利使用」（逐項查證，高嚴重度）

| # | 失敗模式 | 使用者看到 | 證據（file:line） | 修法 |
|---|---|---|---|---|
| 1 | **所有失敗都看不見**：`connected` 只在收到 state 時才 true、`error` 設了永不清；17 個頁面容器沒有一個讀 `connected`/`error`；綠燈只看 HTTP 有沒有載入 | 燈是綠的、按了沒反應、投了沒進去 | `useHostScreenSync.ts:92-98,196-203`；`HostPlay.tsx:127,196`；`HostScreen.tsx:63,155`；2026-05-03 稽核列 P0 至今未修 | 小補丁 |
| 2 | **server 每連線每秒限 10 則、超過靜默丟棄**；大螢幕每收到一個點擊就送一次完整狀態 → 30 人同時投票時大螢幕的廣播被丟 | 手機數字不動、晚加入者拿到舊狀態 | `websocket.ts:379-385`（「silent drop」）；`useHostScreenSync.ts:212-218` | 中：節流合併 + host 連線放寬限流 |
| 3 | **多人同時點會掉票**：`stateRef` 只在 render 時更新，連續 pulse 在 re-render 前抵達時 `onPulse` 讀到舊值 | 票數少於實際人數 | `useHostScreenSync.ts:159-160,207-211` | 中：改 functional reducer |
| 4 | **狀態只在瀏覽器與記憶體**：server 重啟／部署／大螢幕重整／閒置 30 分鐘 → 歸零；大螢幕重連後不重送狀態；除 Trivia 外零落 DB | 投票數、詞雲、祝福牆全部歸零 | `websocket.ts:84,118（註解「server 重啟會 reset（接受限制）」）,140-184,773-781`；`useHostScreenSync.ts:70-83` | **換架構**（server 權威、狀態進 DB） |
| 5 | **手機斷線時點擊靜默遺失，畫面卻顯示已送出**；無重試、無 HTTP 備援、無輪詢 | 手機顯示已投票、大螢幕沒加 | `PollLive.tsx:191`；`useHostScreenSync.ts:233-238`；`WebSocketContext.tsx:480-491` | 中 |
| 6 | **token 12 小時硬過期、不能續期**；過期只在重新 register 時檢查、錯誤不顯示；已連線的不踢 → 跨 12 小時的活動任何一次網路抖動後就靜默停住 | 綠燈、沒反應、沒提示 | `websocket.ts:740-745`；`host-sessions.ts` 無續期端點、`:226-237` GET 不驗過期 | 小補丁 |
| 7 | **小問答（Trivia）第一個人答完就壞**：server 只廣播 `{scores, answered}`，client 整份覆蓋 → `currentQuestionIdx`/`status` 變 undefined，顯示「尚未設定題目」、下一題算出 NaN；匿名玩家作答走 WS 分支但大螢幕用的 hook 不收 → 作答全部遺失 | 畫面壞掉、沒人的答案被記到 | `admin-trivia.ts:33-60`（`SessionTriviaState` 只有兩欄）、`:126-131`；`TriviaShowdown.tsx:122-124,189-194`；`TriviaShowdownPage.tsx:50,87` | 小補丁（但已壞 4 個月，`trivia_answers` 0 筆） |
| 8 | **場次生命週期無守衛**：一場域一 session 沒強制（ADR-0004 寫了沒做）→ 兩台大螢幕各算各的、手機畫面在兩份狀態間跳；後台「清理超時場次」會把進行中的 host 場次標 abandoned（就是 08-06 那 9 場）；結束場次不通知已連線端 | 兩台大螢幕數字不同；活動中突然 410「已結束」 | `host-sessions.ts:57-66`；`session-storage.ts:243-285`；`websocket.ts:750-753` | 小補丁 |
| 9 | **零可觀測**：host WS 路徑沒有任何 log；廣播不記 `ws_event_log`；client 無事件上報；session_reports 無 host 欄位；e2e 只測 /play 能載入、詞雲用假大螢幕；`useHostScreenSync` 無單元測試 | 出事後無法查證、無法重現 | `websocket.ts:1180-1194`；`observability.ts`；`e2e/host-*.spec.ts` | 中 |

歷史：2026-05-08 改全域 WebSocketProvider 時文件自述「未經真實 e2e」；**5/8 ～ 6/16 之間 host 互動完全連不上 WS**（`2026-06-16-host-screen-ws-fix.md`）；Trivia 契約壞掉是 5/8 Phase 4 引入的。這一軸從建立起就沒有過穩定的月份。

**修 CHITO HostScreen 的成本**：#1、#6、#7、#8 小補丁 + #2、#3、#5、#9 中度 ≈ **4–6 天**可到「現場勉強能用」；但 #4 不換架構就永遠「重啟歸零、重整歸零」，換成 server 權威 + 狀態進 DB ≈ **再 8–10 天**。合計 12–16 天，做完得到的是 PhotoGo 已經有的東西。

## 三、PhotoGo 互動模組：結構對，但還沒到現場等級

### 結構對比

| 面向 | CHITO HostScreen | PhotoGo 互動 |
|---|---|---|
| 狀態權威 | 大螢幕瀏覽器 | **server Postgres**，大螢幕只讀（`device.ts:3`） |
| 持久化 | 記憶體快取，重啟／重整／30 分鐘閒置歸零 | **每筆作答即時落 DB**（12 張表），重啟、部署、換機不丟 |
| 大螢幕連線 | 共用全域 WS，token 12 小時 | HTTP 輪詢 2.5s（進行中）/ 15s（待機），WS 只「提醒來拿」；每次重連換新票證、1–30s 退避 |
| 手機 | SPA + WS，斷線靜默丟 | **伺服器 HTML + 表單 + meta refresh，不需 JS**；斷一下下次送出就接上 |
| 主持人 | 後台 admin JWT 建場 | 免登入遙控連結（24h、SHA-256、可一鍵作廢）、按鈕帶版本防連按 |
| 換機 | 無 | 新機配對沿用 screen id、舊機立即失效 |
| 測試 | 17 個元件測試、2 支 e2e（假大螢幕）、0 後端測試 | 約 129 案例（30 個整合測試檔打真 DB）+ 25 條 e2e |
| 觀測 | 無 | 稽核有；**Telegram 未接、互動無告警** |

### PhotoGo 現場前必須補的（否則只是換一個地方壞）

| # | 問題 | 證據 | 估 |
|---|---|---|---|
| A | **同來源每活動 10 分鐘 800 次送出的限流**：情緒池／人浪／拔河／紅包雨每按一下一個 POST 且不合併 → 300 支手機在同一個 Wi-Fi NAT 後面連點，幾秒就用完，之後全部被擋。文件只寫了 6000/分那層，這層沒提 | `routes.ts:196-198,232`；`tap-script.ts:25`；`rain-script.ts:16` | 1 天：連點類改合併送出（每 250ms 一包）+ 限流依玩法 |
| B | **沒壓測**：文件假設 300 人、驗收「200 支手機延遲 < 1s」沒勾；每次大螢幕輪詢跑多個查詢、每按一下寫一次 DB | `interactive.md:208-213`；`scripts/` 無壓測工具 | 1–2 天：k6 打 300 併發 `/m/interactive` + 大螢幕 `/state`，看 DB 與 350MB 記憶體撐不撐 |
| C | **主機**：2GB 共用機跑 8 個容器，可用 690MB、app 上限 350MB、文件寫 < 300MB 要升級 | `docker-compose.prod.yml:44`；`overview.md:219`；實查 `free -m` | 0.5 天：升級或搬到獨立機（Linode 4GB） |
| D | **告警**：Telegram 未接；互動沒有任何通報事件（大螢幕離線、限流命中、DB 慢） | `go-live-checklist.md:17,118` | 1 天 |
| E | **大螢幕一定要配對裝置**：沒有「主持人用筆電開個網址投影」的模式 —— 這是 CHITO 使用者最常見的用法 | `routes.ts:310-312` | 1–2 天：有期限的大螢幕網址（沿用 host link 的做法） |
| F | 文件與程式不符：`overview.md:160`、`interactive.md:124` 寫「權威在大螢幕、記憶體房間」，程式其實是 server 權威 | — | 0.5 天：改文件（避免下一個人照文件改壞） |

合計 **5–7 天**。做完之後 PhotoGo 才是「現場等級」。

### 功能對照（CHITO 17 個 host 元件 → PhotoGo 21 種玩法）

- **PhotoGo 有對應（12）**：投票、搶答*、抽獎*、情緒池、祝福牆（含審核）、詞雲、簽名簿、拍立得牆*、人浪、聚眾簽到、跑馬燈*、賓果、拔河*、提問牆。（*＝形式不同，見附錄）
- **PhotoGo 獨有（7）**：紅包雨、猜價格、滿意度、預測押寶、是非淘汰賽、最佳合照票選、自拍投稿牆。
- **CHITO 有、PhotoGo 沒有（3 + 4 項形式差異）**：

| CHITO | 建議 | 估 |
|---|---|---|
| LiveLeaderboard 通用排行榜（主持人手動加減分） | PhotoGo 補 | 0.5–1 天 |
| ProgressQuest 全場進度 | PhotoGo 補（人浪目標值換畫面） | 0.5 天 |
| **KnowledgeMap 場域地圖打卡** | **留在 CHITO**，改成一般玩家頁（POI 打卡本質是場域功能，與 QR/GPS 任務同族，不需要大螢幕） | 1–2 天（CHITO 內） |
| TeamBattleScore 自由分組 + 主持人加分 | PhotoGo 拔河補自訂隊伍 | 1–2 天 |
| TriviaShowdown 單頁多題 + 即時前 3 | PhotoGo 搶答補「一活動多題」 | 1–2 天 |
| ScoreboardAnnouncement 公告類型 | PhotoGo 跑馬燈加 type | 0.5 天 |
| PolaroidCollage 手機文字卡 | PhotoGo 祝福牆換皮 | 0.5 天 |

## 四、三個選項（以穩定度為準）

| 選項 | 內容 | 到「現場可用」 | 之後 |
|---|---|---|---|
| A 修 CHITO HostScreen | 九項全修、換成 server 權威 | 12–16 天 | 兩套一樣的東西各自維護；CHITO 失焦 |
| B **CHITO 退出、PhotoGo 接手（建議）** | CHITO 止血下架 1 天；PhotoGo 補 A–F 5–7 天；功能補齊依需求 3–6 天 | **6–8 天**（不含功能補齊） | 一套、在對的地方；CHITO 專注場域 |
| C 兩邊都不動 | — | — | 使用者繼續遇到「沒反應」；業務不敢賣 |

**選 B 的理由**：A 做完的成果 = PhotoGo 現在的架構；B 花的時間一半以上是「PhotoGo 本來就該做的現場前準備」，不是為了搬遷多做的。

## 五、建議 B 的執行順序（每段可獨立部署、等口令）

| 段 | 系統 | 動作 | 天 |
|---|---|---|---|
| B-0 止血 | CHITO | `module-registry` 加 `host` 模組**預設關**（選單、`/api/admin/host-sessions`、`/api/host-sessions`、`/api/trivia`、編輯器 host_* 元件、含 host_* 的情境模板一起藏；super_admin 可對單一場域開）；`/showcase` 互動段改「大螢幕互動請用 PhotoGo」；把 08-06 卡住的那場標結束；後台「清理超時場次」排除 hostMode（避免再誤殺） | 1 |
| B-1 現場等級 | PhotoGo | 上表 A–F（限流合併、壓測、主機、告警、免配對大螢幕網址、文件） | 5–7 |
| B-2 首場驗證 | PhotoGo | 找一場真的活動（賈村或內部）用 PhotoGo 跑完，看告警與壓測數字；**沒有真實一場之前不對外賣** | 1（活動日） |
| B-3 功能補齊 | PhotoGo / CHITO | 依客戶需求逐項（上表）；KnowledgeMap 在 CHITO 做成玩家頁 | 3–6 |
| B-4 導流與經銷 | 兩邊 | CHITO 客戶要大螢幕 → 導 PhotoGo（先人工開租戶）；同一經銷代碼賣兩邊；「一鍵從 CHITO 開一場互動」的 API 等有 ≥ 3 個客戶要再做 | 併入 P3 |

CHITO 這邊 B-0 之後**不再對 host/ 投入任何開發**；留著程式碼是為了既有情境模板與資料相容，不刪（表只加不刪原則）。

### B-0 實作紀錄（2026-09-25，本地 commit `e69ce81a`，未部署）

| 項目 | 做法 |
|---|---|
| 模組 | `module-registry` 加 `host`（預設關、依賴 games；API 前綴 `/api/admin/host-sessions` `/api/host-sessions` `/api/trivia`；選單 `/admin/host-sessions`） |
| 後台 | 選單「主控大螢幕」→「活動現場大螢幕」掛 `requiresModule: "host"`；theme API 的 `modules` 加 `host` |
| 編輯器 | 場域沒開 host → 工具箱不列 `host_screen` 分類（modules 未載入前先全顯示，同選單規則） |
| 建場 | 情境模板一鍵建場遇 host 元件且場域未開 → 明確錯誤「已改由 PhotoGo 提供」；沒有 fieldId 的舊流程（LINE）放行 |
| 相容 | 公開 `/api/host-sessions/:id`、`/api/trivia/*` 判斷不出場域 → 放行；既有活動的連結不斷 |
| 展示 | `/showcase` 置頂告示 + PhotoGo 連結（demo 保留、註明舊版）；模板市集全 host 情境加註 |
| 單場域開通 | super_admin：`PATCH /api/admin/fields/:id/modules` body `{ "host": true }`（P4 設定中心才有 UI） |
| 測試 | 3 支新測試 14 項；全套 3791 通過、型別 0 錯誤 |

與原計畫的差異：
- **沒改「清理超時場次」排除 hostMode** — 模組關掉後不會再有新 host 場次，改了反而讓卡住的舊場次永遠清不掉。
- 08-06 卡在 playing 的那場（`d749d947`）：部署時用既有「清理超時場次」處理，不另寫程式。
- 部署後要做：對賈村之外的場域不用動（預設關）；若賈村活動當天仍需要舊版大螢幕，用上面的 PATCH 對 JIACHUN 單獨開。

## 六、對「CHITO 專注場域管理、預約、遊戲」的影響

- CHITO 減掉的：一條從沒穩定過、沒人用、觀測不到的軸；17 個 host 元件的維護；「主控大螢幕」這個會讓業務踩雷的入口。
- CHITO 保留的：solo / multi 兩軸（57 場/30 天、100% 完成率）、預約、POS、對戰、GPS/QR/拍照任務、KnowledgeMap 改成玩家頁。
- 講法不變：「CHITO 讓場域可以玩；PhotoGo 讓螢幕會互動」。差別是這次連程式碼的歸屬也清楚了，不是只有文案。

## 七、風險

| 風險 | 處理 |
|---|---|
| PhotoGo 0 真實使用，搬過去等於把客戶當第一個測試 | B-2 強制先跑一場真的；B-1 壓測要有數字 |
| PhotoGo 主機共用、記憶體吃緊 | B-1 C 項先升級；不升級不導流 |
| 既有 CHITO 情境模板含 host_*（生日派對包等）會少一段 | B-0 一併標示「此模板的大螢幕段已移至 PhotoGo」；模板本身仍可建場 |
| 客戶兩產品兩個帳號 | 短期接受；SSO 另議 |
| 業主想保留「CHITO 內一鍵開大螢幕」的體驗 | B-4 的 API 方案，等需求量夠再做，不先做 |

## 八、需業主決定

| 事項 | 選項 | 建議 |
|---|---|---|
| 採哪個選項 | A 修 CHITO／**B 退出並由 PhotoGo 接手**／C 不動 | B |
| B-0 止血要多狠 | 選單藏起來（super_admin 可開）／完全下架 | 藏起來（相容既有模板與資料） |
| PhotoGo 主機 | 升級同一台／搬獨立機 | 搬獨立機（現在跟 4 個別的產品擠 2GB） |
| 首場驗證用哪一場 | 賈村活動／內部活動 | 賈村的下一場現場活動（有真實人數） |
| KnowledgeMap | 留 CHITO 做玩家頁／也搬 PhotoGo | 留 CHITO |

## 附錄：形式差異備註

- 搶答：PhotoGo 每題一個活動、用題組累計排名，作答中不給即時前 3（防洩題）。
- 抽獎：號碼滾動，不是轉盤動畫。
- 拍立得牆：PhotoGo 貼的是拍照機拍的照片；CHITO 是手機送 emoji + 文字卡。
- 跑馬燈：PhotoGo 沒有 score / celebrate 這類公告型別。
- 拔河：依加入順序分紅藍兩隊、限時；不能自由選隊或主持人手動加分。
- 匿名防作弊：兩邊都擋不住「清 cookie 重開頁」。

## 相關

- CHITO：[ADR-0004](../decisions/0004-host-screen-axis.md)、[2026-06-16-host-screen-ws-fix.md](2026-06-16-host-screen-ws-fix.md)、[2026-05-03-error-handling-audit.md](2026-05-03-error-handling-audit.md)（P0 #3「WS 失連 UI」未修）
- PhotoGo（`/projects/互動`）：`docs/domains/interactive.md`、`docs/changes/2026-09-18-p7b-interactive.md`、`docs/runbooks/go-live-checklist.md`、`docs/changes/2026-09-25-business-loop.md`
- 本日：[經銷體系規劃](2026-09-25-partner-territory-revenue-share.md)、[定位分析（已被本文取代）](2026-09-25-showcase-photogo-positioning.md)
