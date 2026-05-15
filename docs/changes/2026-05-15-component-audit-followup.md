# 元件優化 follow-up — 立即 / 本週批次交付紀錄 + 剩餘 pattern

> 來源：[2026-05-15 Top 10 深度盤點](2026-05-15-component-audit-top10.md)
> 狀態：**🟢 立即批次完成 / 🟢 本週批次部分完成**
> 部署：auto-checkpoint 已 push、純前端改動、不需 db:push

---

## 一、立即批次（已交付 ✅）

| 項 | 變動 |
|----|------|
| photo_burst console.log | 6 → 0（warn/error 11+1 保留） |
| 元件層 console.log（VideoPage / GameCompletion / PhotoBeforeAfter ×2 / PhotoSuccessView ×2） | 6 個移除 |
| photo_team / compare / spot console | 審視後保留（均為 warn 異常追蹤、合理） |
| VotePage console.log | 保留（已被 `if(DEV)` 包住、有意保留） |
| Hook 層 console.log（useQrScanner / usePhotoCamera） | 保留（debug 用） |
| component-scenarios 已標 | 18 → 26（+8 個 Top 10 元件） |
| Top 10 情境覆蓋 | 2/10 → 10/10 ✅ |

---

## 二、本週批次（已交付 ✅）

### a11y 補強（4 元件 / 共 16 處）

| 元件 | a11y 修補項 |
|------|------------|
| DialoguePage | 跳過按鈕 aria-label + 對話 role="log"/aria-live + 進度 role="progressbar"+aria-valuenow + 下一句按鈕 aria-label |
| PhotoBurstFlow | 倒數 role="status"/aria-live="assertive" + 拍照進度 role="status"/aria-live="polite" |
| ConditionalVerifyPage | input htmlFor/id/aria-label/aria-invalid/aria-describedby + alert role="status"/aria-live + 2 個 button aria-label |
| PhotoArStickerFlow | 「等找到臉」status live + 返回按鈕 aria-label + 開始拍照 aria-label/aria-busy + 載入失敗 status live |

**接地驗證**：tsc 0 / smoke 51/51 / 接地通過

---

## 三、待續（剩 6 元件 a11y + 全 10 元件動畫）

### 還缺 a11y 的 6 個元件

| 元件 | 路徑 | 補強重點 |
|------|------|---------|
| shooting_mission | solo/ShootingMissionPage.tsx | 倒數計時 aria-live + 命中通知 aria-live + 操作按鈕 aria-label |
| choice_verify_race | multi/ChoiceVerifyRacePage.tsx | 倒數 aria-live + 排名變化 aria-live + 答題按鈕 aria-label |
| gps_mission | solo/GpsMissionPage.tsx | 距離/方向 aria-live + 抵達通知 aria-live + GPS 拒絕 fallback aria-describedby |
| photo_team | multi/PhotoTeamGather.tsx | 成員到齊狀態 aria-live + 拍照倒數 aria-live |
| photo_spot | solo/PhotoSpotFlow.tsx | 已有 aria=3、可加 focus management + spot 引導 aria-describedby |
| photo_compare | solo/PhotoCompareFlow.tsx | 前後對比 alt 文字 + 對比結果 aria-live |

### 動畫缺（10/10 全缺、需加 framer-motion）

**所有 Top 10 元件 0 個用 framer-motion**、僅靠 CSS transition。

---

## 四、a11y 補強 Pattern（業主後續批量複製用）

### Pattern 1：倒數 / 即時通知

```tsx
<div
  role="status"
  aria-live="assertive"   // 重要通知用 assertive、一般用 polite
  aria-atomic="true"
>
  倒數 {n}
</div>
```

### Pattern 2：進度條

```tsx
<div
  role="progressbar"
  aria-valuenow={current}
  aria-valuemin={1}
  aria-valuemax={total}
  aria-label={`進度：${current} / ${total}`}
>
  {/* 視覺進度元素都加 aria-hidden="true" */}
</div>
```

### Pattern 3：按鈕

```tsx
<Button
  onClick={handleAction}
  aria-label={isLoading ? "處理中..." : "明確的動作描述"}
  aria-busy={isLoading}
  disabled={isLoading || !valid}
>
  <Icon aria-hidden="true" />
  按鈕文字
</Button>
```

### Pattern 4：Input + 錯誤提示

```tsx
<label htmlFor="input-id">標籤</label>
<Input
  id="input-id"
  aria-label="..."
  aria-invalid={hasError}
  aria-describedby={hasError ? "input-error" : undefined}
/>
{hasError && (
  <p id="input-error" role="alert">錯誤訊息</p>
)}
```

### Pattern 5：警告 / 狀態通知

```tsx
<div
  role="status"        // 或 role="alert" 緊急
  aria-live="polite"
>
  <Icon aria-hidden="true" />
  訊息內容
</div>
```

---

## 五、動畫 Pattern（framer-motion 已裝 v11）

### Pattern A：stage 切換淡入淡出

```tsx
import { motion, AnimatePresence } from "framer-motion";

<AnimatePresence mode="wait">
  {stage === "intro" && (
    <motion.div
      key="intro"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
    >
      {/* intro UI */}
    </motion.div>
  )}
  {stage === "shooting" && (
    <motion.div key="shooting" /* 同上 */ >
      {/* shooting UI */}
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern B：數字 / 排名變化（CrossFade）

```tsx
<AnimatePresence mode="popLayout">
  <motion.span
    key={scoreValue}
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 10 }}
  >
    {scoreValue}
  </motion.span>
</AnimatePresence>
```

### Pattern C：列表 reorder（多人排行）

```tsx
<motion.ul layout>
  {sorted.map((player) => (
    <motion.li key={player.id} layout>
      {player.name}：{player.score}
    </motion.li>
  ))}
</motion.ul>
```

---

## 六、預估剩餘工時

| 任務 | 工時 |
|------|------|
| 剩 6 個元件 a11y（依 Pattern 1-5 套用） | ~3-4h |
| 10 元件加 framer-motion 基本切場（依 Pattern A） | ~4-5h |
| 排名 / 分數變化動畫（Pattern B，適用 shooting / choice_race） | ~1-2h |
| 多人排行 layout 動畫（Pattern C，適用 choice_verify_race） | ~1h |

**總計 ~9-12h** — 業主可分批執行、不需 loop。

---

## 七、不在本批

- ❌ 本月批次（拆 photo_burst / photo_ar / 補 conditional 與 shooting 錯誤處理）— 業主選擇暫不動
- ❌ useMemo / useCallback 補強（業主選擇跳過、避免 stale closure 風險）
- ❌ Loading state 顯式命名（太抽象、需逐元件 e2e 驗證 stage 是否已涵蓋）
- ❌ 25 個非 Top 10 元件的盤點（留待業主指示是否擴充）

---

## 八、部署狀態

- ✅ 所有改動已 auto-checkpoint commit + push
- ✅ 純前端改動（無 schema / 無新 endpoint）
- ⚠️ **需要部署到生產才能讓真實使用者看到 a11y 改善**
- 建議：業主下次說「部署」時、走標準流程 SSH + docker rebuild（不需 db:push）

---

## 九、業主驗證清單

部署後實機測試：
- [ ] 開啟 VoiceOver / TalkBack 進入 dialogue 元件、聽進度報讀
- [ ] 開啟 VoiceOver 進入 photo_burst 倒數、聽 3-2-1 即時播報
- [ ] 開啟 VoiceOver 進入 conditional_verify、輸入錯誤密碼聽錯誤通知
- [ ] 開啟 VoiceOver 進入 photo_ar、聽「等找到臉」即時通知
- [ ] 確認 4 個元件原本互動行為**無變化**（純 a11y 屬性、不改 UX）

---

## 相關文件

- [Top 10 深度盤點](2026-05-15-component-audit-top10.md)
- [平台優化計劃 P0-P3 全包](2026-05-14-platform-optimization-comprehensive.md)
- [紅線 #11 元件對應情境](../../CLAUDE.md)
