# 碎片收集 — 圖片切割完整實作 — 2026-05-13

> 範圍：admin 編輯器 + 玩家端渲染 + schema
> 狀態：🟢 本地 commit / tsc 0 / smoke 51/51 / 待部署
> 接續：[2026-05-13-fragment-image-feasibility.md](2026-05-13-fragment-image-feasibility.md)

## 背景

業主反映：碎片收集元件「碎片收集設定」區無功用、希望能用一張圖切等份做為碎片。

## 設計

**用 CSS `background-position` + `background-size` 動態切割原圖**（不真切、不上傳 N 張）：

```css
.fragment-slot {
  background-image: url(原圖.jpg);
  background-size: 200% 200%;     /* 2×2 grid 例 */
  background-position: 0% 0%;     /* 對應碎片 #1 左上 */
}
```

**N 塊自動 grid 算法**（`calcFragmentGrid`）：

| N | cols × rows |
|---|-------------|
| 2 | 2×1 |
| 3 | 3×1 |
| 4 | 2×2 |
| 5-6 | 3×2 |
| 7-8 | 4×2 |
| 9 | 3×3 |
| 10 | 5×2 |

## 變更

### Admin 端（`ConditionalVerifyEditor.tsx`）

1. 加 `fragmentSource` UI（text / image 兩個按鈕）
2. `image` 模式：
   - 透過 `MediaUploadButton`（已既有元件、走 Cloudinary）上傳圖片
   - 即時 grid 預覽（N 個切片 div、用 CSS bg-position 顯示）
   - 「碎片 cols × rows」Badge 提示
3. 支援移除圖片（X 按鈕）
4. `calcFragmentGrid()` helper export 給玩家端 align

修改：
- `PageConfigEditor.tsx` case `conditional_verify` 傳 `MediaUploadButton`
- `ConditionalVerifyEditorProps` 加 optional `MediaUploadButton` prop

### 玩家端（`ConditionalVerifyPage.tsx`）

1. 偵測 `config.fragmentSource === "image" && fragmentImageUrl`
2. 圖片模式：
   - 每個 fragment slot 用 `<div style={{ backgroundImage, backgroundSize, backgroundPosition }}>` 顯示對應切片
   - 未收集：`filter: grayscale(100%) opacity(0.3)` + Lock icon overlay
   - 收集後：原色 + border-primary 強化
   - 右下角顯示碎片序號 badge
3. grid 容器寬度依 `calcFragmentGridClient(count).cols` 動態
4. 文字模式（既有）保留、不破壞向後相容

### Schema（`shared/schema/games.ts`）

`ConditionalVerifyConfig` 新增：

```ts
fragmentSource?: 'text' | 'image';
fragmentImageUrl?: string;
```

同步更新 `ConditionalVerifyPage.tsx` local interface（client 內部 redefine）。

## 影響檔（4 檔）

| 檔 | 變動 |
|----|------|
| `shared/schema/games.ts` | 加 fragmentSource + fragmentImageUrl |
| `client/src/pages/game-editor/PageConfigEditor.tsx` | 傳 MediaUploadButton |
| `client/src/pages/game-editor/ConditionalVerifyEditor.tsx` | 加 fragmentSource UI + 圖預覽 + calcFragmentGrid |
| `client/src/components/game/solo/ConditionalVerifyPage.tsx` | 玩家端切片渲染 + calcFragmentGridClient + local interface |

## 驗證

- ✅ `npx tsc --noEmit` 0 errors
- ✅ `node scripts/smoke-test-scenarios.mjs` 51/51

## 待業主實測

1. **Admin 後台**：建立 conditional_verify 元件
   - 切到「圖片切割」
   - 上傳一張圖（建議 1:1 / 16:9、< 1MB）
   - 改「碎片數量」（2-10）→ grid 預覽自動調整
2. **玩家端**：開遊戲、進到該元件
   - 未收集前看到 N 塊灰階 + Lock 圖示
   - 收集到對應道具後該塊變彩色（用 CSS background-position 切的原圖區塊）
   - 全收集 → 拼出完整原圖

## 已知限制

- 玩家收集到碎片時、目前還是依賴 fragment.sourceItemId 綁定（既有機制）。本 sprint 只做「顯示切片」、不改「碎片如何取得」邏輯
- 圖片建議比例 1:1 / 16:9。其他比例 cols/rows 失衡可能變形
- 圖片過大（> 1MB）會影響 PWA cache、Cloudinary upload 有自動壓縮

## 後續可優化

- 玩家全收集時：加拼圖完成動畫（slide-in 各塊到位）
- 切片邊框 / 縫隙美化（讓「拼圖感」更明顯）
- 碎片可拖曳重排（讓玩家自己拼）
- 道具系統整合：item icon 用對應切片（背包顯示）
