# 4 項實機 UX 優化 — 2026-05-09

> 範圍：PhotoTeam / Lock / 頁面 BGM / 整場 BGM
> 狀態：✅ 已部署生產（commit `32750517`）
> 觸發：業主實機測試後反映

---

## 背景

業主跑活動後反映 4 項使用體驗問題、優先處理：

1. 團體合照不能跳過（卡住流程、隊長若不想拍就無法繼續）
2. 密碼鎖轉盤數字顛倒、且切下一位時轉盤沒復歸
3. 頁面 BGM 設定只能貼 URL、沒上傳按鈕
4. 整場 BGM 設定也只能貼 URL、沒上傳按鈕

---

## 影響範圍

| 模組 | 變動 |
|------|------|
| `client/src/components/game/multi/PhotoTeamGather.tsx` | +20 / -7 行 |
| `client/src/components/game/solo/LockPage.tsx` | +29 / -15 行 |
| `client/src/pages/game-editor/PageConfigEditor.tsx` | +18 / -6 行 |
| `client/src/components/admin-games/GameFormDialog.tsx` | +52 / -6 行 |
| `client/src/pages/AdminGames.tsx` | +1 |
| `client/src/pages/AdminStaffGames.tsx` | +1 |
| `client/src/hooks/useGameMediaUpload.ts` | +115（新檔） |

**總計**：7 檔修改 / 241 行新增 / 43 行刪除

---

## 解決方案

### 1. PhotoTeam 加「先跳過」+ 引導文字

`PhotoTeamGather.tsx` intro 畫面加 ghost button：

```tsx
<Button variant="ghost" size="sm" onClick={handleContinue} data-testid="btn-gather-skip">
  先跳過此題、稍後再拍 →
</Button>
```

文字引導改為：
- 標題「📸 怎麼拍（只需要一個人拍、整隊共享）」清楚說明
- 提示「想留個人照？可以先跳過此題、之後在原頁面用相機拍個人留念」

既有「隊長拍、其他人自動跳過」邏輯不動（已是 `captureMode='gather'` 預設）。

### 2. Lock 轉盤鎖修復（兩個 bug）

#### 數字顛倒
原版用單層 div + transform chain：
```javascript
transform: `rotate(${num*36}deg) translateY(-60px) rotate(-${num*36}deg) translate(-50%, -50%)`
```
順序錯誤導致字體位置不對。

改成兩層 div：
```jsx
<div style={{ transform: `rotate(${angle}deg)` }}>  {/* 外層繞父中心轉 */}
  <span style={{ top: -60, transform: `translate(-50%, 0) rotate(${-angle}deg)` }}>
    {num}                                            {/* 內層自轉補正字體朝上 */}
  </span>
</div>
```

#### 下一位沒復歸
「下一位」按鈕 onClick 加 `setDialRotation(0)`、跟 handleClear 一致。

### 3. 頁面 BGM 加上傳按鈕

`PageConfigEditor.tsx` 「此頁面 BGM 音樂網址」區塊加 `MediaUploadButton`，複用既有機制（透過 PageConfigEditor 內已定義的 component prop）。

### 4. 整場 BGM 加上傳功能

#### 新增 hook：`client/src/hooks/useGameMediaUpload.ts`
抽自 `game-editor/index.tsx:61-139`、game-scope cloudinary 上傳通用：

```typescript
const { handleUpload, isUploading } = useGameMediaUpload(gameId);
// handleUpload(file, "audio") → POST /api/admin/games/:gameId/cloudinary-media
```

限制：
- image ≤ 10MB / video ≤ 50MB / audio ≤ 30MB
- MIME prefix 必須對應
- 必須先有 `gameId`（新建時 toast「請先儲存遊戲」）

#### `GameFormDialog.tsx` 加上傳按鈕
- 編輯模式（`isEditing && editingGameId`）→ 顯示 Upload 按鈕
- 新建模式 → 提示「上傳檔案請先儲存遊戲、再回編輯模式」

#### `AdminGames.tsx` + `AdminStaffGames.tsx`
傳入 `editingGameId={ctx.editingGame?.id}` 給 GameFormDialog。

---

## 為什麼整場 BGM 編輯模式才能上傳

後端 cloudinary 端點 `POST /api/admin/games/:gameId/cloudinary-media`、scope 到 game folder。新建遊戲時 `gameId` 不存在、無法上傳。

這是合理 trade-off：
- 新建時可貼 URL（外部 audio）
- 儲存後可在編輯模式上傳檔案

未來若需新建時上傳，可加「臨時 admin folder」端點。但目前無需求、不做。

---

## 驗證

| 驗證項 | 結果 |
|--------|------|
| TypeScript 編譯 | ✅ 通過 |
| 單元測試 | ✅ 1061 個全綠 |
| 生產 commit | ✅ `32750517` 部署 |
| Container 健康 | ✅ Up healthy |
| HTTP 回應 | ✅ 200 / 0.33s |
| 4 個關鍵檔案標誌 | ✅ 全部在生產（grep 確認）|

---

## 業主實機驗證清單

| # | 操作 | 期望 |
|---|------|------|
| 1 | 進有 photo_team 的多人遊戲 | intro 畫面有「先跳過此題」ghost button、點下去進下一頁 |
| 2 | 進 lock dial 模式遊戲 | 數字 0-9 正確朝上、轉盤+下一位後轉盤回 12 點鐘 |
| 3 | 編輯 page → 找「此頁面 BGM」 | URL 輸入框旁有 ⬆ Upload 按鈕、可選音訊檔上傳 |
| 4 | 編輯遊戲（不是新建）→「整場 BGM」 | URL 輸入框旁有 ⬆ Upload 按鈕、可選音訊檔上傳 |
| 4b | 新建遊戲 →「整場 BGM」 | 沒有 Upload 按鈕、提示「先儲存遊戲、再回編輯模式」 |

---

## 未做（保留下次評估）

- **PhotoTeam 隊長重拍按鈕**：風險高（會覆蓋整隊合照、可能 race），等業主測「跳過」後再評估
- **玩家「個人拍照」獨立模式**：超出範圍、可用既有 `photo_mission` page_type
- **新建遊戲時上傳 BGM**：需新增「臨時 admin folder」cloudinary 端點，目前無需求

---

## 相關文件

- 前次接手指南：[2026-05-09-next-action-guide.md](2026-05-09-next-action-guide.md)
- ADR-0017 Loop 護欄：[../decisions/0017-loop-mode-safeguards.md](../decisions/0017-loop-mode-safeguards.md)
- BGM 系統初版：2026-05-07 page bgm + game bgm 引入
