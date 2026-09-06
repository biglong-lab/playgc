# CHITO 批次：全站宣告 footer + 地圖方向 + AR 動態貼圖 + 互動模組設定 — 2026-08-27

> 範圍：CHITO 5 張未解決中的 4 張（剩 MQTT 硬體阻塞）
> 狀態：🟢 已部署 `73bfb33b`（bundle `index-Cq0OKC-E.js`）；四張轉待測試
> 前情：[2026-08-06 活動工具批次](2026-08-06-event-tools-mqtt-legal-batch.md)

---

## 一、成果總表

| Issue | 標題 | 累計修次 | 真根因 | 狀態 |
|---|---|---|---|---|
| `c45e8915` | 免責聲明五宣告 | 2 | 第 1 修只掛 template-market 一頁 → 改 App 根層全站掛載 | 🧪 測試中 |
| `2a1bb97a` | OSM 地圖方向相反 | 1 | **座標系錯配**：北朝上的地圖套了羅盤的裝置相對角 | 🧪 測試中 |
| `26ecaf3a` | AR 動態貼圖錄影變靜態 | 1（承接 `1bc34792` 4 修） | 合成鏈本身正確；破口是**解幀來不及**（6.4MB／100 格冷啟數秒） | 🧪 測試中 |
| `0541db39` | 活動互動元件設定顯示 JSON | 1 | 21 個互動模組元件掉 default 分支＝唯讀 JSON；另有 4 個預設值 key 對不上實作 | 🧪 測試中 |
| `c0428790` | 後端 MQTT | 2 | 平台端就緒，卡 broker 接線 + ESP32 韌體改 v1 契約 | 🔒 硬體阻塞 |

---

## 二、全站宣告 footer（c45e8915 第 2 修）

**為什麼第 1 修被判 fail**：只在 `TemplateMarket.tsx` 掛 `<LegalFooter />`，
業主要求是「每個頁面下方」，測試員回報「未看到入口」。

- 新檔 `client/src/components/shared/GlobalLegalFooter.tsx` — 掛在 `App.tsx` 根層
- 沉浸式頁面排除清單（底部是操作區，掛上會擋按鈕）：
  遊玩中 `/game/:id`、`/f/:code/game/:id`、地圖導航、`/host/`、`/play/`、
  `/liff/play/`、`/pos/scan`、短連結轉址 `/g/ /j/ /b/`
- 移除 TemplateMarket 內單獨掛載，避免重複
- 玩家端 fixed bottom nav 避讓：wrapper 加 `pb-bottom-nav md:pb-0`

**守護**：`e2e/legal-footer-global.spec.ts`（12 頁 × 桌機/手機 = 30 案）
+ `GlobalLegalFooter.test.ts`（路徑規則單元測試，含需登入頁轉址情境）

---

## 三、地圖方向（2a1bb97a）— 與羅盤 13 修是不同的病

**兩種座標系被混用**（新檔 `client/src/lib/compass-rotation.ts` 已把定義集中）：

| | 座標系 | 箭頭角度 |
|---|---|---|
| 上方羅盤 | 裝置：螢幕上方＝手機前方 | 刻度環 `-heading`；指標 `bearing − heading` |
| 下方 Leaflet 地圖 | 世界：永遠北朝上、不隨手機轉 | **絕對角**（指目標 `bearing`／表朝向 `heading`）|

`GpsMissionMap.tsx` 的玩家箭頭沿用了羅盤的相對角 → 與地圖上畫的目標位置
永遠差一個 heading。用回報截圖驗算完全吻合：朝向 270°、目標方位 21°，
紅靶畫在正上方而箭頭指 111°（右下）。

修法：地圖箭頭改為表示「手機目前朝向」的絕對角（同 Google Maps 視野指標），
與羅盤刻度環指同一個真實方位；無羅盤時不畫箭頭。羅盤端改呼叫共用函式、行為不變。

**⚠️ 給後人**：GPS 這類問題先確認「這個 UI 在哪個座標系」再動公式 —— 羅盤那題
修 13 次的教訓是「公式本來就對」，這題則是「對的公式用在錯的座標系」。

---

## 四、AR 動態貼圖錄影（26ecaf3a）

**先證明鏈路是好的再找破口**（見 §六驗證手法）：真 Chrome + 真模組 +
生產貼圖跑完整合成鏈，錄出的成品每段畫面都不同 → 解幀→合成→MediaRecorder 正確。

破口是「來不及」：生產貼圖（KMTI #39 沙美五柱風獅爺）原檔 6.4MB／100 格，
冷啟解完要數秒；玩家一進畫面就錄 → 那幾秒 `stickerFrames` 全 null → 整段靜態第一幀。

- 解碼來源改走 Cloudinary `f_webp,fl_awebp,w_540`：同 100 格、透明保留、
  6.4MB → 1.0MB（-84%），冷 context 實測 934ms 備妥；轉檔失敗自動回原始 URL
  （`w_720` 本帳號會被擋 400，540 是實測可用值）
- iOS 影片幀源 `f_mp4` 一併縮到 540
- 新檔 `ar-sticker/useAnimatedStickers.ts`：幀源管理 + `ready` 旗標；
  未就緒時擋錄影並提示「動態貼圖載入中…載好才錄得到動畫」
- `stickers` 改 `useMemo`（原本 `?? []` 每次 render 都是新陣列 → 解碼 effect 反覆重跑）
- 主檔 851 → 800 行（刪 3 個未使用的存檔 handler）

### 已知限制：舊 iOS 無法保留透明背景

無 `ImageDecoder` 的 iOS Safari（≤ 17.3）只能用影片幀源，而
**Cloudinary 任何影片格式都不保 alpha**（實測 `f_mp4` / `f_webm` / `vc_h265`
全部輸出 `yuv420p`）→ 透明區變黑框。要支援舊 iOS 的透明動態貼圖需改逐格 PNG
（`pg_N` 實測可取、RGBA 保留，但無法查總格數且每格約 155KB），尚未做。
已在 CHITO 請業主回報測試機 iOS 版本再決定。

---

## 五、互動模組 21 元件設定表單（0541db39）

沿用 [2026-08-06 建立的 schema 驅動編輯器](2026-08-06-event-tools-mqtt-legal-batch.md#二活動元件編輯器本批最大塊)，
新檔 `client/src/pages/game-editor/eventModuleSchemas.ts` 補齊 21 個互動模組
（現場投票／團隊願景／隊伍命名／活動筆記／同伴讚美／心情尺度／場地評分／
微承諾／結語／給隊伍的禮物／能力徽章／婚禮祝福卡／生日許願／頒獎典禮／
感恩之樹／餐桌話題／高低時刻／角色板／發現卡／隊旗設計／派對選單）。

現場投票的候選選項改可編輯（object-list；留空則用內建 6 個示範選項）。

### 順帶抓出 4 個「設了不生效」的預設值

守護測試掃元件原始碼比對 config key，立刻抓出預設值寫錯 key：

| pageType | 預設寫的 | 元件實際讀的 |
|---|---|---|
| `activity_memo` | `prompt` | `keywordPrompt` / `actionPrompt` |
| `scale_check` | `prompt` | `question` / `minLabel` / `maxLabel` |
| `venue_rating` | `prompt` | `venueName` |
| `high_low_card` | `prompt` | `highPrompt` / `lowPrompt` |

已在 `getDefaultConfig.ts` 對齊。

**尚未開放**：頒獎獎項、餐桌話題、角色板角色、能力徽章、感恩對象等清單
仍寫死在玩家端元件內（要開放後台編輯需同時改元件讀 config）。

---

## 六、本輪的驗證手法（下次可直接複用）

| 想驗的東西 | 走不通的路 | 可行做法 |
|---|---|---|
| admin 編輯器 UI | admin 一律 Firebase 登入，無密碼登入端點（`/api/admin/login` 回 410） | 元件層 vitest + testing-library |
| 玩家端完整流程 | `/game/:id` 需登入、`DeviceGate` 擋桌機 | 同上；或 test-only seed 端點（僅 host 軸） |
| AR 錄影成品是否真的在動 | 肉眼看成品（前 4 修都這樣，判斷不了） | Playwright 用 `import('/src/…')` 直接載專案模組跑真實邏輯，錄完回放抽格比對像素指紋 → `e2e/ar-animated-recording.spec.ts` |
| 設定改了有沒有效 | 人工對照 | 掃元件原始碼抓 config key，與編輯器 schema／預設值比對（`__tests__/eventModuleSchemas.test.ts`）|

假相機來源用 `canvas.captureStream()` 畫靜止純色 → 背景不動，任何幀差都只
可能來自貼圖（不需要外部 y4m/mp4 測試資產）。

---

## 七、驗證與部署

- `npx tsc --noEmit` 零錯誤；`npx vitest run` 3354 passed / 52 skipped
- e2e：footer 30 案、AR 錄影 2 案全過
- CI（GitHub Actions）green
- `npm run deploy` → `73bfb33b`、bundle `index-Cq0OKC-E.js`，
  git HEAD 與 bundle hash 三方一致；`VERIFY_SYMBOL=global-legal-footer` 在 bundle 內
- 生產實測：7 個一般頁都有五宣告 footer、遊玩頁 0 個；`/legal` 五分頁 200
- 安全 headers 六項齊全、X-Powered-By 已隱藏
- 生產資料完整：games=44 / pages=1219 / sessions=1094 / users=305

---

## 八、待辦

1. **MQTT**（`c0428790`，critical）— broker 接線 + ESP32 韌體改 v1 契約，硬體端阻塞
2. AR 舊 iOS 透明背景 — 等業主回報測試機 iOS 版本再決定是否做逐格 PNG
3. 互動模組的內建清單（獎項／話題／角色／徽章／感恩對象）開放後台編輯 — 等優先順序
4. 五宣告措辭待業主複核（沿用 2026-08-06 未結項）

---

## 相關文件

- [ADR-0017 Loop 模式安全網](../decisions/0017-loop-mode-safeguards.md)（本輪遵守：每項都做接地驗證）
- [2026-08-06 活動工具批次](2026-08-06-event-tools-mqtt-legal-batch.md)
- [domains/mqtt-devices.md](../domains/mqtt-devices.md)
