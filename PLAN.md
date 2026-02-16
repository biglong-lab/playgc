# 賈村競技場 - 平台優化規劃

## 你的初步需求整理

### 1. 模組化堆疊系統
> 遊戲可以像積木一樣，用不同模組（頁面類型）堆疊組合出各種玩法

**目前狀態**：已有 15 種 pageType，但都是**線性排列**（頁面 1 → 2 → 3 → 結束）
**缺少**：模組之間的邏輯連結（條件分支、迴圈、隨機路徑）

### 2. 單人 vs 多人模式
> 遊戲可以選擇單人或多人進行

**目前狀態**：已有 `gameMode: "individual" | "team"` ✅
**缺少**：多人**競爭**模式（同場對戰而非合作）

### 3. 一次性 vs 章節持續制
> 有些遊戲玩一次就結束，有些可以分章節持續玩下去

**目前狀態**：只有一次性模式（開始 → 結束），無章節概念 ❌
**缺少**：章節系統、進度跨場次保存、解鎖機制

### 4. 免費 vs 付費遊戲
> 有些隨時免費玩，有些需要付費

**目前狀態**：完全沒有付費機制 ❌（build.ts 有 stripe 但未使用）
**缺少**：定價、購買、票券系統

---

## 規劃方案

### Phase 1：章節與進度系統（最核心，影響所有後續功能）

**為什麼先做**：沒有章節系統，就無法區分「一次性遊戲」和「持續性遊戲」，也無法做付費解鎖。

#### 1A. 新增 Schema

```
gameChapters（遊戲章節）
├─ id (UUID)
├─ gameId (FK → games)
├─ chapterOrder (排序)
├─ title（章節名稱）
├─ description
├─ coverImageUrl
├─ unlockCondition (JSONB)
│  ├─ type: "free" | "previous_complete" | "score_threshold" | "purchase" | "date"
│  ├─ requiredChapterId?
│  ├─ requiredScore?
│  ├─ unlockDate?
│  └─ purchaseRequired? (→ 連結 Phase 3)
├─ estimatedTime（分鐘）
├─ status: "locked" | "available" | "coming_soon"
├─ createdAt
└─ updatedAt

playerChapterProgress（玩家章節進度）
├─ id (UUID)
├─ userId (FK → users)
├─ gameId (FK → games)
├─ chapterId (FK → gameChapters)
├─ status: "locked" | "unlocked" | "in_progress" | "completed"
├─ bestScore
├─ completionCount（重玩次數）
├─ firstCompletedAt
├─ lastPlayedAt
├─ savedState (JSONB) ← 暫存進度（中斷恢復用）
│  ├─ currentPageIndex
│  ├─ score
│  ├─ inventory
│  └─ variables
└─ updatedAt
```

#### 1B. 修改現有 Schema

```
games 新增欄位：
├─ gameStructure: "single" | "chapters"  ← 區分一次性/章節制
├─ chapterCount（章節總數，給前端顯示用）
└─ progressPersistence: "session" | "permanent"  ← 進度是否跨場次保存

pages 新增欄位：
└─ chapterId (FK → gameChapters, nullable)  ← 頁面歸屬章節
```

#### 1C. 前端變更
- Home 頁面：顯示章節進度（如 3/10 章已完成）
- 新增「章節選擇」頁面（遊戲入口 → 選章節 → GamePlay）
- GamePlay：支援章節結束後回到章節列表（而非直接結束遊戲）
- 遊戲編輯器：支援建立/管理章節、拖拉頁面到不同章節

---

### Phase 2：遊戲模式擴充

#### 2A. 新增遊戲模式

```
games.gameMode 擴充：
"individual"     → 單人（現有）
"team"           → 團隊合作（現有）
"competitive"    → 多人競爭（新增）← 同場不同隊比賽
"relay"          → 接力賽（新增）← 隊員輪流完成不同關卡
```

#### 2B. 競爭模式邏輯
- 多支隊伍同時進行同一遊戲
- 即時排名看板（WebSocket 推送分數變化）
- 計時賽 or 計分賽
- 支援觀戰模式（場主可看所有隊伍進度）

#### 2C. 新增 Schema

```
gameMatches（對戰場次 - 管理多隊同場競爭）
├─ id (UUID)
├─ gameId (FK → games)
├─ chapterId? (FK → gameChapters, nullable)
├─ status: "waiting" | "countdown" | "playing" | "finished"
├─ maxTeams
├─ startedAt
├─ finishedAt
├─ settings (JSONB)
│  ├─ timeLimit（秒）
│  ├─ scoringMode: "speed" | "accuracy" | "combined"
│  └─ showRealTimeRanking: boolean
└─ createdAt

matchParticipants（對戰參與者）
├─ id (UUID)
├─ matchId (FK → gameMatches)
├─ teamId? (FK → teams, nullable)
├─ userId? (FK → users, nullable) ← 單人競爭時
├─ sessionId (FK → gameSessions)
├─ finalScore
├─ finalRank
├─ finishedAt
└─ joinedAt
```

---

### Phase 3：付費與票券系統

#### 3A. 定價模型

```
games 新增欄位：
├─ pricingType: "free" | "paid" | "freemium"
│  ├─ free → 完全免費
│  ├─ paid → 需購買才能玩
│  └─ freemium → 基礎免費，進階章節付費
├─ price (DECIMAL) ← paid 模式的價格
└─ currency: "TWD" | "USD"
```

#### 3B. 票券系統（適合實體場域）

```
tickets（票券）
├─ id (UUID)
├─ gameId (FK → games)
├─ chapterId? (FK → gameChapters, nullable)
├─ ticketType: "single_play" | "day_pass" | "season_pass" | "chapter_unlock"
├─ price (DECIMAL)
├─ currency
├─ validDays（有效天數）
├─ maxUses（最大使用次數）
├─ description
├─ isActive
└─ createdAt

playerTickets（玩家持有票券）
├─ id (UUID)
├─ userId (FK → users)
├─ ticketId (FK → tickets)
├─ purchasedAt
├─ expiresAt
├─ usedCount
├─ status: "active" | "expired" | "used_up"
└─ paymentId? ← 連結金流紀錄

payments（付款紀錄）
├─ id (UUID)
├─ userId (FK → users)
├─ amount (DECIMAL)
├─ currency
├─ paymentMethod: "stripe" | "line_pay" | "cash" | "complimentary"
├─ paymentStatus: "pending" | "completed" | "failed" | "refunded"
├─ stripePaymentIntentId?
├─ metadata (JSONB)
├─ createdAt
└─ updatedAt
```

#### 3C. 為什麼用票券而非直接購買
- 場域可以**現場售票**（掃 QR → 付現 → 場主手動發票券）
- 支援**套票**（一日通行、季票、團體票）
- 贈品/活動免費票券（`paymentMethod: "complimentary"`）
- 未來可擴充優惠碼

---

### Phase 4：模組流程引擎（進階）

目前頁面是**純線性**（1→2→3→...→N），這裡要升級為**流程圖**。

#### 4A. 頁面連結邏輯

```
pages 新增欄位：
├─ nextPageLogic (JSONB)
│  ├─ type: "sequential" | "conditional" | "random" | "branch"
│  ├─ conditions?: [{
│  │     condition: { variable: "score", operator: ">=", value: 80 },
│  │     targetPageId: "page-xxx"
│  │  }]
│  ├─ branches?: [{ label: "選擇A", targetPageId: "page-aaa" }]
│  ├─ randomPool?: ["page-1", "page-2", "page-3"]  ← 隨機選一
│  └─ defaultTargetPageId?  ← 條件都不符時
├─ isEntryPoint (boolean) ← 標記為章節/遊戲起點
└─ isEndPoint (boolean) ← 標記為結束點
```

#### 4B. 視覺化流程編輯器
- 拖拉節點式編輯（類似 Node-RED / Scratch）
- 可視化看到分支路徑
- 預覽模式：模擬玩家走不同路線

---

## 我的額外建議（你沒提到但建議加入的）

### A. 遊戲市集 / 模板商店
> 讓不同場域可以分享或販售遊戲模板

```
gameMarketplace
├─ 場主 A 建立了一個很棒的遊戲
├─ 發佈到市集（公開 or 定價）
├─ 場主 B 購買/引用該模板
├─ 自動複製遊戲結構到場主 B 的場域
└─ 原作者獲得分潤（可選）
```

**價值**：降低新場主的內容創作門檻，形成內容生態

### B. 玩家成就與收藏系統（跨遊戲）
> 目前成就綁定在單一遊戲，建議加入平台級成就

```
platformAchievements
├─ "探索家" → 完成 5 個不同場域的遊戲
├─ "常客" → 同一場域玩過 10 次
├─ "社交蝴蝶" → 組過 5 支不同的隊伍
├─ "收藏家" → 解鎖 50 個遊戲成就
└─ 顯示在玩家個人檔案
```

**價值**：提升玩家黏著度，鼓勵跨場域遊玩

### C. 遊戲數據分析儀表板（場主端強化）
> 目前只有基本的 session 統計

```
增強分析：
├─ 漏斗分析：哪一關流失最多玩家？
├─ 熱力圖：玩家在地圖上的移動軌跡
├─ 答題分析：哪個問題答錯率最高？
├─ 時間分析：每關平均花費時間
├─ 營收分析：票券銷售、退款率（Phase 3 後）
└─ A/B 測試：同一遊戲不同版本的完成率比較
```

**價值**：幫助場主持續優化遊戲品質

### D. 離線模式支援
> 戶外遊戲常遇到網路不穩

```
離線策略：
├─ 遊戲資料預載（進入遊戲時下載所有頁面配置）
├─ 離線進度暫存（localStorage / IndexedDB）
├─ 網路恢復時自動同步
├─ GPS 任務離線驗證（預載座標資料）
└─ PWA 支援（可安裝到手機桌面）
```

**價值**：提升戶外遊戲的穩定性和使用體驗

### E. 動態難度調整
> 根據玩家表現自動調整遊戲難度

```
pages.config 增加：
├─ difficultyLevels: {
│    easy: { hints: 3, timeLimit: 120 },
│    medium: { hints: 1, timeLimit: 60 },
│    hard: { hints: 0, timeLimit: 30 }
│  }
├─ 自動判斷：前 3 關連續答錯 → 降低難度
├─ 自動判斷：前 3 關都在 10 秒內答對 → 提高難度
└─ 場主可設定啟用/停用
```

**價值**：讓不同程度的玩家都有好的遊戲體驗

### F. 排程與活動系統
> 遊戲可以設定特定時段才開放

```
gameSchedules（遊戲排程）
├─ id
├─ gameId
├─ scheduleType: "always" | "time_window" | "recurring" | "event"
├─ startTime, endTime
├─ recurringPattern (JSONB) ← 每週六 14:00-17:00
├─ maxConcurrentSessions ← 同時最多幾組在玩
└─ registrationRequired (boolean) ← 是否需要事先報名
```

**價值**：適合實體場域管理人流，也能營造限時活動的稀缺感

---

## 建議實作優先順序

| 順序 | 功能 | 複雜度 | 影響範圍 | 理由 |
|------|------|--------|---------|------|
| **1** | Phase 1：章節與進度系統 | 高 | Schema + 前後端 | 所有後續功能的基礎 |
| **2** | Phase 3：付費與票券系統 | 中 | Schema + 後端 + 金流 | 商業模式核心 |
| **3** | Phase 2：遊戲模式擴充 | 中 | Schema + WebSocket | 豐富玩法多樣性 |
| **4** | 建議 F：排程與活動 | 低 | Schema + 後端 | 場域管理必需 |
| **5** | 建議 D：離線模式 | 中 | 前端為主 | 使用體驗關鍵 |
| **6** | Phase 4：流程引擎 | 高 | 全棧 | 最強大但最複雜 |
| **7** | 建議 A：遊戲市集 | 高 | 全棧 | 生態系統，中長期 |
| **8** | 建議 B：跨遊戲成就 | 低 | Schema + 前端 | 玩家黏著度 |
| **9** | 建議 C：進階分析 | 中 | 後端 + 前端 | 場主價值 |
| **10** | 建議 E：動態難度 | 低 | 前端為主 | 體驗優化 |

---

## 技術前置工作（在開始 Phase 1 之前）

1. **修復 10 個 pre-existing TS 錯誤** ← 避免後續開發被干擾
2. **處理 5 個 npm audit 漏洞** ← 安全基礎
3. **提升測試覆蓋率** ← 大改架構前需要測試保護網

---

*此規劃基於目前 26 個資料表、15 種頁面類型、完整的團隊/RBAC/硬體整合的現有架構*
