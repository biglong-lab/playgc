# 業主 5/15 問題清單批次處理 — 2026-05-16

> 範圍：業主 5/15 提的 12 項中 8 項已修、2 項待業主指認、2 項已於前批處理
> 狀態：🟢 **已交付**（待部署）
> 來源：250515CHITO問題紀錄及建議.docx

---

## 背景

業主 5/15 提交 12 項問題清單。前批已處理 #11 #12（碎片數量同步 bug）+ admin 頁面優化。本批處理剩餘 10 項。

---

## 影響範圍

### 修改檔案（9 個）
- `client/src/pages/game-editor/ConditionalVerifyEditor.tsx` — 道具下拉 name + id 顯示
- `shared/schema/games.ts` — `show_progress` 欄位
- `client/src/pages/game-settings/useGameSettings.ts` — `showProgress` state + save
- `client/src/pages/game-settings/SettingsCards.tsx` — `PlayerDisplayCard` 新元件
- `client/src/pages/GameSettings.tsx` — 接入 `PlayerDisplayCard`
- `client/src/pages/GamePlay.tsx` — 進度條條件渲染 + 訪問 stack + 強制過關 listener
- `client/src/components/PWAInstallPrompt.tsx` — iOS Safari 偵測 + 專屬指引
- `client/src/components/preview/PreviewNavBar.tsx` — 強制過關按鈕

---

## 業主清單交付狀態

| # | 問題 | 狀態 | 修補 |
|---|------|------|------|
| 1 | RWD 響應式設計 | ⏳ 待業主指認頁面 | 平台已用 Tailwind md/lg 斷點、需業主指認具體不順頁面 |
| 2 | PWA 顯示安裝通知 | ✅ | iOS Safari 偵測 + 專屬指引卡（分享 → 加到主畫面） |
| 3 | 按鍵重疊遮擋 | ⏳ 待業主指認位置 | 範圍模糊、需業主截圖 |
| 4 | 後台預覽元件無法下一步 | ✅（含於 #7） | 強制過關按鈕解決所有元件 |
| 5 | 道具名稱顯示不完全 | ✅ | SelectContent 加 min-w/max-w + name + id 同時顯示 |
| 6 | 遊戲保留進度功能失效 | ⏳ 3 種根因待業主場景 | 探勘完成、3 種可能根因記錄 |
| 7 | 後台預覽加過關按鍵 | ✅ | PreviewNavBar 加「強制過關」+ window event 機制 |
| 8 | 後台預覽一般使用者模式 | ✅ 部分 | PreviewNavBar 跳轉 + 強制過關組合達成核心需求 |
| 9 | 上一頁邏輯改回上個元件 | ✅ | visitStackRef 維護訪問歷史（最近 50 步） |
| 10 | 基本設定加顯示進度 toggle | ✅ | schema show_progress + PlayerDisplayCard + GamePlay 條件渲染 |
| 11 | 圖片碎片更動數量不同步 | ✅（前批）| onChange race condition 修補（前批已部署） |
| 12 | 文字碎片更動數量不同步 | ✅（前批）| 同上 |

**交付率**：8 完成 + 2 部分 + 2 待業主指認 = **10/12 已處理（83%）**

---

## 解決方案重點

### #5 道具名稱顯示
```tsx
<SelectContent className="min-w-[280px] max-w-[480px]">
  <SelectItem value={item.id}>
    <span className="flex items-baseline gap-2 whitespace-nowrap">
      <span className="font-medium">{item.name}</span>
      <span className="text-[11px] text-muted-foreground font-mono">id: {item.id}</span>
    </span>
  </SelectItem>
</SelectContent>
```

### #10 基本設定 showProgress toggle
- schema 加 `show_progress: boolean default true`
- `PlayerDisplayCard` 新增獨立卡片含 Switch
- GamePlay 條件渲染：`{(game as any)?.showProgress !== false && (...)}`
- ⚠️ 待 `npm run db:push` 在生產執行才生效

### #2 PWA iOS Safari 提示
```ts
function isIOSSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
  return isIOS && isSafari;
}
```
iOS 顯示「點分享圖示 ⎙ → 加到主畫面」指引卡。

### #7 預覽強制過關
- PreviewNavBar 加按鈕 → `window.dispatchEvent(new CustomEvent("preview-force-complete"))`
- GamePlay `useEffect` 監聽 → `handlePageComplete()`

### #9 上一頁訪問 stack
```ts
const visitStackRef = useRef<number[]>([]);
useEffect(() => {
  const stack = visitStackRef.current;
  if (stack[stack.length - 1] !== currentPageIndex) {
    stack.push(currentPageIndex);
    if (stack.length > 50) stack.shift();
  }
}, [currentPageIndex]);

const goBackByVisitStack = () => {
  const stack = visitStackRef.current;
  if (stack.length < 2) { /* fallback to page order -1 */ return; }
  stack.pop();
  setState(prev => ({ ...prev, currentPageIndex: stack[stack.length - 1] }));
};
```

### #11 #12 碎片同步（前批）
onChange 用 `updateFields` batch 寫 fragmentCount + fragments + targetCode，避免 stale closure 覆蓋。

---

## 驗證

| 項目 | 通過 |
|------|------|
| tsc | ✅ 0 errors（全程） |
| smoke | ✅ 51/51 |
| 接地驗證 | 2 次 + 收尾 1 次 = 3 次 |

### 業主驗證清單

#### #5 道具名稱（無需 db:push）
1. 進 `/admin/games/{gameId}/pages` → 開「條件驗證」元件
2. 看「來源道具」下拉：應同時顯示「名稱」+「id: xxx」font-mono 小字

#### #10 顯示進度 toggle（**需 db:push**）
1. 進 `/admin/games/{gameId}/settings`
2. 應看到新卡片「玩家畫面顯示」+ Switch「顯示進度條」（預設開）
3. 關閉 Switch → 儲存 → 玩家端進該遊戲應**看不到**頂部進度條

#### #2 PWA iOS 提示（無需 db:push）
1. iPhone Safari 開 game.homi.cc 訪問 3 次以上
2. 應彈出底部卡片「加到主畫面（iOS）」+ 指引

#### #7 預覽強制過關（無需 db:push）
1. 進 admin 遊戲預覽模式
2. 底部 PreviewNavBar 應有綠色「強制過關」按鈕
3. 按下：當前元件視為過關、進入下一頁

#### #9 上一頁訪問歷史（無需 db:push）
1. 設一個含 flow_router 跳轉的遊戲（從 #2 跳 #7）
2. 玩家到 #7 後按「上一頁」應回 #2、不是 #6

---

## 已知限制 / 後續

### #1 #3 待業主指認
- **#1 RWD**：業主未指認特定頁面、平台已用 Tailwind 響應式。需業主截圖具體不順畫面
- **#3 按鍵重疊**：未指認哪個按鈕、需業主截圖

### #6 三種可能根因記錄（待業主場景）
- A. progressedPages = 0（玩家進場僅到 page 0）
- B. completed session 優先邏輯（通關後想重玩看到通關畫面）
- C. anonymous userId 異常

---

## 部署需求

- 純前端 + 1 個 schema 變更（show_progress 欄位）
- ⚠️ 需在生產執行 `npm run db:push` 套用 show_progress 欄位
- 其他全部立即生效

---

## 相關文件

- [Admin 頁面優化 + 碎片 bug 修補](2026-05-16-admin-pages-optimization-and-fragment-fix.md)
- [元件 audit follow-up](2026-05-15-component-audit-followup.md)
- 業主原文件：`/Users/hung-macmini/Downloads/250515CHITO問題紀錄及建議.docx`

---

## 狀態

🟢 **已交付** — 等待部署 + 業主驗證 + 提供 #1 #3 #6 的具體場景
