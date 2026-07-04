# Template-Market 12 情境 — 體驗優化 — 2026-07-05

> 範圍：情境模板市集（列表/詳情/體驗流程/轉化）
> 來源：業主「分析 12 情境並優化體驗」；兩路深度探勘（頁面盤點 + 端到端流程）
> 狀態：W1+W2 完成、tsc/build/測試過

## 分析（四段漏斗、全部有出處）
1. **瀏覽**：最大賣點「免登入掃 QR 即玩」只在詳情頁沒上卡片；列表文案「Phase 2 W7 才能用」過時自打臉；收尾 CTA 指向 admin 後台撞登入牆
2. **理解**：元件扁平清單、無流程視覺化；佔位字（「請主辦改成…」）會被直接建場帶到玩家眼前
3. **體驗**：訪客無情境級試玩；multi 登入牆粗暴（`/g/:slug` 不預告 → 進 GamePlay 才無聲踢回首頁、無回跳）；HostScreen 有 host page 時不顯示玩家加入 QR
4. **轉化**：玩完無 CTA、無回流引導

## 本次修復

### W1 — 亮出既有價值（純前端、低風險）
- **卡片加登入 badge**：全 host →「🟢 免登入・掃 QR 即玩」/ 含 multi →「🔑 需組隊登入」（`TemplateMarket.tsx`）
- **修過時文案**：hero/收尾改「AI 客製 + 一鍵建場，2 分鐘開場」；訪客 CTA 改導 `/find-scenario`，後台捷徑只在 admin 登入時顯示
- **詳情頁流程時間軸**：元件扁平清單 → 編號 stepper（順序 + 連接線 + axis + 免登入 tag）（`TemplateMarketDetail.tsx`）
- **分類修正**：`kids-adventure` social → venue（對齊註解、venue 段不再孤卡）（`shared/scenario-templates.ts`）
- 卡片元件 badge 上限 4 → 6

### W2 — 體驗流程順滑（精準修）
- **multi 登入牆順滑化**：
  - `GameBySlug` team 模式加「🔑 需登入組隊」預告 badge
  - `GamePlay` 未登入改明確「需登入」畫面（不再 render 內無聲 `setLocation("/")`），存 `sessionStorage.postLoginReturn`
  - `Home` 加登入後回跳 effect（user 出現 → 讀 postLoginReturn 導回原遊戲）
- **HostScreen 常駐加入 QR**：新元件 `HostJoinQr`（可收合、用 `qrcode` lib）——有 host page 時角落常駐玩家加入 QR + 短網址，掃大螢幕即入場
- **佔位字建場防呆**：詳情頁建場 Dialog 掃 scenario config 偵測「請主辦/講師/admin…」→ 顯示「⚠️ N 個元件含待編輯內容」+ 提示用 AI 客製/後台編輯（純前端、不動 server）

## 影響檔案
`TemplateMarket.tsx`、`TemplateMarketDetail.tsx`、`GameBySlug.tsx`、`GamePlay.tsx`、`Home.tsx`、`HostScreen.tsx`、新增 `components/game/host/HostJoinQr.tsx`、`shared/scenario-templates.ts`（分類一行）

## 驗證
- `npx tsc --noEmit` ✅、`npm run build` ✅、scenario-renderable 不變式 + GamePlay 測試 14/14 過
- 待真機：手機看列表卡 badge、multi 登入回跳、大螢幕掃 QR 入場

## 後續選項（本次不做、待業主點頭）
- **訪客 demo 沙盒**（最大轉化利器）：公開 `POST /api/scenarios/:id/demo` + isDemo + TTL cron 清理 → 訪客免登入玩完整 host 情境（動 server + 資料生命週期、工程中大）
- 情境預覽圖欄位 + 實拍圖、公開熱門度/瀏覽埋點、GameCompletionScreen 模板轉化 CTA、HostPlay 完成態

## 守紅線
不加情境數、不加無 renderer 元件、不動 instantiate server 邏輯、preview 情境維持 preview。
