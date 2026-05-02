# 🏆 隊伍系統完整設計（Squad System Design）

> **版本**：v1.0 — 設計稿（等待最終確認後實作）
> **作者**：Hung（大哉實業）+ Claude Code
> **日期**：2026-04-26
> **狀態**：📝 設計階段
> **目的**：取代現有 4 種組隊類型（Team / BattleClan / BattlePremadeGroup / Match），統一為「Squad 隊伍」，達到推展、留存、簡化操作三重目標

---

## 📖 目錄

1. [核心哲學](#1-核心哲學)
2. [隊伍概念（取代 4 種類型）](#2-隊伍概念取代-4-種類型)
3. [5 種計分模式](#3-5-種計分模式)
4. [體驗點數系統](#4-體驗點數系統)
5. [場次計算規則](#5-場次計算規則)
6. [ELO 公式與分數計算](#6-elo-公式與分數計算)
7. [表現加成（Performance Bonus）](#7-表現加成performance-bonus)
8. [6 個排行榜](#8-6-個排行榜)
9. [段位與徽章](#9-段位與徽章)
10. [訊息來源（系統自動 vs 人為）](#10-訊息來源系統自動-vs-人為)
11. [水彈對戰結算（3 種模式）](#11-水彈對戰結算3-種模式)
12. [跨場域推展機制](#12-跨場域推展機制)
13. [招募與超級隊長](#13-招募與超級隊長)
14. [場域歡迎隊伍](#14-場域歡迎隊伍)
15. [公開 Squad 分享頁](#15-公開-squad-分享頁)
16. [留存通知流](#16-留存通知流)
17. [隊名規則](#17-隊名規則)
18. [隊伍生命週期](#18-隊伍生命週期)
19. [防作弊規則](#19-防作弊規則)
20. [資料庫架構](#20-資料庫架構)
21. [UX 設計](#21-ux-設計)
22. [遷移計畫](#22-遷移計畫)
23. [工程量估算](#23-工程量估算)
24. [風險與緩解](#24-風險與緩解)
25. [實作檢查清單](#25-實作檢查清單)
26. [獎勵轉換節點（Reward Conversion Node）⭐](#26-獎勵轉換節點reward-conversion-node)

---

# 1. 核心哲學

## 1.1 一隊伍、多戰場

> **「一個隊名，打遍天下。所有戰績累積到同一個身分。」**

```
        🏆 Squad 隊伍（長期資產）
   名稱・Tag・隊徽・隊長・成員・戰績・徽章
                    │
       ┌────────────┼─────────────┬──────────┐
       ▼            ▼              ▼          ▼
   水彈對戰    一般遊戲      競技/接力   未來新類型
   (戰場 1)   (戰場 2)      (戰場 3)    (戰場 N)
```

## 1.2 結果決定狀態（不分臨時/永久）

不要讓使用者選「臨時隊伍」還是「長期隊伍」—— 這是工程師詞彙，不是玩家詞彙。

```
打 0 場 → 自然是新隊
打 1-9 場 → 新人榜
打 10-99 場 → 主排行榜
打 100+ 場 → 名人堂
30+ 天沒活動 → 自動休眠（仍保留）
```

**狀態自動轉換**，使用者完全無感。

## 1.3 場次中性、分數分流

| 維度 | 處理方式 | 目的 |
|-----|---------|------|
| **場次** | 跨遊戲類型統一計算 | 0 公式爭議、推展導向 |
| **分數（rating）** | 各遊戲類型獨立計算 | 高手有舞台、不混算 |
| **體驗點數** | 純體驗類專用 | 包容無勝負遊戲 |

## 1.4 推展優先於競技

平台目標是**讓玩家到處玩、帶人玩**，不是純競技：
- 跨場域場次 × 1.2
- 新場域首航 × 2
- 招募新人雙向獎勵
- 超級隊長機制

## 1.5 商業閉環（遊戲 → 點數 → 券 → 消費）⭐

**遊戲不只是娛樂，而是「商業價值產生器」**：

```
玩遊戲 → 累積點數/戰績 → 自動觸發轉換規則 → 獲得折價券
   ↑                                              ↓
   └────────────  消費 / 回流  ←──────────────────┘
```

詳見 [§26 獎勵轉換節點](#26-獎勵轉換節點reward-conversion-node)。

---

# 2. 隊伍概念（取代 4 種類型）

## 2.1 現有 4 種類型

| 類型 | 資料表 | 使用情境 | 生命週期 |
|-----|-------|---------|---------|
| Team 隊伍 | `teams` + `team_members` | 一般遊戲 team 模式 | 短期（一場）|
| Match 參賽者 | `matches` | 競技/接力遊戲 | 短期（一場）|
| BattlePremadeGroup | `battle_premade_groups` | 水彈對戰時段預組 | 中期（綁時段）|
| BattleClan 戰隊 | `battle_clans` + `battle_clan_members` | 水彈長期組織 | 長期（永久）|

## 2.2 統一為 Squad

```
所有組隊操作 → 建立 / 加入一個 Squad
所有戰績紀錄 → 寫入該 Squad 的 records
所有排行榜 → 用 Squad 為單位
```

**不再有 4 種類型**，只有 **Squad** + **戰場類型**。

## 2.3 隊伍 vs 個人關係

```
玩家 A
  ├ 是 Squad「火焰戰士」的隊長 (1 個 Squad)
  ├ 是 Squad「浪花一現」的隊員 (1 個 Squad)
  └ 是 Squad「壽星團」的隊員 (1 個 Squad)

→ 玩家可加入多個 Squad
→ 但只能是 1 個 Squad 的隊長（防止寡頭）
→ 每場遊戲開始前選擇要用哪個 Squad 出戰
```

## 2.4 隊伍狀態（自動轉換）

```
🌱 新隊伍 (場次 = 0)
  ↓ 打 1 場
🌿 新人 (1-9 場) — 上新人榜
  ↓ 打 10 場
🔵 活躍 (10-49 場) — 上主排行榜
  ↓ 打 50 場
💜 資深 (50-99 場)
  ↓ 打 100 場
🌟 傳奇 (100+ 場) — 上名人堂
  ↓ 30 天無活動
😴 休眠 (仍保留戰績、隊名鎖定)
  ↓ 任一隊員回來打
🌿 喚醒 (回到活躍狀態)
  ↓ 隊長解散 / 90 天無活動
☠️ 解散 (戰績凍結、隊名鎖 180 天)
```

**每次升級發通知**：「🎉 火焰戰士升上活躍！主排行榜第 12 名！」

---

# 3. 5 種計分模式

> **「不是所有遊戲都要分輸贏，但都該有意義。」**

## 3.1 Mode A：PvP 對戰

**適用**：水彈隊際對戰、競技通關、接力賽

**特徵**：
- 有對手（隊伍 vs 隊伍）
- 雙方都有 rating
- 用 ELO 公式

**範例**：火焰戰士 vs 浪花一現

## 3.2 Mode B：PvE 完成

**適用**：冒險遊戲、解謎、QR 闖關

**特徵**：
- 隊伍 vs 關卡
- 用「期望完成度模型」算分
- rating 越高，期望越高

**範例**：火焰戰士打「賈村冒險關」

## 3.3 Mode C：純體驗（無勝負）⭐

**適用**：水彈嘉年華、觀光導覽、生日派對、親子體驗

**特徵**：
- 不算 rating
- 算「體驗點數」+ 場次
- 完全包容無勝負設計

**範例**：壽星團包場玩水彈派對

## 3.4 Mode D：合作達成

**適用**：團隊解謎、共同任務

**特徵**：
- 全隊共享分數
- 達成 → 加分
- 未達成 → 不扣分（鼓勵合作）

**範例**：8 人團隊解謎找寶藏

## 3.5 Mode E：個人挑戰

**適用**：速通、極限挑戰、訓練

**特徵**：
- 比較隊伍歷史最佳
- 突破 → 加分 + 徽章
- 沒突破 → 不扣分

**範例**：水彈打靶速通

## 3.6 模式選擇指南

遊戲設計者建立遊戲時選擇：

```
遊戲名稱：[輸入]
遊戲類型：[battle / adventure / ...]
計分模式：
  ( ) 🥊 PvP 對戰     有勝負，ELO 算分
  ( ) 🎯 PvE 完成     有任務，期望模型
  ( ) 🎉 純體驗       無勝負，給點數
  ( ) 🤝 合作達成     共同任務
  ( ) 🏃 個人挑戰     自我突破
```

---

# 4. 體驗點數系統

## 4.1 計算公式

純體驗模式專用，**不影響 rating**：

```
基礎點數 = 100（完整參與 1 場 ≥ 60 秒）

最終點數 = 基礎 × 跨場域加成 × 首航加成 + 各項 bonus
```

## 4.2 加成項目

| 行為 | 加成 |
|-----|------|
| 完整參與 1 場 | 100 點（基礎）|
| 跨場域（客場）| × 1.2 |
| 新場域首航 | × 2 |
| 拍紀念照 | +20 |
| 邀請新人來 | +50 |
| 隊員 ≥ 5 人（聚會獎勵）| +30 |
| 親子家庭隊（指定徽章）| +15 |

## 4.3 與 rating 並行

```
火焰戰士的數據面板
├ 🏆 rating（各遊戲類型）
│   ├ 水彈：1480 分（黃金）
│   ├ 冒險：1680 分（鑽石）
│   └ 競技：1280 分（白銀）
└ 🌈 體驗點數（總計）
    └ 累計 2850 點 → 上常客榜
```

**雙軌獎勵**：技術派玩家追 rating，休閒派玩家追體驗點數。

---

# 5. 場次計算規則

## 5.1 「一場」的定義

### ✅ 算一場
- session 完成且持續 ≥ 60 秒
- 至少 2 名玩家實際參與
- session 結果寫入資料庫

### ❌ 不算
- session < 60 秒（快進快出）
- 隊員只有 1 人（空殼）
- 30 分鐘內 vs 同對手第 6 場+
- 比賽過程斷線且未完成結算

## 5.2 跨場域加成（推展核心）

| 場域類型 | 場次倍率 |
|---------|---------|
| 主場（home_field）| 1.0 場 |
| 客場（其他場域）| **1.2 場** |
| 全新場域首航 | **2.0 場** |

**例**：
- 火焰戰士主場是賈村
- 在賈村打 1 場 = 1 場
- 在後浦（首次）打 1 場 = 2 場
- 在後浦（第 2+ 次）打 1 場 = 1.2 場

## 5.3 首航獎勵

第一次在某場域打 → **× 2 場次 + 「首戰場域」徽章**

→ 直接推動探索新場域。

## 5.4 每日上限

```
單一隊伍每日最多計 10 場
（超出仍可玩，但不入榜）
```

防止機器人 / 不正常 farm。

---

# 6. ELO 公式與分數計算

## 6.1 基礎 ELO 公式

```ts
// 預期勝率
expected = 1 / (1 + 10^((opponentRating - myRating) / 400))

// 實際結果
actual = win ? 1.0 : (draw ? 0.5 : 0.0)

// rating 變動
delta = K × (actual - expected)
```

`K` 是學習率，新手大、老手小（防 farm）。

## 6.2 PvP 計算範例

```
我方 rating: 1450
對方 rating: 1500（略強）
expected = 1 / (1 + 10^(50/400)) = 0.43

我贏 → actual = 1.0
delta = 32 × (1.0 - 0.43) = +18 分

新 rating = 1468
```

**贏弱者加少分**（防 farm），**贏強者加多分**（鼓勵挑戰）。

## 6.3 PvE 期望模型

PvE 沒有對手，把「rating」對應到「期望完成度」：

| Rating | 期望完成度 |
|--------|-----------|
| 1000-1199（青銅）| 50% |
| 1200-1399（白銀）| 65% |
| 1400-1599（黃金）| 80% |
| 1600-1799（鑽石）| 90% |
| 1800+（名人）| 95% |

**範例**：
```
我方 1450（黃金）→ 期望 80%
實際完成 95%（超期望）

delta = 32 × (0.95 - 0.80) = +4.8 分
新 rating = 1454.8

實際完成 60%（不及格）
delta = 32 × (0.60 - 0.80) = -6.4 分
新 rating = 1443.6
```

## 6.4 名次型計算（競技 / 接力）

```
8 隊參賽，我拿第 1
名次轉換：
  第 1 名 actual = 1.0
  最後 1 名 actual = 0.0
  其他線性插值

expected = 0.5（依平均對手 rating）
我拿第 1 → actual = 1.0
delta = 32 × (1.0 - 0.5) = +16 分
```

## 6.5 K 值衰減（防 farm）

```ts
function getKValue(totalGames: number): number {
  if (totalGames <= 10) return 32;   // 新手
  if (totalGames <= 50) return 24;   // 中段
  return 16;                          // 老手
}
```

**邏輯**：
- 新手變動大 → 快速找到應有水準
- 老手變動小 → 不能靠刷弱隊衝分

---

# 7. 表現加成（Performance Bonus）

## 7.1 加成清單

| 表現指標 | Bonus | 說明 |
|---------|-------|------|
| 🏆 MVP | +5 | 隊伍裡有 MVP 玩家 |
| 💯 完美勝利（0 死亡）| +3 | 對戰類專用 |
| 🎯 完成度 100% | +2 | PvE 完成類專用 |
| ⚡ 用時短於平均 50% | +2 | 任何類型 |
| 🤝 全員存活 | +2 | 對戰類團隊默契 |
| 🏞️ 客場加成 | × 1.2（總額）| 跨場域 bonus |
| 🌟 首航加成 | × 2.0（總額）| 新場域第 1 次 |

## 7.2 計算順序

```ts
function calcRatingChange(...) {
  // Step 1: 基礎 ELO
  let delta = eloDelta(myRating, opponentRating, result);

  // Step 2: 表現 bonus（加法）
  if (performance.isMvp) delta += 5;
  if (performance.deaths === 0) delta += 3;
  if (performance.completionRate === 1.0) delta += 2;
  if (performance.duration < avgDuration * 0.5) delta += 2;

  // Step 3: 場域加成（乘法）
  if (isCrossField) delta *= 1.2;
  if (isFirstVisit) delta *= 2.0;

  // Step 4: 對手強度限制
  delta = capDeltaByOpponentDiff(delta, myRating - opponentRating);

  // Step 5: K 值衰減
  delta *= getKMultiplier(squad.totalGames);

  return Math.round(delta);
}
```

## 7.3 實際範例

```
情境：火焰戰士在後浦（客場）打水彈對戰

基礎 ELO：+18 分
+ MVP +5
+ 0 死亡 +3
合計：+26 分

× 客場 1.2
= +31.2 分（取整 +31）
```

**強烈鼓勵跨場域 + 出色表現**。

---

# 8. 6 個排行榜

| 排行榜 | 條件 | 主指標 | 心理價值 |
|-------|-----|-------|---------|
| 🔥 **場次榜** | 全部 | 總場次 | **「打就上榜」** |
| 💎 **名人堂** | 100+ 場 | 場次降序 | 老隊永久榮譽 |
| 🌱 **新人榜** | 1-9 場 | 場次→活躍 | 新隊也有舞台 |
| ⚡ **上升星** | 30 天成長 | 本月新增場次 / 招募 | 黑馬機會 |
| 🎮 **各遊戲段位** | 各類型分開 | 該遊戲 rating | 真高手認證 |
| 🌈 **常客榜** | 體驗點數 | 累計 expPoints | 休閒玩家舞台 |

## 8.1 場次榜（主榜）— 推展核心

```
🔥 場次榜（本月）

👑 1. 火舞戰隊        128 場  🏞️ 3 場域
🥈 2. 浪花一現         96 場  🏞️ 2 場域
🥉 3. 鋼鐵雄心         88 場  🏞️ 2 場域
   4. 黃昏之翼         75 場  🏞️ 1 場域
   ...
📍 12. 火焰戰士        45 場  🏞️ 1 場域 ← 你
   13. ...
```

**排序邏輯**：場次 → 跨場域數 → 最近活躍時間

## 8.2 名人堂（100+ 場）

```
💎 名人堂

🌟 火舞戰隊      累計 528 場  🏆 12 個徽章
🌟 紅蓮焚天      累計 412 場  🏆 9 個徽章
...
```

**永久榮譽**，不重置。

## 8.3 新人榜（1-9 場）

```
🌱 新人榜

🥇 1. 浪花一現    8 場  🌱 上週加入
🥈 2. 翠竹之心    7 場
🥉 3. 火焰戰士    5 場
   ...
```

**第一次打完就上榜**，給新人即時成就感。

## 8.4 上升星（30 天成長）

```
⚡ 上升星

🚀 1. 火焰戰士    本月 +25 場 / +12 招募
🚀 2. 黃昏之翼    本月 +20 場 / +8 招募
...
```

**黑馬榜**，給後進機會。

## 8.5 各遊戲段位

各遊戲類型**獨立**：

```
🎮 各遊戲段位

[💧 水彈] [🗺️ 冒險] [⚔️ 競技] [🎯 解謎]

💧 水彈對戰段位
🌟 名人 火舞戰隊   2150 分
💎 鑽石 浪花一現   1850 分
🥇 黃金 火焰戰士   1450 分 ← 你
...
```

**永遠不混算**。

## 8.6 常客榜（體驗點數）

```
🌈 常客榜（本月）

🥇 1. 火舞戰隊        體驗 1850 點
   參加 18 場：嘉年華 8、派對 5、訓練 5
🥈 2. 浪花一現        體驗 1650 點
   跨 3 場域
🥉 3. 壽星團          體驗 1420 點
   特殊活動達人
...
```

**休閒玩家專屬舞台**。

---

# 9. 段位與徽章

## 9.1 段位對應

| 段位 | rating | 比喻 |
|-----|--------|------|
| 🥉 **青銅** | 1000-1199 | 新手村 |
| 🥈 **白銀** | 1200-1399 | 已熟練 |
| 🥇 **黃金** | 1400-1599 | 主力玩家 |
| 💎 **鑽石** | 1600-1799 | 進階高手 |
| 🌟 **名人** | 1800+ | 平台前 5% |

**所有新隊伍起始**：1200 分（白銀）

## 9.2 跨場域徽章

| 徽章 | 條件 | 顯示 |
|-----|-----|------|
| 🏠 **本地常客** | 主場 50+ 場 | 主場域加 ⭐ |
| 🌆 **雙城傳說** | 2 場域 各 10+ 場 | 隊名前 🌆 |
| 🌏 **三城遠征** | 3 場域 各 10+ 場 | 隊名前 🌏 |
| 🌍 **全國巡迴** | 5+ 場域 各 5+ 場 | **超級隊長候選** |
| 🚀 **首戰場域** | 第 1 次在某場域打 | 場域歷史紀錄 |

## 9.3 招募徽章

| 徽章 | 條件 |
|-----|------|
| 🌟 **小招募家** | 邀請 3 人加入並完成首戰 |
| 🌟🌟 **招募達人** | 邀請 10 人 |
| 🌟🌟🌟 **超級隊長** | 邀請 30 人 + 跨 2 場域 |

## 9.4 特殊活動徽章

| 徽章 | 條件 |
|-----|------|
| 🎂 **派對達人** | 完成 5 場特殊活動（生日、聚會等）|
| 👨‍👩‍👧 **親子達人** | 完成 5 場親子家庭活動 |
| 🎉 **嘉年華王者** | 嘉年華活動參加 10+ 場 |

## 9.5 個人挑戰徽章

| 徽章 | 條件 |
|-----|------|
| ⚡ **破紀錄王** | 突破個人最佳 5 次 |
| 🏃 **速通達人** | 速通類遊戲 10+ 場 |

---

# 10. 訊息來源（系統自動 vs 人為）

## 10.1 5 個欄位的來源總表

```ts
interface SquadMatchRecord {
  squadId: string;           // ← 系統自動（從玩家狀態讀）
  gameType: string;          // ← 系統自動（從遊戲設定讀）
  fieldId: string;           // ← 系統自動（從 URL/context 讀）
  result: GameResult;        // ← 90% 自動，10% 人工
  performance: GamePerformance; // ← 90% 自動
}

type GameResult =
  | "win"          // PvP 贏
  | "loss"         // PvP 輸
  | "draw"         // PvP 平手
  | "completed"    // PvE 完成
  | "failed"       // PvE 失敗
  | "participated" // 純體驗（無勝負）
  | "achieved";    // 個人挑戰突破
```

## 10.2 各遊戲類型的訊息來源

| 遊戲類型 | result 來源 | performance 來源 | 人工介入 |
|---------|-----------|-----------------|---------|
| 數位解謎 / 冒險 | 系統判斷 | 系統記錄 step | ❌ 無 |
| 問答關卡 | 系統判斷 | 答對率自動 | ❌ 無 |
| 競技 / 接力 | rank 自動 | 完成時間自動 | ❌ 無 |
| QR / GPS | 步驟完成 | 已打卡數 / 總數 | ❌ 無 |
| 拍照任務 | AI 判斷 | AI 比對成功率 | 邊緣才複核 |
| **水彈對戰** | **裁判 or 自評** | duration 自動 | ✅ **必須** |
| 純體驗（嘉年華）| 系統自動 | duration + 人數 | ❌ 無 |

## 10.3 「遊戲端只回報事實，不算分數」

```ts
// 遊戲端 hook（簡化）
async function onSessionComplete(session) {
  await createSquadMatchRecord({
    squadId: session.squadId,
    gameType: session.game.gameType,
    fieldId: session.fieldId,
    result: deriveResult(session),         // 從 session 狀態推
    performance: derivePerformance(session), // 從 session 進度算
  });
  // ↓ 平台後端自動算 ELO + bonus + 寫戰績
}
```

**遊戲設計者完全不用算分**，只要回報「玩家完成了什麼事實」。

---

# 11. 水彈對戰結算（3 種模式）

水彈打到 app 偵測不到，**必須有人工環節**。

## 11.1 Mode A：場域裁判介入（推薦）

```
比賽結束
  ↓ 場域裁判打開 admin 介面
  ↓ 點「結算」按鈕：

┌────────────────────────────┐
│ 🥊 賈村場 14:00 對戰       │
├────────────────────────────┤
│ 紅隊 vs 藍隊               │
│                             │
│ 獲勝隊伍：[ 紅隊 ▼ ]       │
│ MVP（選填）：[ 王小明 ▼ ]   │
│                             │
│ [確認結算]                  │
└────────────────────────────┘

  ↓ 點確認
  ↓ 系統自動算 rating + 寫戰績
```

**人工只填**：誰贏 + （選填）MVP
**系統自動算**：rating 變動、雙方隊伍分數、寫進戰績、發通知

## 11.2 Mode B：玩家自評（信任機制）

```
比賽結束
  ↓ 雙方隊長手機跳通知
  ↓ 紅隊長按「我們贏」
  ↓ 藍隊長按「我們輸」
  ↓ 雙方一致 → 系統採信
  ↓ 自動結算

如果不一致（紅藍都按「我們贏」）：
  ↓ 系統標記「爭議」
  ↓ 通知場域裁判仲裁
```

## 11.3 Mode C：未來電子裝備

水彈感應器自動偵測命中、淘汰 → 100% 系統自動。**長期目標**。

## 11.4 結算 UI 設計

場域 admin 後台新增「對戰結算」頁面：

```
[Slot 列表] → 進行中對戰

  賈村場 · 14:00
  ├ 紅隊（5 人）
  ├ 藍隊（5 人）
  └ [⏱️ 進行中 12:34]

  [ 結算對戰 ]  ← 點擊開啟結算 Dialog
```

---

# 12. 跨場域推展機制

## 12.1 場次加成

| 場域類型 | 場次倍率 |
|---------|---------|
| 主場 | 1.0 |
| 客場 | 1.2 |
| 首航 | 2.0 |

## 12.2 跨場域徽章

見 [§9.2](#92-跨場域徽章)。

## 12.3 場域多樣性激勵

```
玩家 A 想升「全國巡迴」徽章
  ↓ 需要 5+ 場域 各 5+ 場
  ↓ 主動跨域
  ↓ 跨域場次加成 1.2x
  ↓ 首航加成 2x
  ↓ 飛速累積
```

**設計目的**：讓玩家**主動找新場域去玩**，平台不用付推廣費。

---

# 13. 招募與超級隊長

## 13.1 招募雙向獎勵

| 事件 | 新人得 | 推薦人得 |
|-----|-------|--------|
| 新人註冊加入 Squad | 50 體驗點 | 20 體驗點 |
| 新人完成首戰 | 30 體驗點 | 50 體驗點 |
| 新人打滿 5 場 | 100 體驗點 | 100 體驗點 + 徽章 |

## 13.2 招募達人徽章

見 [§9.3](#93-招募徽章)。

## 13.3 超級隊長定義

**自動升級條件**：

| 段位 | 條件 | 特權 |
|-----|------|------|
| 🥉 Bronze Squad | 打 10 場 | 隊伍列表曝光 |
| 🥈 Silver Squad | 打 50 場，勝率 40%+ | 推薦給新玩家 |
| 🥇 Gold Squad | 打 100 場，勝率 50%+，跨 2 場域 | 場域首頁曝光 |
| 💎 Platinum Squad | 打 200 場，跨 3 場域 | 可主持公開賽 |
| 🌟 **Super Squad** | 平台 top 10 + 招募 30+ 人 | 場域開幕邀請、推廣連結獎勵加倍 |

## 13.4 推廣連結追蹤

```
超級隊長專屬：
https://game.homi.cc/invite/squad/火焰戰士?ref=hung

點擊 → 引導註冊 → 自動加入該 Squad
追蹤：點擊數、轉換數、後續場次數

隊長 Dashboard：
├ 本月推廣：點擊 42 次，轉換 8 人
├ 招募成員後續活躍：8/8 都打過 3+ 場
└ 「你帶進來的玩家累計貢獻 340 場」
```

## 13.5 超級隊長特權

1. **隊名前 ⭐ 標記**（其他玩家一眼看到）
2. **雙向招募獎勵 ×2**（一般 50 點 → 超級 100 點）
3. **場域首頁曝光**（新玩家第一眼看到）
4. **首戰邀請**（新場域開放 → 平台主動推送）
5. **專屬推廣連結**（轉換追蹤）
6. **隊長 Dashboard**（行銷效益看板）

---

# 14. 場域歡迎隊伍

## 14.1 概念

新場域開放或新玩家進入時，主動推薦既有的優質 Squad。

## 14.2 場域管理員設定

場域後台：

```
[歡迎隊伍設定]

✓ 自動推薦本場域 top 5 隊伍
□ 自動推薦超級隊長
□ 手動指定（清單）：
  ├ 🌟 火舞戰隊
  └ 🌟 浪花一現

新玩家進入時：[✓] 顯示推薦清單
```

## 14.3 新玩家推薦邏輯

```
玩家 A 第一次到「後浦金城」
  ↓ 系統偵測：沒在這場域打過
  ↓ 顯示推薦：
┌───────────────────────────────┐
│ 🎉 歡迎來到後浦金城！         │
│                                │
│ 在地推薦的隊伍：              │
│  🌟 後浦勇士團（超級隊長）    │
│      85 場 · 勝率 68%          │
│  🌆 雙城戰隊                  │
│      跨場域常客                │
│                                │
│ [加入這個隊伍] [我有自己的隊]│
└───────────────────────────────┘
```

---

# 15. 公開 Squad 分享頁

## 15.1 頁面內容

`https://game.homi.cc/squad/火焰戰士` 任何人都能看：

```
┌─────────────────────────────────────┐
│  🔥 火焰戰士  [TAG: FIRE]           │
│  ⭐ 超級隊長 · 跨 3 場域            │
├─────────────────────────────────────┤
│  📊 戰績                            │
│  ├ 總場次：128                      │
│  ├ 各遊戲段位：                     │
│  │   💧 水彈 鑽石 1680              │
│  │   🗺️ 冒險 黃金 1450              │
│  │   ⚔️ 競技 白銀 1220              │
│  └ 體驗點數：2850                   │
│                                      │
│  🏆 徽章                            │
│  🌍 全國巡迴 / 🌟 招募達人 / ...    │
│                                      │
│  📅 近期戰績                        │
│  04-25 賈村水彈 WIN +25             │
│  04-24 後浦冒險 WIN +15             │
│  ...                                 │
│                                      │
│  📸 紀念照（最新 3 張）             │
│                                      │
│  [👉 加入這個隊伍]（未加入者）      │
│  [⭐ 關注這個隊伍]                  │
└─────────────────────────────────────┘
```

## 15.2 SEO 設計

- HTML title: `🔥 火焰戰士 - CHITO 對戰隊伍`
- meta description: 戰績摘要
- og:image: 隊徽 + 戰績統計（自動生成）
- Schema.org SportsTeam 結構化資料

## 15.3 社交分享

- 隊長可在 Squad 設定「公開」/「僅成員可見」
- 公開隊伍可被搜尋、被分享
- 紀念照可選擇是否公開

---

# 16. 留存通知流

## 16.1 第 1 場後即時通知

```
🎊 上榜啦！
浪花一現隊 在新人榜第 8 名！

[查看新人榜]  [分享戰績]
```

## 16.2 3 天後（沒回來）

```
🌱 浪花一現的新人榜排名變動！
你們現在是第 12 名（被擠下了）
再打 1 場就能拿回前 10！

[馬上揪團]
```

## 16.3 7 天後（沒回來）— Email

```
標題：浪花一現需要你回來救援！
內容：新人榜更新了，你的隊伍排名掉到第 25...
但還有機會！本週末賈村開放對戰，回來再戰一場吧！

[一鍵報名]
```

## 16.4 14 天後（沒回來）— 最後嘗試

```
⚡ 限時福利
你的隊伍現在回來打 1 場有 +50 體驗點
（活躍隊伍才有的獎勵）

[領取福利]
```

## 16.5 30 天後 — 隊伍進入「休眠」

- 不再主動打擾
- 任一隊員回來打 → toast「歡迎回來，浪花一現睡醒了！」
- 重新計算 14 天倒數

## 16.6 通知頻率上限

| 頻率 | 上限 |
|-----|-----|
| Push 通知 | 每隊伍每 3 天最多 1 則 |
| Email | 每隊伍每週最多 1 封 |
| 升級通知 | 每場最多 1 則 |
| 玩家可一鍵關閉 | ✓ |

**避免 spam → 退訂**。

---

# 17. 隊名規則

## 17.1 命名格式

| 項目 | 規則 |
|-----|------|
| **隊名** | 2-20 字（中英數），可含 emoji |
| **Tag** | 2-5 字（英數中文），用於顯示 `[TAG] 隊名` |
| **隊徽** | 自訂上傳 OR 系統內建 emoji |
| **描述** | 0-200 字 |
| **主色** | 從預設色票選（隊伍卡片邊框色）|

## 17.2 唯一性

- 隊名**全平台唯一**（unique constraint）
- Tag 全平台唯一（避免冒充）
- 系統保留字不可用：`官方` / `admin` / `平台` / ...

## 17.3 改名冷卻

- 建立後 7 天內可改 1 次（防錯字）
- 之後每次改名間隔 **30 天**
- 改名歷史保留（避免鑽漏洞）

## 17.4 解散後鎖名

- 隊伍解散 → 隊名鎖 **180 天**
- 180 天後可被新隊伍註冊
- 防止惡意搶名 / 釣魚

## 17.5 違規處理

- 玩家檢舉違規隊名
- 場域 admin 可暫停隊伍
- 平台 admin 可強制改名（不影響戰績）

---

# 18. 隊伍生命週期

## 18.1 建立

```
玩家 A 點「建立隊伍」
  ↓ 填名稱、Tag、描述
  ↓ 系統檢查唯一性
  ↓ 建立 squads + squad_members（A 為 leader）
  ↓ 起始 rating 1200，場次 0
```

## 18.2 活躍

```
打 1 場 → 場次 1，狀態「新人」
持續打 → 升級「活躍」、「資深」、「傳奇」
```

## 18.3 休眠

```
30 天無活動
  ↓ 自動標記「休眠」
  ↓ 仍上榜（場次榜會有「休眠」灰色標籤）
  ↓ 隊員回來打 → 自動喚醒
```

## 18.4 解散

```
情境 1：隊長主動解散
  ↓ AlertDialog 確認
  ↓ 戰績凍結（不能再增加）
  ↓ 隊名鎖 180 天

情境 2：90 天無活動
  ↓ 平台自動標記「待解散」
  ↓ 通知所有成員
  ↓ 30 天內任一人回來 → 取消解散
  ↓ 否則自動解散
```

## 18.5 戰績歸屬

**隊伍解散後戰績**：
- 戰績**留在 Squad**（公開頁仍可查）
- 個人**不繼承**（避免複雜化）
- 個人會有「曾屬於哪些隊伍」紀錄
- 解散後 180 天才能完全刪除（給後悔的機會）

---

# 19. 防作弊規則

## 19.1 場次防作弊

| 規則 | 細節 |
|-----|-----|
| 最短時長 | session < 60 秒不算 |
| 隊員數 | 至少 2 人實際參與 |
| 每日上限 | 單隊每日最多計 10 場 |
| 同對手限制 | 30 分鐘內 vs 同對手第 6 場+ 不算 |

## 19.2 對手強度限制

```
對方 rating 比你低 400+ 分：
  - 你贏：delta × 0.3（只加 30%）
  - 你輸：delta × 1.0（正常扣分，懲罰）

對方比你高 400+：
  - 你贏：delta × 1.5（大爆冷加成）
  - 你輸：delta × 0.5（少扣分）
```

## 19.3 重複對戰限制

```
24 小時內 vs 同對手：
  第 1-3 場：100% 計分
  第 4-5 場：50% 計分
  第 6 場+ ：不計分（仍能玩，但無 rating 變動）
```

## 19.4 K 值衰減

見 [§6.5](#65-k-值衰減防-farm)。

---

# 20. 資料庫架構

## 20.1 squads（隊伍本體）

```sql
CREATE TABLE squads (
  id varchar PRIMARY KEY,
  name varchar(20) UNIQUE NOT NULL,
  tag varchar(5) UNIQUE NOT NULL,
  description text,
  emblem_url varchar,
  primary_color varchar(7),         -- HEX 色碼
  leader_id varchar NOT NULL,       -- references users
  home_field_id varchar,            -- 主場域（可空，跨平台型）
  is_public boolean DEFAULT true,   -- 公開分享頁
  status varchar(20) DEFAULT 'active',  -- active/dormant/dissolved
  created_at timestamp DEFAULT now(),
  dissolved_at timestamp,           -- 解散時間
  name_lock_until timestamp         -- 隊名鎖定到何時
);
```

## 20.2 squad_members（成員）

```sql
CREATE TABLE squad_members (
  id varchar PRIMARY KEY,
  squad_id varchar NOT NULL REFERENCES squads,
  user_id varchar NOT NULL REFERENCES users,
  role varchar(20) DEFAULT 'member',  -- leader/officer/member
  joined_at timestamp DEFAULT now(),
  left_at timestamp,                  -- soft delete
  UNIQUE(squad_id, user_id, left_at)  -- 不能重複加入（除非離開過）
);
```

## 20.3 squad_stats（聚合戰績，每隊一筆）

```sql
CREATE TABLE squad_stats (
  squad_id varchar PRIMARY KEY REFERENCES squads,
  total_games integer DEFAULT 0,           -- 總場次（含跨域加成）
  total_games_raw integer DEFAULT 0,       -- 原始場次（不含加成）
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  draws integer DEFAULT 0,
  total_exp_points integer DEFAULT 0,      -- 累積體驗點數
  fields_played jsonb DEFAULT '[]',        -- 跨場域清單
  recruits_count integer DEFAULT 0,        -- 招募人數
  last_active_at timestamp,
  super_leader_tier varchar(20),           -- bronze/silver/gold/platinum/super
  updated_at timestamp DEFAULT now()
);
```

## 20.4 squad_match_records（每場戰績）

```sql
CREATE TABLE squad_match_records (
  id varchar PRIMARY KEY,
  squad_id varchar NOT NULL REFERENCES squads,
  game_type varchar(50) NOT NULL,    -- battle/adventure/competitive/relay/puzzle/experience
  game_id varchar,                    -- 一般遊戲
  slot_id varchar,                    -- 水彈時段
  match_id varchar,                   -- 競技 match
  field_id varchar NOT NULL,          -- 哪個場域
  result varchar(20) NOT NULL,        -- win/loss/draw/completed/failed/participated/achieved
  rating_change integer DEFAULT 0,    -- 該遊戲類型 rating 變動
  exp_points integer DEFAULT 0,       -- 體驗點數變動
  rating_before integer,              -- 該遊戲類型本場前 rating
  rating_after integer,
  performance jsonb NOT NULL,         -- {duration, completionRate, eliminations, ...}
  is_cross_field boolean DEFAULT false,
  is_first_visit boolean DEFAULT false,
  played_at timestamp DEFAULT now(),
  INDEX idx_squad_played (squad_id, played_at DESC),
  INDEX idx_game_type (game_type),
  INDEX idx_field (field_id, played_at DESC)
);
```

## 20.5 squad_ratings（各遊戲類型 rating，每隊每類型一筆）

```sql
CREATE TABLE squad_ratings (
  squad_id varchar NOT NULL REFERENCES squads,
  game_type varchar(50) NOT NULL,
  rating integer DEFAULT 1200,
  games_played integer DEFAULT 0,     -- 該類型場次（用於 K 值）
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  PRIMARY KEY (squad_id, game_type)
);
```

## 20.6 squad_achievements（徽章）

```sql
CREATE TABLE squad_achievements (
  id varchar PRIMARY KEY,
  squad_id varchar NOT NULL REFERENCES squads,
  achievement_key varchar(50) NOT NULL,  -- 'cross_field_3' / 'recruiter_master' / ...
  unlocked_at timestamp DEFAULT now(),
  UNIQUE(squad_id, achievement_key)
);
```

## 20.7 squad_invites（推廣追蹤）

```sql
CREATE TABLE squad_invites (
  id varchar PRIMARY KEY,
  squad_id varchar NOT NULL REFERENCES squads,
  inviter_user_id varchar NOT NULL,    -- 推薦人
  invite_token varchar UNIQUE NOT NULL, -- URL token
  invitee_user_id varchar,              -- 加入後填入
  joined_at timestamp,
  first_game_played_at timestamp,
  total_games_played integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);
```

---

# 21. UX 設計

## 21.1 統一參戰 Dialog

進入任何組隊遊戲時：

```
┌──────────────────────────────────────┐
│  🏆 選擇隊伍                          │
├──────────────────────────────────────┤
│  🔥 火焰戰士     ⭐⭐⭐⭐⭐  8 場    │ ← 上次用的
│  🌊 浪花一現     ⭐⭐         3 場    │ ← 偶爾用
│  ✨ 建新隊伍                          │
│  🔗 用邀請碼加入                       │
└──────────────────────────────────────┘
```

**沒有「臨時/永久」選項**。

**80% 情境**：localStorage 記住上次用的，直接帶入，不彈 Dialog。

## 21.2 隊伍詳情頁（`/squad/:id`）

成員看到的：

```
[Header: 🔥 火焰戰士  TAG:FIRE  ⭐ 招募達人]

[數據面板]
├ 總場次 128
├ 各遊戲段位（4 個 tab）
└ 體驗點數 2850

[徽章牆]
🌍 全國巡迴 / 🌟 招募達人 / ...

[成員清單]
👑 leader Hung
⭐ officer 王小明
   member 張三
   member 李四
   ...

[管理面板（隊長/幹部）]
編輯戰隊 / 升降級 / 踢出 / 轉讓

[最近戰績]
[紀念照集錦]
```

## 21.3 排行榜頁（6 tabs）

見 [§8](#8-6-個排行榜)。

## 21.4 公開分享頁（`/squad/:tag`）

非成員也能看，含「加入」/「關注」CTA。見 [§15](#15-公開-squad-分享頁)。

---

# 22. 遷移計畫

## 22.1 階段 1：UI 統一（1-2 週，零風險）

**目標**：UI 層改稱「隊伍」，不動 DB

**動作**：
1. 全 UI 文案 `戰隊` / `Team` / `Clan` → `隊伍`
2. 所有組隊遊戲進入時彈統一 Dialog
3. `BattleClan` 頁面 → `/squad/:id` redirect
4. 排行榜加「新人榜」tab
5. localStorage 記憶上次隊伍
6. 第一次打完即時 toast「上榜啦！」

**驗證指標**：
- 第一次打完隊伍的玩家，3 天內回流率變化
- 隊伍邀請功能使用次數變化

**判斷**：
- ✅ 數據漂亮 → 進階段 2
- ❌ 數據沒變 → 停損

## 22.2 階段 2：資料聚合（2-3 週，中風險）

**前提**：階段 1 數據正向

**動作**：
1. 建 `squad_match_records` table
2. 所有遊戲結束時寫入（hook 既有 session 完成事件）
3. backfill 歷史 sessions（Team / Match / Battle）
4. 建 `squad_stats` view（聚合視圖，先不真合併 table）
5. 5 個排行榜上線
6. 跨場域徽章 + 招募徽章
7. 自動 tier 升級

## 22.3 階段 3：徹底合併（4-6 週，高風險）

**前提**：階段 2 穩定，超級隊長機制有候選

**動作**：
1. 建 `squads` 真正 table
2. 資料遷移：
   - 現有 BattleClan → Squad（直接改名）
   - 現有 Team（活躍的）→ Squad（opt-in 永久化）
   - 現有 Match 參賽者 → Squad（看是否有 BattleClan，沒則建臨時 squad）
3. 舊 table 標記 deprecated
4. 通知流上線（3-7-14 天）
5. 場域 admin 後台「推薦邀請名單」
6. 超級隊長推廣連結
7. 公開 Squad 分享頁

---

# 23. 工程量估算

## 23.1 工時估算（誠實）

| 階段 | 時程 | 工程師人天 | 風險 |
|-----|------|----------|-----|
| **階段 1：UI 統一** | 1-2 週 | 5-7 天 | 🟢 低 |
| **階段 2：資料聚合** | 2-3 週 | 10-15 天 | 🟡 中 |
| **階段 3：徹底合併** | 4-6 週 | 25-30 天 | 🔴 高 |
| **行銷功能** | 3-4 週 | 15-20 天 | 🟡 中 |
| **超級隊長 + 推廣** | 3 週 | 12-15 天 | 🟡 中 |

**總計（保守估）**：2.5-3 個月全套完成

## 23.2 機會成本

這 2-3 個月**不能做**：
- 新遊戲類型（解謎、實境劇本）
- Photo* 元件深度優化（AI 加值）
- 新場域 onboarding
- 收費機制

## 23.3 階段建議

**因為「測試階段」可以更激進，壓縮到 1.5 個月**：

| Week | 內容 |
|------|-----|
| Week 1 | 場次基建（squad_match_records + hook） |
| Week 2-3 | 6 個排行榜 + UI 一次到位 + 跨域徽章 |
| Week 4-5 | 通知流 + 場域 admin 後台 + 推廣連結 |
| Week 6 | UI 全面統一 + 公開 Squad 頁 |

→ 6 週可全部上線。

---

# 24. 風險與緩解

## 24.1 風險矩陣

| 風險 | 機率 | 影響 | 緩解 |
|-----|------|-----|------|
| 遷移破壞現有戰績 | 中 | 高 | 雙寫 + backfill + 灰度 |
| 跨遊戲積分公式爭議 | 高 | 中 | **不做總榜**，各遊戲獨立 |
| 通知疲勞 | 中 | 中 | 預設 opt-in + 頻率上限 |
| 超級隊長變寡頭 | 中 | 中 | 30 天活躍門檻 + 黑馬榜保留位 |
| 隊名搶註 | 高 | 低 | 先到先得 + 鎖名 180 天 |
| 開發時程超預期 | 中 | 中 | 階段 1 先試水溫 |

## 24.2 三大關鍵風險詳述

### 🔴 風險 1：遷移破壞現有戰績

**問題**：4 套資料整合 = backfill 寫腳本 = 可能算錯

**緩解**：
- 階段 1 不動 DB
- 階段 2 雙寫（同時寫舊和新）
- backfill 跑 dry-run 比對
- 發現異常立刻 rollback

### 🟡 風險 2：跨遊戲積分公式爭議

**問題**：水彈 1 場 = 一般遊戲幾場？玩家會吵不公平

**緩解**：**永遠不做跨遊戲總分公式**
- 用「場次」當主指標（最中性）
- rating 各遊戲獨立
- 超級隊長用「跨場域數 + 招募」評估

### 🟡 風險 3：超級隊長變寡頭

**問題**：早期 5 隊霸佔，新使用者排不進前 10 → 流失

**緩解**：
- 場次榜混合「總和 + 30 天新增 + 跨場域」三軸
- 新人榜給新隊機會
- 上升星榜給黑馬機會
- 名人堂只是榮譽展示，不影響其他榜

---

# 25. 實作檢查清單

## 25.1 ✅ 必做（核心）

### 階段 1（1-2 週）
- [ ] UI 文案統一改「隊伍」
- [ ] localStorage 記憶上次隊伍
- [ ] BattleRanking 加「新人榜」tab（1-9 場條件）
- [ ] 第一次打完即時 toast「上榜啦！」
- [ ] 統一參戰 Dialog（所有組隊遊戲共用）
- [ ] BattleClan 頁面 → `/squad/:id` redirect

### 階段 2（2-3 週）
- [ ] 建 `squad_match_records` schema
- [ ] 建 `squad_ratings` schema（各遊戲類型）
- [ ] 各遊戲結束時 hook 寫入
- [ ] Backfill 歷史 sessions
- [ ] 6 個排行榜上線
- [ ] 跨場域徽章 + 招募徽章
- [ ] ELO 公式實作（PvP + PvE）
- [ ] 體驗點數系統（純體驗模式）
- [ ] 自動 tier 升級
- [ ] 場次防作弊規則

### 階段 3（4-6 週）
- [ ] 建 `squads` table 真正合併
- [ ] 資料遷移腳本
- [ ] 通知流（3-7-14 天）
- [ ] 場域 admin 「推薦邀請」後台
- [ ] 超級隊長推廣連結
- [ ] 公開 Squad 分享頁
- [ ] 水彈對戰結算 UI（裁判模式 + 自評模式）

## 25.2 🎯 可選（加值）

- [ ] 場域歡迎隊伍機制
- [ ] Squad 隊徽自訂上傳
- [ ] 紀念照集錦（公開分享頁）
- [ ] SEO 優化（og:image 自動生成）
- [ ] 推廣連結 Cohort 分析後台
- [ ] 玩家自評水彈對戰（信任機制）

## 25.3 ❌ 不做（避坑）

- [ ] ~~跨遊戲總分數公式~~（永遠不做）
- [ ] ~~強制使用者選「臨時/永久」~~
- [ ] ~~隊伍解散後戰績歸個人~~
- [ ] ~~電子裝備自動偵測水彈~~（長期目標）

## 25.4 第一輪具體任務（建議從這 6 件事開始）

1. **建 schema**：`squad_match_records` + `squad_ratings`
2. **UI 統一**：BattleClan → 「我的隊伍」+ 全文案改「隊伍」
3. **參戰 Dialog**：在所有組隊遊戲進入時統一彈出
4. **新人榜 tab**：BattleRanking 加 4 個 tab（場次/新人/上升星/段位）
5. **記憶上次隊伍**：localStorage + 自動帶入
6. **第一場上榜 toast**：第 1 場打完即時通知

→ **約 1 週可完成**，立刻看到效果。

---

# 📝 結語

> **「隊伍是長期資產，戰場是多元舞台。」**

這份設計的目標：
1. ✅ 操作極簡（80% 不彈 Dialog）
2. ✅ 概念易懂（一個隊名打天下）
3. ✅ 推展優先（跨域加成 + 招募獎勵）
4. ✅ 包容多元（PvP / PvE / 純體驗 / 合作 / 個人）
5. ✅ 防作弊穩固（K 值 / 對手限制 / 重複限制）
6. ✅ 行銷自動化（通知流 + 排行榜 + 推廣連結）
7. ✅ 場域協同（歡迎隊伍 + 跨域加成）

**不解決的事**（明確避開）：
- 跨遊戲分數公平性（用場次解）
- 一場結算需多久（保留多種結算模式）
- 完美防作弊（用統計門檻 + 平台介入）

---

**📋 等待確認**：請逐章審視，沒問題後即可開始實作。

**🚀 第一步建議**：階段 1（UI 統一 + 新人榜 + 統一 Dialog），1-2 週可完成，零風險，立刻見效。

---

---

# 26. 獎勵轉換節點（Reward Conversion Node）

> **「遊戲端只送結果，轉換節點決定獎勵。」**

## 26.1 核心概念

**問題**：如果把「給折價券」邏輯寫進每個遊戲，會變成：
- 每個遊戲都要懂折價券
- 新增獎勵管道要改所有遊戲
- 第三方系統難對接

**解法**：**節點化（Node Architecture）**
- 遊戲端只送一個 `GameResultEvent`（結果事件）
- **轉換節點**（Reward Conversion Node）負責決定發什麼獎勵
- 獎勵管道是**外掛式**（內部 / 外部 / 未來新加）

## 26.2 節點架構圖

```
┌────────────────────────────────────────────────┐
│  遊戲端（任何遊戲類型）                         │
│  ├ 水彈對戰 / 一般遊戲 / 競技 / 體驗 / ...      │
│  └ session 完成 → 產生 GameResultEvent         │
└──────────────────┬─────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────┐
│  🎯 Reward Conversion Node（轉換節點）          │
│  ├ 1. 寫入 squad_match_record（戰績）          │
│  ├ 2. 計算 rating + 體驗點數（內建邏輯）       │
│  ├ 3. 評估轉換規則（規則引擎）                 │
│  ├ 4. 觸發獎勵發放（多管道分流）               │
│  └ 5. 寫入事件流（可重放、可追溯）             │
└──────────────────┬─────────────────────────────┘
                   │
       ┌───────────┼─────────────┬──────────────┐
       ▼           ▼              ▼              ▼
   ┌───────┐  ┌───────┐    ┌──────────┐  ┌──────────┐
   │ 內部  │  │ 平台  │    │ 外部對接 │  │ 未來擴充 │
   │獎勵   │  │折價券 │    │金門好康券│  │ 商品/...│
   │       │  │       │    │aihomi.cc │  │          │
   │ 點數  │  │ CHITO │    │          │  │          │
   │ rating│  │ 自有  │    │ webhook  │  │ ?        │
   │ 徽章  │  │       │    │          │  │          │
   └───────┘  └───────┘    └──────────┘  └──────────┘
```

## 26.3 觸發來源（誰會送結果到節點）

| 來源 | 範例 |
|-----|------|
| 一般遊戲 session 結束 | 玩家通關「賈村冒險」 |
| 水彈對戰結算完成 | 場域裁判按下「紅隊勝」 |
| 競技/接力 match 結束 | 排出 1-8 名 |
| 純體驗活動結束 | 嘉年華打卡完成 |
| 招募達標 | 邀請第 10 人加入並完成首戰 |
| 賽季結算 | 賽季結束自動觸發 |
| 場域里程碑 | 第 1000 個玩家、開幕日等 |
| 隊伍狀態升級 | 升上「活躍 / 資深 / 傳奇」 |
| **手動觸發**（admin） | 場域 admin 主動發券給某隊 |

**全部統一格式 → 節點處理**。

## 26.4 獎勵類型（外掛式 Provider）

| 類型 | 說明 | Provider |
|-----|------|----------|
| `exp_points` | 體驗點數（內部累積）| 內建 |
| `rating_bonus` | 額外 rating（特殊活動）| 內建 |
| `badge` | 徽章 | 內建 |
| `platform_coupon` | CHITO 平台折價券 | 平台自有系統 |
| `external_coupon` | 外部折價券（金門好康券）| coupon.aihomi.cc |
| `physical_reward` | 實體獎品 | 場域自取 / 寄送 |
| `virtual_item` | 虛擬寶物（未來）| 內建 |
| `cash_back` | 現金回饋（未來）| 第三方支付 |

**新獎勵類型 = 加 1 個 Provider，不動既有遊戲**。

## 26.5 轉換規則引擎

### 規則資料結構

```ts
interface RewardConversionRule {
  id: string;
  name: string;                       // 「跨場域首航獎」
  description: string;
  isActive: boolean;
  fieldId?: string;                   // 限定場域，null = 全平台

  // 觸發條件（AND 組合）
  triggers: {
    eventType: string;                // 'game_complete' / 'milestone' / ...
    gameTypes?: string[];             // 限定遊戲類型
    result?: GameResult[];            // 限定結果（win / completed / ...）
    minTotalGames?: number;           // 累計場次門檻
    crossField?: boolean;             // 必須跨場域
    firstVisit?: boolean;             // 必須首航
    minSquadTier?: string;            // 最低段位門檻
    customExpression?: string;        // 自訂 JSON Logic
  };

  // 獎勵內容
  rewards: Array<{
    type: RewardType;                 // exp_points / platform_coupon / ...
    provider?: string;                // 'aihomi_coupon' / null（內部）
    value: number | string;           // 點數量 / 券模板 ID
    target: 'squad' | 'leader' | 'all_members';  // 給誰
    metadata?: Record<string, unknown>; // 額外參數（券模板、商家等）
  }>;

  // 配額
  quota: {
    perSquad?: number;                // 每隊伍最多領 N 次
    perDay?: number;                  // 每日上限
    totalCap?: number;                // 規則總上限
    validUntil?: string;              // 規則有效期
  };

  priority: number;                   // 評估順序
  createdBy: string;                  // 場域 admin / 平台 admin
  createdAt: string;
}
```

### 規則評估流程

```ts
function evaluateRules(event: GameResultEvent) {
  // 1. 取出所有相關規則（場域 + 全平台）
  const rules = getRulesFor(event);

  // 2. 依 priority 排序
  rules.sort((a, b) => b.priority - a.priority);

  // 3. 一一評估
  for (const rule of rules) {
    if (matchTriggers(rule.triggers, event)) {
      if (checkQuota(rule, event.squadId)) {
        await issueRewards(rule.rewards, event);
        await logRuleHit(rule.id, event);
      }
    }
  }
}
```

## 26.6 內部獎勵（CHITO 平台券）

平台**自己有一套折價券系統**（與外部 coupon.aihomi.cc 並行）：

### 用途
- 平台內活動：購買 CHITO 課程、入場費、活動門票
- 跨場域通用
- 玩家進「我的錢包」可看到

### 資料結構（簡化）

```sql
CREATE TABLE platform_coupons (
  id varchar PRIMARY KEY,
  code varchar UNIQUE NOT NULL,         -- 兌換碼
  template_id varchar NOT NULL,         -- 券模板（面額、規則）
  issued_to_squad_id varchar,           -- 發給哪個隊伍
  issued_to_user_id varchar,            -- 發給哪個玩家
  status varchar(20) DEFAULT 'unused',  -- unused/used/expired
  source_event_id varchar,              -- 從哪個事件來
  issued_at timestamp,
  used_at timestamp,
  expires_at timestamp
);

CREATE TABLE coupon_templates (
  id varchar PRIMARY KEY,
  name varchar,
  description text,
  discount_type varchar(20),            -- amount/percentage
  discount_value integer,
  min_purchase integer,
  applicable_scope jsonb,               -- 適用範圍（場域、商品...）
  validity_days integer DEFAULT 30
);
```

## 26.7 外部獎勵對接（金門好康券 coupon.aihomi.cc）

### 對接架構

```
CHITO 平台
  ↓ POST /api/issue
  ↓ Headers: Authorization, X-Provider-Source: chito
  ↓ Body: { user_id, event_type, value, metadata }
  ▼
coupon.aihomi.cc 系統
  ↓ 收到事件 → 自己決定發什麼券
  ↓ 寫入 aihomi 自家資料庫
  ↓ 回傳 callback：
  ▼
CHITO 平台 callback handler
  ↓ POST /api/rewards/external/callback
  ↓ Body: { user_id, coupon_code, value, expires_at, source_id }
  ▼
寫入 squad_external_rewards
  ↓
玩家在「我的錢包」看到
```

### 對接設定

```sql
CREATE TABLE external_reward_integrations (
  id varchar PRIMARY KEY,
  provider varchar UNIQUE NOT NULL,     -- 'aihomi_coupon' / 'other_partner'
  display_name varchar,                  -- 「金門好康券」
  api_endpoint varchar,
  api_credentials_encrypted text,        -- 加密的 API key
  webhook_secret varchar,                -- 對方 callback 用
  is_active boolean DEFAULT false,
  rate_limit_per_minute integer DEFAULT 60,
  created_at timestamp
);

CREATE TABLE squad_external_rewards (
  id varchar PRIMARY KEY,
  squad_id varchar,
  user_id varchar,
  provider varchar,                      -- 'aihomi_coupon'
  external_coupon_code varchar,          -- 對方系統的券碼
  external_coupon_url varchar,           -- 跳轉連結
  display_name varchar,                  -- 「奶茶買一送一」
  value_description varchar,             -- 「免費飲料 1 杯」
  expires_at timestamp,
  status varchar(20) DEFAULT 'pending',  -- pending/issued/used/expired
  source_event_id varchar,
  issued_at timestamp,
  redeemed_at timestamp
);
```

### Webhook 對接協定

**CHITO → coupon.aihomi.cc**（發送獎勵請求）：

```http
POST https://coupon.aihomi.cc/api/external/issue
Authorization: Bearer <chito_api_key>
X-Provider-Source: chito-game-platform
Content-Type: application/json

{
  "user_id": "user_abc",
  "external_user_ref": "abc@example.com",
  "event": {
    "type": "squad_milestone",
    "subtype": "first_cross_field",
    "squad_id": "squad_xyz",
    "squad_name": "火焰戰士",
    "field_id": "jiachun"
  },
  "context": {
    "game_type": "battle",
    "result": "win",
    "exp_points_earned": 120,
    "played_at": "2026-04-26T14:00:00+08:00"
  },
  "request_id": "req_uuid",
  "callback_url": "https://game.homi.cc/api/rewards/external/callback"
}
```

**coupon.aihomi.cc → CHITO**（callback 回傳結果）：

```http
POST https://game.homi.cc/api/rewards/external/callback
Authorization: Bearer <aihomi_webhook_secret>
Content-Type: application/json

{
  "request_id": "req_uuid",
  "status": "issued",
  "user_id": "user_abc",
  "coupon": {
    "code": "AIHOMI_ABC123",
    "display_name": "金門牛肉麵 9 折",
    "value": "10% off",
    "redeem_url": "https://coupon.aihomi.cc/redeem/ABC123",
    "expires_at": "2026-05-26T23:59:59+08:00",
    "merchant_name": "阿婆牛肉麵",
    "merchant_address": "金門縣金城鎮 ..."
  }
}
```

## 26.8 規則範例（10 個）

### 範例 1：場次里程碑
```yaml
name: 「打滿 10 場新人賀禮」
trigger:
  eventType: game_complete
  minTotalGames: 10
rewards:
  - type: platform_coupon
    template_id: TPL_NEWBIE_50
    target: squad
quota:
  perSquad: 1
```

### 範例 2：跨場域首航
```yaml
name: 「跨場域首航獎」
trigger:
  eventType: game_complete
  firstVisit: true
rewards:
  - type: exp_points
    value: 100
    target: squad
  - type: external_coupon
    provider: aihomi_coupon
    value: WELCOME_DRINK   # 金門好康券模板
    target: leader
quota:
  perSquad: 5  # 每個場域 1 次，最多 5 個場域
```

### 範例 3：超級隊長月度
```yaml
name: 「超級隊長月度招募獎」
trigger:
  eventType: monthly_recruit_milestone
  minRecruits: 5
rewards:
  - type: platform_coupon
    template_id: TPL_500_CASH
    target: leader
quota:
  perSquad: 1
  perMonth: 1
```

### 範例 4：賽季結算
```yaml
name: 「賽季名人堂入榜獎」
trigger:
  eventType: season_end
  minRank: 10
rewards:
  - type: external_coupon
    provider: aihomi_coupon
    value: SEASON_REWARD_GOLD
    target: all_members  # 所有隊員都拿
  - type: badge
    value: 'season_top10_winter_2026'
    target: squad
```

### 範例 5：場域配對行銷
```yaml
name: 「賈村合作店家券」
trigger:
  eventType: game_complete
  fieldId: jiachun
  minTotalGames: 5  # 在賈村打滿 5 場
rewards:
  - type: external_coupon
    provider: aihomi_coupon
    value: JIACHUN_PARTNER_VOUCHER
    target: squad
quota:
  perSquad: 1
  validUntil: 2026-12-31
```

### 範例 6：MVP 即時獎
```yaml
name: 「MVP 飲料券」
trigger:
  eventType: game_complete
  performance.isMvp: true
rewards:
  - type: external_coupon
    provider: aihomi_coupon
    value: DRINK_FREE
    target: leader  # 隊伍裡的 MVP
quota:
  perDay: 3  # 每天最多 3 個 MVP 拿
```

### 範例 7：招募達人
```yaml
name: 「招募達人 10 人達標」
trigger:
  eventType: recruit_milestone
  totalRecruits: 10
rewards:
  - type: badge
    value: 'recruiter_master'
  - type: platform_coupon
    template_id: TPL_RECRUIT_BONUS
    value: 200  # 200 元
```

### 範例 8：跨場域達 3
```yaml
name: 「三城遠征達成」
trigger:
  eventType: cross_field_milestone
  fieldsCount: 3
rewards:
  - type: badge
    value: 'cross_field_3'
  - type: exp_points
    value: 500
  - type: external_coupon
    provider: aihomi_coupon
    value: TRAVELER_BONUS
```

### 範例 9：純體驗達人
```yaml
name: 「嘉年華 10 場常客」
trigger:
  eventType: experience_milestone
  expGameTotal: 10
rewards:
  - type: external_coupon
    provider: aihomi_coupon
    value: PARTY_MASTER_VOUCHER
```

### 範例 10：場域開幕首航
```yaml
name: 「後浦首航 100 名玩家獎」
trigger:
  eventType: field_milestone
  fieldId: hpspace
  visitorRank: '<=100'  # 第 100 名以前的訪客
rewards:
  - type: external_coupon
    provider: aihomi_coupon
    value: GRAND_OPENING_GIFT
quota:
  totalCap: 100  # 全平台只發 100 個
```

## 26.9 玩家領取流程

### 我的獎勵頁面（`/me/rewards` 或 `/squad/:id/rewards`）

```
┌──────────────────────────────────────┐
│  🎁 我的獎勵                          │
├──────────────────────────────────────┤
│  [🎫 平台券]  [🌍 金門好康券]  [📜 點數記錄] │
├──────────────────────────────────────┤
│                                       │
│  🎫 CHITO 50 元折價券                 │
│  ✨ 來自「跨場域首航獎」             │
│  📅 2026-05-26 到期                  │
│  [使用]                               │
│                                       │
│  🌍 金門牛肉麵 9 折                  │
│  ✨ 來自「賈村合作店家獎」           │
│  📅 2026-12-31 到期                  │
│  [前往兌換]  ← 跳轉到 coupon.aihomi.cc │
│                                       │
└──────────────────────────────────────┘
```

### 兌換流程

**平台券**：
- 點「使用」→ 在平台內折抵（購買課程、入場費等）
- 後端標記 status = `used`

**外部券（金門好康券）**：
- 點「前往兌換」→ 跳轉 `coupon.aihomi.cc/redeem/{code}`
- 對方系統處理兌換邏輯
- 兌換完成 → callback 回 CHITO 標記 status = `redeemed`

### 通知

```
🎁 你獲得獎勵了！
火焰戰士隊跨場域首航 → 金門牛肉麵 9 折券
有效期：30 天
[查看獎勵]
```

## 26.10 場域管理員後台

### 規則設定介面

場域 admin 可在後台**自己定規則**（無需工程師介入）：

```
[獎勵規則管理]

[+ 新增規則]

現有規則：
┌────────────────────────────────────────┐
│ 賈村合作店家券                          │
│ 條件：在賈村打滿 5 場                  │
│ 獎勵：金門好康券 JIACHUN_PARTNER       │
│ 配額：每隊 1 張、總額 200 張            │
│ 已發放：47 / 200                        │
│ [編輯] [停用]                           │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 賈村開幕首航 100 名                     │
│ 條件：第 100 名前訪客                   │
│ ...                                     │
└────────────────────────────────────────┘
```

### 配額追蹤

```
本月發券統計
├ 平台券發放：125 張
├ 外部券發放：87 張
├ 兌換率：64%
└ 商家回饋（未來）：來客 32 人
```

### 手動發券

```
[手動觸發]
選擇隊伍：[火焰戰士 ▼]
選擇獎勵：[平台券 100 元 ▼]
原因：（選填）
[發送]
```

## 26.11 商家對接（未來）

商家**不直接接 CHITO**，而是透過 coupon.aihomi.cc：

```
場域 ←→ CHITO 平台 ←→ coupon.aihomi.cc ←→ 商家
                          │
                          └ 中間層（券管理、兌換、結算）
```

**好處**：
- CHITO 不用管商家庫存
- 商家不用學 CHITO 規則
- coupon.aihomi.cc 當交換中心
- 一個商家可同時服務多個遊戲平台

**未來可能 API**（給商家後台用，但不是 CHITO 開）：
- 商家在 coupon.aihomi.cc 建立優惠
- 標記「接受 CHITO 平台用戶」
- CHITO 規則引擎觸發 → 自動發給玩家
- 玩家到店兌換 → 商家在 aihomi 後台核銷

## 26.12 資料庫架構（新增 4 個 tables）

### `reward_conversion_rules`（規則）

```sql
CREATE TABLE reward_conversion_rules (
  id varchar PRIMARY KEY,
  name varchar(100) NOT NULL,
  description text,
  field_id varchar,                     -- null = 全平台
  is_active boolean DEFAULT true,
  triggers jsonb NOT NULL,              -- 觸發條件（JSON Logic）
  rewards jsonb NOT NULL,               -- 獎勵清單
  quota jsonb,                          -- 配額限制
  priority integer DEFAULT 0,
  hits_count integer DEFAULT 0,         -- 已觸發次數
  created_by varchar NOT NULL,
  created_at timestamp DEFAULT now(),
  valid_until timestamp,
  INDEX idx_active_rules (is_active, field_id, priority DESC)
);
```

### `reward_conversion_events`（事件流）

```sql
CREATE TABLE reward_conversion_events (
  id varchar PRIMARY KEY,
  source_type varchar NOT NULL,         -- 'game_complete' / 'milestone' / ...
  source_id varchar NOT NULL,           -- squad_match_record_id 等
  squad_id varchar,
  user_id varchar,
  event_payload jsonb NOT NULL,         -- 完整事件內容（可重放）
  rules_evaluated jsonb,                -- 評估了哪些規則
  rewards_issued jsonb,                 -- 實際發出哪些獎勵
  status varchar(20) DEFAULT 'processed', -- processed/failed/retry
  created_at timestamp DEFAULT now(),
  INDEX idx_source (source_type, source_id),
  INDEX idx_squad_events (squad_id, created_at DESC)
);
```

### `platform_coupons`（平台自有券）

見 [§26.6](#266-內部獎勵chito-平台券) 已有 schema。

### `squad_external_rewards`（外部獎勵）

見 [§26.7](#267-外部獎勵對接金門好康券-couponaihomicc) 已有 schema。

### `external_reward_integrations`（外部對接設定）

見 [§26.7](#267-外部獎勵對接金門好康券-couponaihomicc) 已有 schema。

### `coupon_templates`（券模板）

```sql
CREATE TABLE coupon_templates (
  id varchar PRIMARY KEY,
  name varchar(100),
  description text,
  discount_type varchar(20),            -- 'amount' / 'percentage'
  discount_value integer,
  min_purchase integer,
  applicable_scope jsonb,               -- 適用範圍
  validity_days integer DEFAULT 30,
  is_active boolean DEFAULT true,
  created_at timestamp
);
```

## 26.13 API 設計

### 內部 API

#### 觸發規則評估
```
POST /api/rewards/evaluate
Body: { sourceType, sourceId, payload }
→ 同步評估 + 發放（或 enqueue 給 worker）
```

#### 玩家查獎勵
```
GET /api/me/rewards?status=unused
→ 回傳所有未使用的平台券 + 外部券
```

#### 玩家領取（如果規則設「需手動領取」）
```
POST /api/rewards/:id/claim
→ 標記 status = 'issued'
```

#### 玩家使用平台券
```
POST /api/rewards/:id/use
Body: { context }
→ 標記 status = 'used'
```

### 外部對接 API

#### 對外送出獎勵請求（CHITO → coupon.aihomi.cc）
```
POST <provider_endpoint>/api/external/issue
Headers: Authorization, X-Provider-Source
→ 對方非同步處理 → callback 回來
```

#### 接收 callback（coupon.aihomi.cc → CHITO）
```
POST /api/rewards/external/callback
Headers: Authorization (webhook_secret 驗證)
Body: { request_id, status, coupon: {...} }
→ 寫入 squad_external_rewards
```

#### 兌換完成 callback（coupon.aihomi.cc → CHITO）
```
POST /api/rewards/external/redeemed
Body: { coupon_code, redeemed_at, merchant }
→ 標記 status = 'redeemed'
```

### 場域 admin API

```
GET /api/admin/fields/:fieldId/rules         # 取規則清單
POST /api/admin/fields/:fieldId/rules        # 建規則
PATCH /api/admin/fields/:fieldId/rules/:id   # 編輯
DELETE /api/admin/fields/:fieldId/rules/:id  # 刪除（停用）

POST /api/admin/squads/:squadId/manual-reward  # 手動發券

GET /api/admin/fields/:fieldId/rewards/stats   # 配額統計
```

## 26.14 行銷閉環飛輪

```
        ┌──────────────────────────┐
        │  玩家來玩遊戲             │
        └─────────┬────────────────┘
                  │
                  ▼
        ┌──────────────────────────┐
        │  累積戰績 / 體驗點數      │
        └─────────┬────────────────┘
                  │
                  ▼
        ┌──────────────────────────┐
        │  觸發轉換規則             │
        │  ├ 跨場域 → 旅遊券       │
        │  ├ 招募達人 → 平台券     │
        │  └ MVP → 飲料券          │
        └─────────┬────────────────┘
                  │
                  ▼
        ┌──────────────────────────┐
        │  獲得折價券               │
        │  （平台 + 金門好康）      │
        └─────────┬────────────────┘
                  │
                  ▼
        ┌──────────────────────────┐
        │  消費（線下實體）         │
        │  ├ 商家獲得來客           │
        │  ├ 場域獲得回頭客         │
        │  └ 玩家獲得實際好處       │
        └─────────┬────────────────┘
                  │
                  ▼
        ┌──────────────────────────┐
        │  分享 / 邀朋友再來        │
        │  招募新人 → 雙向獎勵      │
        └─────────┬────────────────┘
                  │
                  └──→ 回到開頭
```

### 四贏結構

| 角色 | 得到什麼 |
|-----|---------|
| **玩家** | 玩遊戲娛樂 + 實際折價券 |
| **平台** | 用戶活躍度 + 跨場域協同 + 數據 |
| **場域** | 回頭客 + 行銷工具 + 商家配合 |
| **商家** | 帶人入店 + 精準客群 + 不用管理券 |

## 26.15 實作優先順序

### 階段 A：純內部閉環（先做這個）

**範圍**：規則引擎 + 平台自有券（不接外部）

**目的**：先驗證「遊戲 → 點數 → 獎勵」邏輯通

**動作**：
- [ ] 建 `reward_conversion_rules` table
- [ ] 建 `reward_conversion_events` table
- [ ] 建 `platform_coupons` + `coupon_templates`
- [ ] 規則引擎核心（評估 + 發放）
- [ ] 玩家「我的獎勵」頁面（只顯示平台券）
- [ ] 場域 admin 規則設定 UI（基本版）
- [ ] 5 個範例規則（場次里程碑、跨場域、MVP 等）

**估時**：2-3 週

### 階段 B：外部對接金門好康券

**前提**：階段 A 穩定 + coupon.aihomi.cc API 確定

**動作**：
- [ ] 建 `external_reward_integrations` + `squad_external_rewards`
- [ ] 對外 send 獎勵請求 API
- [ ] callback handler（接收券碼）
- [ ] 玩家「我的獎勵」頁加金門好康券 tab
- [ ] 跳轉到 aihomi 兌換頁
- [ ] 兌換完成 callback
- [ ] 場域 admin 規則 UI 增加「外部券」選項

**估時**：2 週（待 aihomi API 確定）

### 階段 C：進階管理工具

**動作**：
- [ ] 配額追蹤儀表板
- [ ] 兌換率分析
- [ ] 手動發券工具
- [ ] 規則 A/B testing
- [ ] 失敗事件 retry 機制

**估時**：2 週

## 26.16 為什麼這個設計超對

### 1. 解耦徹底
- 遊戲端不知道有獎勵
- 規則引擎不知道有外部 API
- 外部系統不知道有遊戲
- **每一層獨立可改**

### 2. 可重放
- 所有事件存 `reward_conversion_events`
- 改規則 → 可重新跑歷史事件
- 抓 bug → 看事件流就知道發生什麼

### 3. 多方擴充
- 新獎勵類型：加 1 個 Provider
- 新規則：場域 admin 自己加，不用工程
- 新對接夥伴：照 webhook 協定接

### 4. 商業價值最大化
- 玩遊戲 = 帶實際消費
- 平台、場域、商家、玩家**四贏**
- 跨場域 + 跨商家 + 跨遊戲類型協同

### 5. 預留未來
- coupon.aihomi.cc 是第一個對接
- 未來可接：其他第三方折價券、實體獎品物流、虛擬寶物、現金回饋
- **協定不變，新加 Provider 就好**

---

# 📝 結語（更新版）

> **「隊伍是長期資產，戰場是多元舞台，獎勵是商業閉環。」**

這份設計的目標：
1. ✅ 操作極簡（80% 不彈 Dialog）
2. ✅ 概念易懂（一個隊名打天下）
3. ✅ 推展優先（跨域加成 + 招募獎勵）
4. ✅ 包容多元（PvP / PvE / 純體驗 / 合作 / 個人）
5. ✅ 防作弊穩固（K 值 / 對手限制 / 重複限制）
6. ✅ 行銷自動化（通知流 + 排行榜 + 推廣連結）
7. ✅ 場域協同（歡迎隊伍 + 跨域加成）
8. ✅ **商業閉環（轉換節點 + 折價券 + 外部對接）⭐**

**完整生態系統**：
- **遊戲層**：5 種計分模式
- **隊伍層**：Squad 跨遊戲累積
- **獎勵層**：6 個排行榜 + 徽章 + 段位
- **轉換層**：⭐ 規則引擎 + 點數兌換
- **變現層**：⭐ 平台券 + 外部對接（金門好康券）
- **行銷層**：通知流 + 推廣連結 + 場域歡迎隊伍

---

_最後更新：2026-04-26_
_作者：Hung（大哉實業）+ Claude Code_
_狀態：📝 設計階段，等待最終確認_
