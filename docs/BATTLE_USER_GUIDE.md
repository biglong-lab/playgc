# 🎯 CHITO 對戰中心使用指南

> **版本**：v2026-04-26（23 輪 UX 大升級）
> **正式網址**：<https://game.homi.cc/battle>
> **Commit**：`013dd9f8`

---

## 📖 目錄

1. [對戰中心入口](#1-對戰中心入口)
2. [時段報名流程](#2-時段報名流程)
3. [組隊大廳與邀請](#3-組隊大廳與邀請)
4. [對戰結果與分享](#4-對戰結果與分享)
5. [戰隊管理](#5-戰隊管理)
6. [排行榜與段位](#6-排行榜與段位)
7. [通知中心](#7-通知中心)
8. [賽季歷史](#8-賽季歷史)
9. [開發者參考](#9-開發者參考)

---

## 1. 對戰中心入口

**網址**：`https://game.homi.cc/battle`

進入對戰中心後可以看到：

### 🔴 我的下一場對戰（Sticky Highlight）
當你有報名紀錄時，頂端會顯示「我的報名 (N)」卡片，並特別標示：
- **下一場：⚡ 5 分鐘後**（30 分鐘內的場次，`animate-pulse` 動畫）
- **下一場：今天 14:00**（當天場次）
- **下一場：明天 09:00**（隔天場次）
- **下一場：3 天後 19:00**（一週內）
- **下一場：04-28 14:00**（超過一週）

### 📍 場地列表
- 依場域過濾顯示各場地的開放時段
- 點擊場地卡片查看詳細時段

### 🎯 快速入口
- 登入提示卡片（未登入時顯示）
- 戰績統計 / 排行榜 / 戰隊 / 通知 快速連結

---

## 2. 時段報名流程

**網址**：`/battle/slot/:slotId`

### 資訊展示
- 📅 時段日期、時間、場地
- 👥 **報名人數進度條**（動態色階）：
  - 🔵 主色 — 還沒成局（還需 N 人）
  - 🟢 綠色 — 已成局（已達最低人數）
  - 🔴 紅色 — 已額滿
  - 📏 虛線標記最低成局線（hover 顯示「最低成局：8 人」）
- ⏰ **距離時間 Badge**：即將開戰時 animate-pulse

### 報名對戰

1. 點「我要報名」→ 開啟報名 Dialog
2. 選擇技能等級（預設**中級**，可選初學者/中級/高手）
3. 填寫備註（選填，500 字以內，含 placeholder 提示）
4. 按「確認報名」→ Loader 動畫 + 「報名中...」字樣
5. **報名中禁止關閉 Dialog**（防誤觸中斷）

### 取消報名（防誤觸）

⚠️ 點「取消報名」會開啟 **AlertDialog** 確認：

> **確定要取消報名？**
> 取消後若想再參加，需要重新報名。若該時段已額滿可能無法重新加入。
>
> [不取消] [確認取消]

### 已報名名單
顯示所有報名者：
- 👤 顯示名稱（或部分 userId）
- 🏷️ 隊長標籤（預組小隊隊長）
- ✓ 已確認出席（綠色 CheckCircle）
- 🎖️ 技能等級 Badge（**中文化**：初學者 / 中級 / 高手）

### 預組小隊

1. 已報名後點「建立小隊」→ 填小隊名稱 → 建立
2. 取得**邀請碼**（6 碼英數），顯示在綠色高亮卡片
3. 點**一鍵複製**按鈕 → 分享給朋友
4. 朋友點「用邀請碼加入」→ 輸入邀請碼 → 加入

---

## 3. 組隊大廳與邀請

**網址**：`/team/:gameId` 或 `/f/:fieldCode/team/:gameId`

### 🚀 Deep Link 邀請（最大亮點）

**分享邀請碼流程**：
1. 隊長在組隊大廳 → 看到 6 碼組隊碼
2. 按「🔗 分享」按鈕（Share2 icon）
3. 手機叫出原生分享選單（LINE / Messenger / Instagram / ...）
4. 分享的訊息格式：
   ```
   加入我的隊伍！組隊碼：ABC123
   https://game.homi.cc/team/xyz?code=ABC123
   ```

**朋友收到邀請**：
1. 點連結 → 自動開啟組隊大廳
2. ✨ URL 的 `?code=ABC123` **自動填入邀請碼**
3. ✨ Join Form **自動展開**
4. 🎮 顯示 Toast：「🎮 您被邀請加入隊伍 / 邀請碼：ABC123（已自動填入）」
5. 按「加入隊伍」→ 秒進！

### 邀請碼格式保護
- 只接受 4-8 位英數（`[A-Z0-9]{4,8}`）
- 自動轉大寫
- 防注入：特殊字元 / URL encoded / 空白一律拒絕

### 組隊碼卡片功能
- 📋 **複製**按鈕（有 Check 動畫反饋）
- 🔗 **分享**按鈕（Web Share API 優先，fallback 剪貼簿）
- 動畫：複製成功時 icon 變 Check 2 秒

---

## 4. 對戰結果與分享

**網址**：`/battle/slot/:slotId/result`

### 🏆 結果頁三大區塊

#### A. 勝負結果卡（Hero 區）
- 🏆 大 Trophy icon
- **winningTeam 獲勝！**（大字顯示，隊伍顏色）
- 或「平手！」
- 對戰時長

#### B. 隊伍分數
- 兩隊並排顯示
- 獲勝隊伍加**橙色邊框**高亮

#### C. 我的戰績（強化版 5 欄）
| 指標 | 顏色 |
|-----|------|
| 得分 | 白 |
| 命中 | 白 |
| 淘汰 | 🟢 綠色 |
| 陣亡 | 🔴 紅色 |
| **K/D** | 白（0 陣亡用 ∞）|

積分變動：+15（綠色 ↑）/ -10（紅色 ↓）/ 0（灰）

### 🚀 底部 3 大 CTA

1. **📤 分享戰績**（主按鈕）
   - Web Share API：分享文字示例
     ```
     我在水彈對戰 獲勝 🏆！得分 25，淘汰 5，積分 +15
     ```
   - Fallback：複製連結 + 文字到剪貼簿

2. **⚔️ 再戰一場** → `/battle`

3. **📜 對戰歷史** → `/battle/history`（需登入）

---

## 5. 戰隊管理

### 戰隊詳情（`/battle/clan/:clanId`）

#### 統計卡
- 💎 積分 / 🟢 勝 / 🔴 負 / 勝率 %

#### 加入 / 離開
- **加入戰隊**：按鈕含 Loader + 「加入中...」字樣；戰隊滿時按鈕文字變「戰隊已滿」
- **離開戰隊**：⚠️ AlertDialog 防誤觸：
  > 確定要離開戰隊？
  > 離開後您的個人積分仍保留，但會失去戰隊內的歷史紀錄。若想再加入需要重新申請。

#### 成員列表
- 🟡 隊長（Crown）/ 🔵 幹部（Star）/ 隊員
- 依角色排序：隊長 → 幹部 → 隊員
- 自己標「(你)」

### 管理面板（ClanManagePanel）— 隊長/幹部專用

**隊長可做**：
- 升/降級成員（member ↔ officer）
- 轉讓隊長（AlertDialog 確認）
- ⚠️ **踢出成員**（AlertDialog 防誤觸）：
  > 確定要踢出此成員？
  > 你即將把「小明」踢出戰隊。此成員需要重新申請才能再次加入。

**幹部可做**：
- 踢出隊員（member）

### 建立戰隊（`/battle/clan/create`）
- 戰隊名稱、Tag（2-5 字元英數中文）、描述
- Tag 格式驗證（正則）
- 成功後跳轉到戰隊詳情頁

---

## 6. 排行榜與段位

**網址**：`/battle/ranking`

### 我的排名卡（Sticky 頂部）
- **我的段位**：黃金 **#5**（顯示名次 + 段位）
- **積分**：1250
- **總場 / 勝率 / 連勝 / MVP** 四欄統計
- 🔥 連勝 > 0 時 Flame icon

### 🚀 距離下一名提示（最有動力的設計）
```
📈 距離 #4 玩家小華 還差 25 分
```
讓玩家有具體向上挑戰目標。

### 全場域排行
- 依 rating 排序
- **前三名**金/銀/銅 Crown icon
- 我的 row 加 `ring-2 ring-primary` 高亮
- 段位用 `TIER_BG` 色塊

### 🎯 「定位到我」按鈕
- 排名 **#6 以後**才顯示
- 點擊 → `scrollIntoView({ behavior: "smooth", block: "center" })`
- 有 `scroll-mt-20` 避免 sticky header 蓋住

---

## 7. 通知中心

**網址**：`/battle/notifications`

### 未讀視覺強化
- 🔵 左邊小色塊（1px 主色 border-l）
- 🔵 pulse 圓點（animate-pulse）
- **粗體標題**（未讀）vs 細體（已讀）
- 已讀卡片 opacity-60

### Sticky 全部已讀按鈕
- 有未讀時顯示 sticky banner：
  ```
  [N 則未讀]                    [CheckCheck] 全部已讀
  ```
- Badge 用 `default` variant 強調

### 點擊行為
- **有 actionUrl** → 自動標記為已讀 + 跳轉
- **無 actionUrl** → 手動點 Check 按鈕標記

### Empty State
- 🔔 Bell icon（opacity-30）
- 「目前沒有通知」
- 副文字：「報名對戰、戰隊邀請、賽季結算等都會通知你」
- 🚀 CTA：[⚔️ 前往對戰中心]

---

## 8. 賽季歷史

**網址**：`/battle/season-history`

### 🏆 歷屆綜合戰績（頂部總覽）
| 統計 | 說明 |
|-----|------|
| 參加賽季 | `history.length` |
| 最佳名次 | `Math.min(rank)` 跨所有賽季 |
| 最高積分 | `Math.max(finalRating)` |
| **最高段位** | 用 tierOrder 排序（bronze=1 ... master=6）|
| **總勝率** | 跨賽季累計 |

### 各賽季卡片
- 賽季名稱 + 編號 + 起迄日期
- 🥇 前三名 Medal icon（金/銀/銅）
- 段位 Badge（用 TIER_BADGE）
- 最終積分
- 勝 / 負 / 平 統計（綠/紅/灰）

### Empty State（未參加賽季）
- 🏆 Trophy icon
- 「尚無賽季紀錄」
- 提示：「參加對戰累積排名，賽季結束時會保存紀錄」
- 🚀 CTA：[⚔️ 前往對戰中心]

---

## 9. 開發者參考

### 共用 lib

#### `client/src/lib/battle-labels.tsx`
```ts
// 時段狀態
slotStatusLabel(status) // "開放報名" / "已成局" / ...
slotStatusBadge(status) // JSX Badge

// 技能等級
skillLevelLabel(level) // "初學者" / "中級" / "高手" / "未填"

// 段位
tierBgClass(tier) // Tailwind class (卡片用)
tierBadgeClass(tier) // Tailwind class (Badge 用)
```

#### `client/src/lib/battle-time.ts`
```ts
// 時段距離時間
formatTimeUntil(slotDate, startTime, endTime, { now })
// → "⚡ 5 分鐘後" / "今天 14:00" / "3 天後 19:00" / "對戰中" / "已結束"

// 是否即將開戰（30 分鐘內）
isImminentSlot(slotDate, startTime, { now })

// 相對時間
formatTimeAgo(date, { now })
// → "剛剛" / "5 分鐘前" / "3 天前" / "1 年前"
```

### API 使用
所有玩家端 Battle API 統一使用 `apiRequest`：
```ts
import { apiRequest } from "@/lib/queryClient";

// GET
const res = await apiRequest("GET", "/api/battle/my/history?limit=30");
const data = await res.json();

// POST with body
await apiRequest("POST", `/api/battle/clans/${clanId}/join?fieldId=${fid}`);

// DELETE
await apiRequest("DELETE", `/api/battle/clans/${clanId}/leave`);
```

**優點**：
- 自動加 Firebase Bearer token
- 自動加 `credentials: "include"`
- 401 → 「登入已失效，請重新登入」友善訊息
- 403 → 「此操作需要更高權限，請聯絡場域管理員升級您的角色」

### 測試
```bash
# 跑 Battle 相關全部測試
npx vitest run client/src/lib/__tests__/ \
  client/src/pages/team-lobby/__tests__/ \
  client/src/pages/__tests__/MatchViews.test.tsx \
  client/src/pages/__tests__/TeamLobby.test.tsx

# 結果：223/223 ✅
```

### 部署
```bash
# 本地 push
git push origin main

# 伺服器（SSH）
ssh root@172.233.89.147
cd /www/wwwroot/game.homi.cc
git pull origin main
GIT_SHA=$(git rev-parse --short HEAD) docker compose -f docker-compose.prod.yml up -d --build app

# 驗證
curl -s https://game.homi.cc/api/version
```

---

## 📈 本次 v2026-04-26 升級重點

### 統計數字
- ✅ **20+ 個玩家端頁面/元件**重構
- ✅ **107 個新增單元測試**
- ✅ **6 個 pre-existing 測試修復**
- ✅ 223/223 測試通過
- ✅ Battle 玩家端 raw fetch/authFetch 殘留：**0**

### 體驗亮點
1. **3 個防誤觸 Dialog**（取消報名 / 離開戰隊 / 踢出成員）
2. **5 個 Empty State CTA**（引導使用者下一步）
3. **3 個統計總覽**（History / Achievements / SeasonHistory）
4. **1 個排名動力提示**（距離下一名還差 N 分）
5. **Deep link 邀請**（?code=ABC123 自動帶入）
6. **Web Share API**（手機原生分享到 LINE）

### 效能優化
- 分散的 fetch → 統一 apiRequest（程式碼少 70%）
- 重複定義 → 共用 lib（battle-labels + battle-time 200+ 行）
- 1 個統一錯誤處理（throwIfResNotOk）

---

_最後更新：2026-04-26_
_作者：Hung（大哉實業） / Claude Code_
