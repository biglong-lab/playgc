# ADR-0004: HostScreen 獨立為第三軸線（不歸入 multi/）

> 日期：2026-05-02
> 狀態：✅ 採用中
> 影響：客戶端目錄結構、WebSocket 事件設計、認證模型、多人遊戲元件分類

---

## 背景

使用者明確指出「群體投票答題搭配螢幕顯示」是園遊會 / 破冰 / 熱場 / 公部門活動的核心場景。檢視 7 軸元件規劃時發現，這類玩法的技術需求與既有 `multi/` 元件根本不同：

- **既有 multi/**：玩家對玩家協作（隊伍內、人數有限、有重連狀態恢復、要 Squad 身份）
- **HostScreen**：主控大螢幕對玩家群眾單向廣播（無隊伍、人數可達數百、無認證觀看、無狀態恢復）

若強行歸入 `multi/`，會讓兩邊的 WebSocket 契約、reconnect 策略、認證模型互相干擾。

---

## 選項

### 方案 A — 歸入既有 multi/
- 🟢 不增加目錄
- 🔴 WebSocket 訊息要區分 team_xxx / host_xxx，混亂
- 🔴 reconnect 策略無法套用（HostScreen 不需要 snapshot）
- 🔴 認證模型衝突（multi 要 Firebase auth，host 大螢幕要無登入）

### 方案 B — 完全新建獨立模組
- 🟢 契約乾淨
- 🔴 跟既有 GamePageRenderer 整合複雜（要兩套渲染器）
- 🔴 走極端，破壞既有架構一致性

### 方案 C — 並列第三軸 host/（**選擇此方案**）
- 🟢 跟 solo/ multi/ 並列，架構一致
- 🟢 GamePageRenderer 用 pageType 區分，不需兩套渲染器
- 🟢 WebSocket 事件用 `host_*` prefix 區分契約
- 🟢 認證、reconnect 等可獨立設計
- 🟡 admin UI 多一個分類選項（可接受）

---

## 決定

**採方案 C — 並列第三軸 `host/`**

```
client/src/components/game/
├── solo/   ← 個人元件（已有 18 個）
├── multi/  ← 隊伍協作（已有 8 個）
└── host/   🆕 大螢幕主控（規劃 8 個）
```

---

## 技術契約（**lock，不可違反**）

### C1. 目錄結構

```
client/src/components/game/host/
├── PollLive.tsx              ← 元件本體
├── PollLivePage.tsx          ← 容器頁（GamePageRenderer 用）
├── EmojiReact.tsx
├── EmojiReactPage.tsx
├── WaveResponse.tsx
├── WaveResponsePage.tsx
├── TriviaShowdown.tsx
├── TriviaShowdownPage.tsx
├── LiveLeaderboard.tsx
├── LiveLeaderboardPage.tsx
├── CrowdGather.tsx
├── CrowdGatherPage.tsx
├── ScoreboardAnnouncement.tsx
├── ScoreboardAnnouncementPage.tsx
├── KnowledgeMap.tsx
├── KnowledgeMapPage.tsx
└── __tests__/
```

### C2. pageType 命名規則

所有 host 元件 pageType 必須以 `host_` 開頭：
- `host_poll_live`
- `host_emoji_react`
- `host_wave_response`
- `host_trivia_showdown`
- `host_live_leaderboard`
- `host_crowd_gather`
- `host_scoreboard_announcement`
- `host_knowledge_map`

### C3. 路徑

```
/host/:sessionId    ← 大螢幕模式（無登入、唯讀、自動全螢幕）
/play/:sessionId    ← 玩家手機端（可匿名、互動）
```

`/host/:sessionId` 進入時：
1. 不需 Firebase auth
2. 不顯示 PWA install prompt
3. 不顯示 PlayerBottomNav / FloatingHomeButton
4. 預設全螢幕、深色背景
5. URL 帶 `?token={hostToken}` 驗證主控身份（防外人冒充）

### C4. WebSocket 事件契約

新增三個事件（**全部 `host_*` prefix，不可與既有 team_/match_/session_ 混用**）：

```typescript
// 主控端註冊頻道
{
  type: "host_screen_register",
  sessionId: string,
  hostToken: string,    // 一次性 token，server 簽發
}

// 玩家端送訊號（投票、emoji、按鈕觸發）
{
  type: "host_screen_pulse",
  sessionId: string,
  pulseType: "vote" | "emoji" | "tap" | "answer" | "checkin",
  payload: unknown,    // 各 pulseType 自訂結構
}

// 主控端廣播當前狀態（給所有玩家 + 大螢幕共用）
{
  type: "host_screen_state",
  sessionId: string,
  state: unknown,      // 各元件自訂結構
}
```

### C5. 認證模型

| 端 | 認證 |
|----|------|
| `/host/:sessionId` 大螢幕 | hostToken（一次性、admin 簽發） |
| `/play/:sessionId` 玩家 | Firebase auth（可匿名）+ sessionId |
| Admin 建立 host session | Admin JWT |

**hostToken 機制**：
- admin 開啟 host session → server 簽發 12 小時有效 token
- 大螢幕網址 `https://game.homi.cc/host/:sessionId?token=xxx`
- token 過期需重新從 admin 後台拿新網址

### C6. 資料模型

**沿用 `game_sessions` 表**，加 `host_mode` 欄位：

```sql
ALTER TABLE game_sessions ADD COLUMN host_mode boolean DEFAULT false;
ALTER TABLE game_sessions ADD COLUMN host_token varchar;  -- nullable
ALTER TABLE game_sessions ADD COLUMN host_token_expires_at timestamp;
```

不另建表的理由：HostScreen session 跟一般 session 共用 player_progress / chat_messages 等表結構。

### C7. reconnect 策略

**HostScreen 不做隊伍 snapshot**，因為：
- 大螢幕重連 → server 廣播當前 state（state 是 server-side truth）
- 玩家重連 → 重新 join session room，等下次 host_screen_state 廣播

簡化版重連即可，不沿用 multi/ 的複雜重連邏輯。

### C8. GamePageRenderer 整合

```typescript
// client/src/components/game/GamePageRenderer.tsx
case "host_poll_live":
  return <PollLivePage page={page} />;
case "host_emoji_react":
  return <EmojiReactPage page={page} />;
// ... 其他 6 個
```

---

## 影響

### 紅線（必守）

- ❌ host/ 元件不得 import multi/ 或 solo/ 內部檔案
- ❌ pageType 不以 `host_` 開頭的元件不得放 host/
- ❌ host_screen_* WebSocket 事件不得用於 team / match / session 廣播
- ❌ /host/:sessionId 路徑下不得需要 Firebase auth
- ✅ host/ 內可共用 shared/ 元件（如 TextCard）

### 程式碼影響

- 新增目錄：`client/src/components/game/host/`
- 新增路徑：`/host/:sessionId`、`/play/:sessionId`
- Schema 變動：`game_sessions` 加 3 欄
- WebSocket 事件擴充：3 個 `host_*` 新事件
- `multiplayer-component-types.ts` 加 `'host'` 分類

### admin UI 影響

GameFormDialog 加第三個 gameMode 選項：
- `solo`（單人）
- `team`（隊伍）
- `host`（**主控大螢幕**）🆕

---

## 已知限制

- HostScreen session 結束後 hostToken 即失效，要重辦活動需重新從 admin 拿
- 大螢幕跟玩家不能跨網路（必須同 session）— 這是設計意圖
- 一個場域同時只能跑一個 host session（避免衝突）— 第二個 session 會被擋

---

## 後續可能變動

- 大型活動（>500 玩家）若 WebSocket 不夠 → 考慮 Redis pub/sub 取代 in-memory
- 跨 session 的「總排行榜」需求若出現 → 加 `host_session_groups` 表
- 主控端 OBS 整合（直播串流）→ 加 OBS browser source URL 模式

---

## 相關文件

- 12 週路徑：[changes/2026-05-02-multiplayer-component-platform.md](../changes/2026-05-02-multiplayer-component-platform.md)
- 多人元件規劃：[domains/multiplayer-game-components.md](../domains/multiplayer-game-components.md)
- 主軸領域：[domains/host-screen-protocol.md](../domains/host-screen-protocol.md)（待建）
- 程式碼：
  - 目錄：`client/src/components/game/host/`（待建）
  - 路徑：`client/src/App.tsx`（待加 routes）
  - Schema：`shared/schema/sessions.ts`（待加 host_mode 等欄位）
