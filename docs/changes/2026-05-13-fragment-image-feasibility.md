# 碎片收集 — 圖片切割可行性 — 2026-05-13

> 業主原話：「碎片可以用一張圖系統來切分？分割碎片、看設定幾個碎片就切成幾等份、請確認技術可行性。」

## ✅ 技術可行性：完全可行

### 切割方案（推薦）

**用 CSS `background-position` + `background-size` 動態切割**（不真切圖）：

```css
.fragment {
  background-image: url(原圖.png);
  background-size: 200% 200%;  /* 2x2 grid */
  background-position: 0% 0%;  /* 左上 */
}
```

| 碎片數 | grid（cols × rows）| 排版 |
|--------|------------------|------|
| 2 | 2×1 / 1×2 | 橫排 / 直排 |
| 3 | 3×1 | 橫排 |
| 4 | 2×2 | 正方 |
| 6 | 3×2 | 橫長 |
| 9 | 3×3 | 正方 |
| 10 | 5×2 | 橫長 |

### 優點

- 不需上傳 N 張切片到 Cloudinary（省額度）
- 玩家端 instant preview（不等切割 API）
- 原圖在 Cloudinary 用 `q_auto` 自動 WebP / 弱網降級（接 useNetworkQuality）
- 改數量不用重切（只調 cols/rows）

### 替代方案（如 CSS 不夠細）

- **客戶端 Canvas 切**：`drawImage` + `toDataURL` 切 N 張 dataURL（適合需要旋轉 / 浮水印）
- **後端 sharp 切**：`/api/items/cut-image` 後端切 + Cloudinary upload（適合需要永久存）

## 📋 完整實作計畫（4-6h、留下波）

### Phase A — Admin 端（2-3h）
1. `ConditionalVerifyEditor` 加「碎片來源」radio：`text` | `image`
2. image 模式：
   - 圖片上傳（用既有 Cloudinary upload）
   - 自動計算 `cols × rows`（依 fragmentCount）
   - 預覽：grid 顯示 N 塊 + 編號
3. config schema 加 `fragmentImageUrl: string` + `fragmentGrid: { cols: number; rows: number }`

### Phase B — 玩家端（2-3h）
1. `ConditionalVerifyPage` 偵測 `fragmentImageUrl` 存在
2. 渲染碎片時用 `<div style={{ backgroundImage, backgroundSize, backgroundPosition }}>` 顯示切片
3. 玩家收集到的碎片亮起、未收集的灰階 / 隱藏
4. 全收集後自動拼成完整圖、加慶祝動畫

### Phase C — 道具系統整合（1h）
1. 玩家獲得碎片道具時、item icon 改用對應切片
2. 背包 / 確認頁顯示「N/M 碎片完成度」

## 風險與限制

| 風險 | 緩解 |
|------|------|
| 圖太寬 / 太高、grid 比例怪 | 限制原圖建議 1:1 / 16:9、UI 提示 |
| 玩家螢幕窄 → 切片過小 | minHeight: 80px + scroll |
| Cloudinary 圖片載入失敗 | fallback 顯示文字碎片（既有機制）|
| 切片數 > 10 → grid 太擠 | 上限 10 已有（fragmentCount max=10）|

## 為什麼本次先不做

本次 sprint 已修 6 個業主問題、P2-5 需要 4-6h 完整實作 + 玩家端測試。
建議下波獨立做、做完一次完整部署 + 業主實機驗證、不混在 P0/P1 修補波。
