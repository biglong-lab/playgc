# 📸 CHITO 相機功能完整使用指南

> **產出日期**：2026-04-24
> **版本**：v2 (27 輪迭代完成)
> **適用對象**：場域管理員、遊戲設計師、運營人員
> **對應實作**：PROGRESS.md「相機功能 27 輪迭代」章節

---

## 📋 目次

1. [6 種拍照元件](#6-種拍照元件)
2. [相簿系統](#相簿系統)
3. [場域紀念照模板自訂](#場域紀念照模板自訂)
4. [管理員常見操作](#管理員常見操作)
5. [玩家端體驗流程](#玩家端體驗流程)
6. [故障排除 / FAQ](#故障排除--faq)
7. [API 端點速查](#api-端點速查)

---

## 6 種拍照元件

選擇建議：

| 場景 | 推薦元件 |
|------|--------|
| 自由創作拍什麼都可 | `photo_mission` |
| 玩家要到特定地點拍照 | 📍 `photo_spot` |
| 玩家要拍出跟參考圖一樣的 | 🔍 `photo_compare` |
| 活動前後對比（淨灘、整修、化妝）| 🔀 `photo_before_after` |
| 想要動感 / 連拍紀念 | 📸 `photo_burst` |
| 場域特色貼圖合照 | 🎭 `photo_ar` |
| 團隊合影紀念 | 👥 `photo_team` |

### 1. `photo_mission` — 自由拍照 + AI 關鍵字

**最通用**，玩家拍任意照片，AI 檢查是否含指定關鍵字。

**設定**：
- 拍照指示：告訴玩家要拍什麼
- AI 驗證開關 + 目標關鍵字（如：「鳥」「花」「石獅子」）
- 信心度門檻 20%-95%
- 允許重拍 + 最多重拍次數
- AI 模型（可選，預設場域模型）

**適用**：開放式任務，鼓勵創作。

### 2. 📍 `photo_spot` — 指定拍照（GPS + AI 雙通道）

玩家必須在特定地點拍特定場景才算成功。

**設定**：
- **拍照點 GPS 座標**（可按「使用我現在的位置」一鍵帶入）
- 半徑（預設 20 公尺）
- 場景描述（AI 驗證用，如：「紅色涼亭 + 石獅子」）
- 參考圖（選填，可上傳 + 即時預覽）
- **驗證策略**（4 種）：
  - `GPS + 視覺` — 雙通過最嚴（推薦）
  - `GPS 或 視覺` — 任一通過寬鬆
  - `只看 GPS` — 最寬（室內場景用）
  - `只看視覺` — 不查 GPS
- GPS 嚴格度：hard（未進圈無法拍）/ soft（可拍但扣分）
- 是否生成紀念照

**玩家體驗**：
1. 進頁面看到距離指引（離拍照點 X 公尺）
2. 進入半徑後相機啟用
3. 拍照 → 上傳 → AI 驗證
4. 成功後自動合成紀念照

### 3. 🔍 `photo_compare` — 拍照確認（AI 圖像比對）

玩家必須拍出跟管理員參考照類似的畫面。

**設定**：
- 參考照片（必填，可上傳 + 預覽）
- 參考照描述（給 AI 的額外提示）
- 比對模式：
  - `整體場景`（scene，預設）
  - `物件存在性`（object）
  - `構圖結構`（composition）
  - `色調氛圍`（color）
- 相似度門檻 20%-95%（建議 50-70%，太高玩家會挫敗）
- 是否先給玩家看參考照 / 是否生成紀念照

**玩家體驗**：拍照後 AI 比對 → 顯示相似度 + 符合特徵 + 缺少特徵。

### 4. 🔀 `photo_before_after` — 前後對比

分時拍兩張，自動合成左右或上下對比圖。

**設定**：
- 前/後標籤（預設「整理前」「整理後」）
- 排版：水平 / 垂直
- 最少間隔秒數（預設 10 秒，防連拍同狀態）

**玩家體驗**：
1. 拍第一張（before）
2. 倒數等 N 秒
3. 拍第二張（after）
4. 自動合成對比圖

### 5. 📸 `photo_burst` — 連拍紀念

自動連拍 N 張 → 合成拼貼圖。

**設定**：
- 連拍張數（3-9 張）
- 每張間隔（300-3000ms，建議 800-1500ms）
- 拼接：自動依張數（2x2 / 3x2 / 3x3）

**玩家體驗**：開相機 → 自動連拍 → 合成拼貼。

### 6. 🎭 `photo_ar` — AR 貼圖拍照（固定位置）

相機畫面疊加場域設定的 PNG 貼圖。

**設定**：
- 可加多張貼圖
- 每張：URL（可上傳）/ 位置（7 選項：top/bottom/center/4 corners）/ 大小（5-80%）

**玩家體驗**：相機預覽時即看到貼圖效果 → 拍照合成。

**注意**：固定位置版（不做臉部追蹤，避免合規風險）。

### 7. 👥 `photo_team` — 團體合影

隊長主控，逐一為每位隊員拍照，最後合成團體照。

**設定**：
- 最少/最多隊員數（1-9）
- 排版：grid / strip / collage（依人數自動 2x2 / 3x2 / 3x3）

**玩家體驗**：
1. 選擇實際人數
2. 填第一位名字
3. 逐一為每位拍照（相機頂部顯示「第 X / N 位」）
4. 全部拍完自動合成拼貼 + 名字 overlay

---

## 相簿系統

### 自動保留
每個玩家拍的所有照片自動存 Cloudinary（場域 / 遊戲 / session 資料夾分層）。

### 3 個入口

1. **遊戲完成時** — GameCompletionScreen 有「查看本場相簿（N 張）」按鈕
2. **個人中心** — MeCenter「我的紀念照」卡片 → `/me/photos`（所有 session 聚合，依日期分群）
3. **直接連結** — `/album/:sessionId`（可分享給隊友）

### 功能

- **Lightbox 檢視**：點照片放大
- **單張下載**：Blob + `<a download>`
- **單張分享**：Web Share API（含圖）+ clipboard fallback
- **📦 ZIP 一鍵下載**：兩個相簿頁都有「下載全部」→ 單一 zip 檔（Cloudinary archive API）
- **分享整本相簿**：Web Share API 分享連結

---

## 場域紀念照模板自訂

### 進入設定

管理員登入 → **場域設定** → **「📸 紀念照」Tab**

### 可自訂

#### 🏆 成就卡模板（GameCompletionScreen 用）
玩家完成遊戲點「生成紀念卡」時用。

#### 📸 拍照紀念模板（photo_spot / photo_compare 用）
拍照驗證通過後的合成紀念照用。

### 文字層設定

每個模板可新增多個文字層，每層可設：
- **文字內容**：支援變數插值
  - `{fieldName}` — 場域名稱（如「賈村競技場」）
  - `{gameTitle}` — 遊戲名稱
  - `{score}` — 玩家分數
  - `{date}` — 今日日期（YYYY.MM.DD）
  - `{playerName}` — 玩家名
- **大小**：12-200 px
- **顏色**：`white`、`black`、`rgb:FFD700` 等 Cloudinary 色碼
- **背景色**：同上（選填，通常半透明黑）
- **位置**：north / center / south / east / west / 4 個角
- **偏移 Y**：離邊緣距離
- **粗體**：是/否

### 範例

**賈村競技場成就卡**：
```
Layer 1: ⚔️ {fieldName}          [north, 56px bold, 白色, 黑底半透明]
Layer 2: {gameTitle}              [center, 48px bold, 白色]
Layer 3: {score} 分               [center+40y, 120px bold, 金色 rgb:FFD700]
Layer 4: {playerName} · {date}    [south+80y, 32px, 白色]
Layer 5: CHITO · Play the Place   [south+30y, 24px, 白色]
```

---

## 管理員常見操作

### Q: 如何新增拍照元件到遊戲？

1. 進遊戲編輯器 → 該遊戲 → 「新增頁面」
2. pageType picker 看到 7 種拍照選項 → 選一種
3. 設定該元件的 config → 儲存
4. 連到下一頁

### Q: 如何預覽拍照元件效果？

編輯器頂部「預覽」按鈕 → 彈 Dialog 用 mock data 渲染玩家端畫面。

### Q: 如何改紀念卡的樣式？

場域設定 → 紀念照 Tab → 編輯「成就卡」區塊的文字層 → 儲存。
**下次新完成遊戲立即生效**（舊紀念卡不會重生）。

### Q: 如何讓所有場域用 CHITO 預設紀念照？

在紀念照 Tab 把「成就卡」的啟用開關**關掉**（enabled=false）。
系統會自動用預設模板：`🏆 {fieldName} · {gameTitle} · {score} 分`。

### Q: 玩家說拍完沒拿到道具？

確認拍照元件的「完成獎勵 - 道具獎勵」區塊有勾選/填寫。
**注意**：只有 AI 驗證成功才會發道具（防作弊）。AI 不可用 fallback 時不給分不給道具。

### Q: 玩家的拍照存哪？

Cloudinary 資料夾：`jiachun-game/games/{gameId}/player-photos/{sessionId}/*`
合成紀念照是即時 URL transformation（不額外佔空間）。

---

## 玩家端體驗流程

```
1. 進入場域  /f/JIACHUN/home
2. 選遊戲 → 開始玩
3. 遇到拍照元件（任一 6 種）
   ↓
4. 拍照
   ├─ photo_spot: GPS 指引 → 進圈 → 拍
   ├─ photo_compare: 看參考照 → 拍類似的
   ├─ photo_before_after: 拍前 → 等倒數 → 拍後
   ├─ photo_burst: 自動連拍
   ├─ photo_ar: 開相機看 overlay → 拍
   └─ photo_team: 逐一為隊員拍
   ↓
5. AI 驗證 + 自動合成紀念照
6. 下載 / 分享 / 繼續遊戲
   ↓
7. 通關 → GameCompletionScreen
   ├─ 分享戰績
   ├─ 生成紀念卡（場域自訂樣式）
   ├─ 👀 查看本場相簿（N 張）← 新增
   └─ 返回大廳 / 排行榜
   ↓
8. 日後回來 → MeCenter → 我的紀念照 → 看所有紀念
```

---

## 故障排除 / FAQ

### 相機權限被拒
瀏覽器需允許 `camera` 權限。iOS Safari 一旦拒絕需到 **設定 > Safari > 相機** 重新開。

### 分享按鈕沒反應
- iOS Safari / Android Chrome 支援 Web Share API（含圖分享）
- 桌面瀏覽器：fallback 複製連結

### ZIP 下載失敗
自動 fallback 到「逐張批次下載」（for loop + 400ms 間隔）。

### AI 驗證總是失敗
- 確認場域 AI Key 有效（場域設定 → AI 設定）
- 檢查信心度門檻是否過高（建議 50-70%）
- 檢查關鍵字是否太抽象（AI 難判斷）
- 若 API 配額用盡 → fallback 到「照片已上傳但本題不計分」

### 紀念照沒合成
合成失敗 fallback 用原圖當紀念（不阻擋遊戲進度）。
大多是 Cloudinary URL 過長（合成設定太複雜 10+ layers）。建議：
- 減少 textLayers 數量（建議 3-5 個）
- 用 named transformation（進階）

### 場域 /f/X/home 顯示錯場域的遊戲
已在輪 18 修復。若仍有此問題請**強制刷新**（Cmd+Shift+R）清瀏覽器 cache。

---

## API 端點速查

| 端點 | 用途 |
|------|------|
| `POST /api/cloudinary/player-photo` | 玩家拍照上傳 |
| `POST /api/cloudinary/composite-photo` | 合成紀念照（支援 publicId 或 URL）|
| `POST /api/admin/photo-composite/preview` | 管理員預覽模板效果 |
| `GET /api/photo-composite/default-config` | 系統預設紀念照模板 |
| `GET /api/photo-composite/achievement-config?fieldCode=XXX` | 場域成就卡模板 |
| `GET /api/photo-composite/memorial-config?fieldCode=XXX` | 場域拍照紀念模板 |
| `POST /api/ai/verify-photo` | AI 照片關鍵字驗證 |
| `POST /api/ai/compare-photos` | AI 兩張圖比對 |
| `GET /api/sessions/:sessionId/album` | session 相簿列表 |
| `GET /api/sessions/:sessionId/album/zip-url` | session 相簿 ZIP URL |
| `GET /api/me/photos` | 個人相簿（跨 session）|
| `GET /api/me/photos/zip-url` | 個人相簿 ZIP URL |

全部 endpoint 經 health check 驗證正常（2026-04-24 深夜）。

---

## 開發路線圖（未做）

| 項目 | 阻擋原因 |
|------|---------|
| AR 臉部追蹤（MediaPipe） | 合規風險（deepfake 法規趨嚴）|
| Google Drive 直傳 | 需 Google Cloud Console 建 OAuth Client ID |
| 相簿正統 PDF 匯出 | 現 ZIP 下載已覆蓋需求 |

---

**文件維護**：相機功能有任何更動，請同步更新此指南。
**上次完整驗證**：2026-04-24 深夜（27 輪迭代全綠，0 失敗）。
