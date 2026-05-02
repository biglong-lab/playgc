# ☁️ Cloudinary × CHITO：完整功能地圖

> **產出日期**：2026-04-24
> **對應實作**：相機功能 30 輪迭代（PROGRESS.md）
> **核心結論**：**Cloudinary 替我們省下 ~90% 媒體工程量**，免費額度足夠 1 萬玩家/月

---

## 📋 目次

1. [核心哲學：為什麼選 Cloudinary](#核心哲學為什麼選-cloudinary)
2. [已實作功能](#已實作功能30-輪)
3. [可立即加值功能](#可立即加值功能)
4. [進階延伸](#進階延伸)
5. [成本分析](#成本分析)
6. [最佳實踐 / 踩坑提醒](#最佳實踐--踩坑提醒)

---

## 核心哲學：為什麼選 Cloudinary

### ⚖️ 伺服器壓力對比

| 工作 | 傳統做法（自己跑）| Cloudinary |
|------|---------------|-----------|
| 圖片壓縮 | Sharp / ImageMagick 吃 CPU | Edge 節點處理 |
| 格式轉換（WebP/AVIF）| 轉檔 job + 多版本存檔 | URL 參數 `f_auto` |
| 合成紀念照 | Canvas + Buffer 組圖 | URL transformation 即時 |
| 打包 ZIP | fs.createReadStream | Archive API signed URL |
| GIF / 動畫 | ffmpeg（吃資源）| multi API（我們 Loop 30 用到）|
| AI 圖像辨識 | 自建 ML pipeline | Vision add-on |
| CDN 分發 | 自建節點 / CloudFront | 內建全球 5000+ 節點 |

**結論**：**我們的 server CPU 幾乎不做圖片相關事**，只做 session/權限/排程。

### 🎯 關鍵數字

```
Linode 伺服器（我們的）:
  磁碟：20GB 剩餘  → 若自己存 2 萬張就爆
  CPU：4 core     → 並發合成必卡

Cloudinary 雲端:
  免費額度：25GB 儲存 + 25GB 頻寬 + 25k transforms / 月
  Edge CDN：全球 5000+ 節點，台灣延遲 <50ms
  副本：自動多點備援
```

---

## 已實作功能（30 輪）

### 🎨 視覺 / 媒體

| # | 功能 | 輪次 | 程式碼位置 |
|---|------|------|-----------|
| 1 | 圖片上傳（自動壓縮、格式轉換）| 既有 | `server/cloudinary.ts` uploadPlayerPhoto |
| 2 | Image Fetch（遠端 URL 當底圖）| 輪 8 | `buildCompositeUrl` playerPhotoUrl |
| 3 | Transformation URL 合成紀念照 | 輪 1-2 | `server/services/photo-composer.ts` |
| 4 | Text + Image overlay | 輪 1-2 | photo-composer layers |
| 5 | Canvas 裁切（`c_fill`）| 輪 1-2 | CompositionConfig |
| 6 | **動態 GIF 合成（multi API）** | **輪 30** | `createAnimatedFromTag` |

### 🤖 AI / 辨識

| # | 功能 | 輪次 | 程式碼位置 |
|---|------|------|-----------|
| 7 | Gemini Vision（單張）| 既有 | `server/lib/gemini.ts` verifyPhoto |
| 8 | Multi-image Vision（2 張比對）| 輪 5 | `comparePhotos` |
| 9 | OpenRouter 替代 Vision | 既有 | `server/lib/openrouter.ts` |

### 📦 管理 / 檢索

| # | 功能 | 輪次 | 程式碼位置 |
|---|------|------|-----------|
| 10 | Search API（folder 列照片）| 輪 14 | `listSessionPhotos` |
| 11 | Search API（多 session 聚合）| 輪 15 | `listUserPhotos` |
| 12 | Archive API（ZIP 一鍵下載）| 輪 25 | `createSessionArchiveUrl` / `createUserArchiveUrl` |
| 13 | Admin API（用量統計）| 輪 29 | `getUsage` + Dashboard card |
| 14 | Tag-based 批次操作 | 輪 30 | `uploadImageWithTag` |

### 📁 組織

| # | 功能 | 輪次 | 用途 |
|---|------|------|------|
| 15 | Folder 階層 `jiachun-game/games/{gameId}/player-photos/{sessionId}` | 既有 | 依場域/遊戲/session 分層 |

---

## 可立即加值功能

**以下每項**都用既有 SDK，無需新依賴，預計 1-2 天可做。

### 🎨 視覺增強

#### 16. 自動人臉裁切 `g_face`
```
/image/upload/c_fill,g_face,w_300,h_300/{publicId}
```
**遊戲應用**：
- 團體合影自動把臉對齊中央
- 頭貼小圖自動裁到臉部
- 排行榜頭像

#### 17. 智能主體裁切 `g_auto`
```
/image/upload/c_fill,g_auto,w_1080,h_1080/{publicId}
```
**遊戲應用**：
- 紀念照自動把主體放中央（Cloudinary AI 找 saliency）
- 場域封面圖自動聚焦重點

#### 18. 動態浮水印（時間戳 / 場域 logo）
```
/image/upload/
  l_text:Arial_30_bold:CHITO%20{date}/co_white,g_south_east,x_20,y_20/
  l_jiachun_logo/w_100,o_50,g_north_west/
  {publicId}
```
**遊戲應用**：
- 防盜圖（每張自帶場域浮水印）
- 下載時自動印日期
- 分享社群品牌曝光

#### 19. 復古 / 黑白濾鏡
```
e_sepia          # 復古
e_grayscale      # 黑白
e_art:athena     # 藝術濾鏡（15 種）
```
**遊戲應用**：
- 戰爭主題場域套黑白
- 古蹟場域套復古
- 管理員在場域設定選「氛圍濾鏡」

#### 20. 背景移除 `e_background_removal`（需付費 add-on）
```
/image/upload/e_background_removal/{publicId}
```
**遊戲應用**：
- AR 貼圖升級：把玩家從背景摳出來貼到新場景
- 紀念照去背後疊上卡通背景

### 🎮 遊戲互動

#### 21. Cloudinary AI 自動標籤
```
// Upload with categorization
cloudinary.uploader.upload(file, {
  categorization: "google_tagging",
  auto_tagging: 0.6,  // 信心度 >60% 自動加 tag
});
```
**遊戲應用**：
- 免寫關鍵字，AI 自動判斷「玩家拍的是什麼」
- 相簿自動分類「人物 / 建築 / 風景 / 美食」

#### 22. OCR 文字辨識
```
cloudinary.uploader.upload(file, {
  categorization: "ocr_text_detection",
});
// → 回傳 info.ocr.adv_ocr.data[].textAnnotations
```
**遊戲應用**：
- 新「找招牌任務」— 玩家拍招牌，AI 讀字比對答案
- 解謎遊戲的「抄錄紙條」驗證

#### 23. 物件偵測 `categorization: "google_tagging"`
**遊戲應用**：
- 「找到 3 種鳥」任務 — AI 自動辨識鳥類
- 博物館「找展品」任務

#### 24. 圖片相似度雜湊（防重複）
```
cloudinary.uploader.upload(file, {
  phash: true,    // perceptual hash
});
// → result.phash 可存 DB，比對是否曾上傳過
```
**遊戲應用**：
- 防作弊：玩家想用同一張照片通過多個驗證點
- 避免相簿出現重複照片

### 📊 營運

#### 25. Upload Preset 前端直傳（已可設）
```js
// 前端直接上傳 Cloudinary，繞過我們 server
const formData = new FormData();
formData.append("upload_preset", "chito_player_photos");
formData.append("file", imageBlob);
fetch(`https://api.cloudinary.com/v1_1/${cloud}/upload`, {
  method: "POST", body: formData,
});
```
**效益**：減輕 server 50% 頻寬（現在照片 base64 都過 server 中轉）。

#### 26. Eager Transformation 預生成
```js
cloudinary.uploader.upload(file, {
  eager: [
    { width: 400, height: 400, crop: "fill" },    // 預生 thumbnail
    { width: 1080, crop: "limit" },               // 預生社群尺寸
  ],
});
```
**效益**：常用尺寸預生，首次載入快 10 倍（非首用時才轉）。

#### 27. Notification Webhook
```js
// Cloudinary 上傳完成通知
cloudinary.uploader.upload(file, {
  notification_url: "https://game.homi.cc/api/webhooks/cloudinary",
});
```
**遊戲應用**：
- 照片上傳完成才觸發 AI 驗證（非同步鏈）
- 批次上傳完成通知管理員

#### 28. Admin API 自動清理
```js
// 刪 30 天前的照片（cron job）
cloudinary.api.delete_resources_by_prefix(
  "jiachun-game/games/xxx/player-photos/",
  { older_than: "30d" },
);
```
**遊戲應用**：配額管理 + 隱私合規。

### 👥 社交

#### 29. 動態 Social Card generator
```
/image/upload/
  w_1200,h_630,c_fill,g_auto/      # FB 建議尺寸
  l_text:Montserrat_80_bold:阿鬨%20·%20150%20分/
  l_trophy_icon/g_center,y_-100/
  {coverImage}
```
**遊戲應用**：
- 分享到 FB 自動生「戰績卡」圖
- 自動生成不同格式（IG Story 9:16 / FB 16:9 / LINE 方形）

#### 30. QR Code 動態生成
```js
// Cloudinary 沒直接支援，但可用 fetch + overlay
const qr = `https://api.qrserver.com/v1/create-qr-code/?data=${url}`;
// 合成到紀念照
```

---

## 進階延伸

### 影片相關（未啟用）
- 自動轉檔多格式（H.264 / VP9 / AV1）
- 自動生縮圖（指定時間點）
- 影片剪輯（trim / concat）
- 字幕自動生成（`auto_captions`）

### 360 / VR
- 全景圖 `e_upscale` 自動填補邊緣
- VR 頭戴式裝置格式輸出

### AI Deep Learning
- Face Attributes（年齡 / 情緒 / 性別預測，**合規敏感**）
- NSFW 偵測（`categorization: "aws_rek_tagging"`）
- 自動生成圖像 alt-text（無障礙）

### Live Streaming
- 即時直播（`resource_type: video, type: live`）
- 對戰直播場景可用

---

## 成本分析

### 免費方案（Free）
```
儲存：25 GB
頻寬：25 GB / 月
Transformations：25k / 月
API 請求：500 / 小時
```

### CHITO 實際使用估算
```
假設 1000 玩家/月 × 10 張照片/人 = 10k 張
  - 原圖平均 500KB → 5GB 儲存（佔 20%）
  - 每張合成 2 次（紀念照 + 成就卡）→ 20k transformations（佔 80%）
  - CDN 頻寬：每張被看 5 次 → 25GB bandwidth（佔 100%！）

結論：免費方案可承載 ~1000 玩家/月
升級到 Plus ($99/月) 可承載 ~1 萬玩家/月
```

### 升級時機
- 儲存 / 頻寬 / Transformations 任一 > 75% → 考慮升級（輪 29 儀表板會提示）
- Plus 方案：$99/月（225GB 儲存 + 225GB 頻寬 + 225k transforms）

---

## 最佳實踐 / 踩坑提醒

### ✅ 我們已做對的

1. **統一 folder 命名規範** `jiachun-game/games/{gameId}/.../{sessionId}/`
2. **所有合成用 URL transformation**（不預生成）— 省儲存
3. **Upload 時 `quality: auto, fetch_format: auto`** — 自動優化
4. **Search API 取代自建相簿 DB**
5. **Archive API 取代自建 ZIP 壓縮**
6. **Admin API 取代自建用量統計**
7. **多 image Vision 取代自建 image comparison**
8. **`l_fetch:URL` 取代先下載再上傳**（photo_composite achievement card）

### ⚠️ 踩過的坑

1. **URL 長度上限 1500 字元** — 複雜合成（10+ layers）會爆
   - **對策**：用 named transformations（先後台定義）
2. **Opaque response 跨域圖片 cache 問題** — SW CacheFirst `statuses: [0, 200]` 會快取空內容
   - **對策**：已移除圖片 SW cache（main.tsx v5）
3. **Tag 格式限制**（burst GIF）：
   - 不能含 `/ :` 等特殊字元
   - **對策**：regex `/^burst_[a-zA-Z0-9_-]+$/` 驗證
4. **`g_auto` 需 Advanced 方案**
   - **對策**：fallback `g_center`

### 🚫 避免的做法

- ❌ **不要自己寫 ImageMagick / Sharp** — Cloudinary 幾乎所有都有
- ❌ **不要自建儲存 + CDN** — Free 25GB 先用到飽
- ❌ **不要自己做圖片 AI** — Vision add-on 更便宜更準
- ❌ **不要預生成常用尺寸**（除非極端高訪問）— URL transformation 的 CDN cache 已夠
- ❌ **不要前端做合成**（Canvas）— server-side URL transformation 更快更穩

---

## 下一步建議（未做）

| 優先 | 項目 | 理由 |
|------|------|------|
| 🥇 | **Upload Preset 前端直傳** | 省 50% server 頻寬，大幅降低 Node.js 負擔 |
| 🥈 | **Cloudinary AI 自動標籤** | 免寫 keywords，相簿自動分類 |
| 🥉 | **動態 Social Card** | 分享戰績自動美美的卡片 |
| 4 | Eager Transformation | 提升 CDN cache 命中率 |
| 5 | OCR 招牌任務 | 新遊戲元件「讀字驗證」 |
| 6 | 背景移除 AR | 玩家去背貼新場景 |
| 7 | 自動清理 cron | 超 30 天舊照片自動刪 |

---

## 快速參考

### URL 組法速記

```
基本：
  https://res.cloudinary.com/{cloud}/image/upload/{publicId}

加 transformation：
  https://res.cloudinary.com/{cloud}/image/upload/
    c_fill,w_800,h_600,g_auto/
    {publicId}

多層合成：
  https://res.cloudinary.com/{cloud}/image/upload/
    c_fill,w_1080,h_1080/
    l_overlay/fl_layer_apply,g_north/
    l_text:Arial_60:Hello/co_white,g_south/
    {publicId}

抓遠端 URL（無需先上傳）：
  https://res.cloudinary.com/{cloud}/image/fetch/
    {transformations}/
    {encodedRemoteUrl}

Archive ZIP：
  cloudinary.utils.download_zip_url({ prefixes: [...] })
```

### SDK 方法速查

```js
// 上傳
cloudinary.uploader.upload(file, options)
cloudinary.uploader.upload_large(...)         // >100MB

// 查詢
cloudinary.search.expression("folder:xxx/*").execute()
cloudinary.api.resources(options)
cloudinary.api.usage()                         // 用量

// 合成
cloudinary.uploader.multi(tag, { format: 'gif' })  // 動畫（我們用的）
cloudinary.uploader.explicit(...)              // 預生多版本

// 清理
cloudinary.uploader.destroy(publicId)
cloudinary.api.delete_resources_by_prefix(prefix)
```

---

**文件維護**：新增 Cloudinary 功能時請同步更新。
**上次驗證**：2026-04-24 深夜（輪 30 完成 GIF 合成，用量儀表板運作正常）。
