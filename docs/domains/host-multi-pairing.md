# Host 大螢幕 ↔ Multi 玩家端 配對 Spec

> 範圍：17 個 host 大螢幕元件 vs 51 個玩家端互動元件 + 9 個工具元件
> 目的：admin 建場時知道「哪個 host 配哪個 multi 最有效果」、「我的客戶情境該選哪組」
> 最後更新：2026-05-07
> 相關：[Phase 1 D1 規劃](../changes/2026-05-07-phase-dbac-plan.md)

---

## 為什麼需要這份 spec？

賈村平台有兩條互動軸線：

```
┌─────────────────────────────────────────────────────┐
│  軸線 A：玩家端（手機，每人一支）                      │
│  /play/:sessionId  /g/:slug                         │
│  → 60 個 page_type（單人 22 + 多人關卡 13 + 互動 51）│
└─────────────────────────────────────────────────────┘
              ↕  雙螢幕同步互動
┌─────────────────────────────────────────────────────┐
│  軸線 B：大螢幕（投影機/電視，主持人控制）              │
│  /host/:sessionId?token=xxx                         │
│  → 17 個 host 元件（投票統計／emoji 雨／排行榜⋯）     │
└─────────────────────────────────────────────────────┘
```

**問題**：admin 不知道哪個 host 元件「應該配哪個 multi 元件」。沒有 spec 就只能瞎猜。

**這份 spec 解決**：給每個 host 元件配對 1-N 個建議 multi 元件 + 商業情境對應。

---

## 17 個 Host 元件配對表

### 🗳️ 投票/決策類（4 個）

| Host 元件 | page_type | 配對 Multi 元件 | 商業情境 | 配對說明 |
|----------|-----------|---------------|---------|---------|
| **PollLive** | `host_poll_live` | `vote` `vote_team` `spot_vote` | 活動：群體投票答題 / 內訓：意見收集 | 玩家投票 → 大螢幕即時統計長條圖。最經典配對。 |
| **MicroQa** | `host_micro_qa` | `choice_verify` `spot_vote` | 內訓：講者 Q&A / 活動：觀眾互動 | 講者出題、玩家送答案、大螢幕顯示。 |
| **TriviaShowdown** | `host_trivia_showdown` | `choice_verify_race` | 活動：知識競賽 / 公部門：在地知識 | 速度搶答、看誰先答對。 |
| **ScoreboardAnnouncement** | `host_scoreboard_announcement` | `vote_team` `shooting_team` `collective_score` | 活動：頒獎 / 內訓：團體競賽結算 | 大螢幕宣布得獎/勝隊。 |

---

### 🎉 熱場/應援類（3 個）

| Host 元件 | page_type | 配對 Multi 元件 | 商業情境 | 配對說明 |
|----------|-----------|---------------|---------|---------|
| **EmojiReact** | `host_emoji_react` | （獨立、不需 multi）| 活動：熱場 / 婚禮：賓客即時互動 | emoji 點擊送到大螢幕、emoji 雨。可配 `spot_vote` 強化「現在大家覺得怎樣」。 |
| **WaveResponse** | `host_wave_response` | （獨立）| 活動：開場熱身 | 大螢幕引導、所有人手機同時亮起人浪效果。 |
| **CrowdGather** | `host_crowd_gather` | `check_in` `safety_check` | 公部門：簽到聚眾 / 內訓：開場簽到 | 玩家掃 QR 簽到、大螢幕即時顯示人數。 |

---

### 📊 排行/積分類（3 個）

| Host 元件 | page_type | 配對 Multi 元件 | 商業情境 | 配對說明 |
|----------|-----------|---------------|---------|---------|
| **LiveLeaderboard** | `host_live_leaderboard` | `shooting_team` `collective_score` `vote_team` | 活動：競賽 / 內訓：團體挑戰 | 即時隊伍排名滾動更新。 |
| **TeamBattleScore** | `host_team_battle_score` | `vote_team` `shooting_team` `territory_capture` | 活動：團體對戰 / 私部門：團建 PK | 兩隊 PK 計分、戰鬥畫面感。 |
| **ProgressQuest** | `host_progress_quest` | `collective_score` `quest_chain` `gps_cascade` | 公部門：街區任務 / 內訓：學習路徑 | 集體進度條（每人完成 +1%）。 |

---

### 📸 視覺集合類（3 個）

| Host 元件 | page_type | 配對 Multi 元件 | 商業情境 | 配對說明 |
|----------|-----------|---------------|---------|---------|
| **PolaroidCollage** | `host_polaroid_collage` | `photo_team` `photo_burst` `photo_compare` | 婚禮：合照牆 / 同學會：拍立得 | 玩家拍照、大螢幕拼貼成壁畫。 |
| **WordCloud** | `host_word_cloud` | `brain_dump` `idea_wall` `peer_praise` | 內訓：腦力激盪 / 婚禮：祝福詞 | 玩家送詞、大螢幕詞雲動態大小。 |
| **GuestbookDigital** | `host_guestbook_digital` | `gratitude_tree` `wedding_vow` `wish_wall` | 婚禮：簽名牆 / 場域：留言板 | 數位簽到簿、永久保存。 |

---

### 🎲 抽獎/Bingo 類（2 個）

| Host 元件 | page_type | 配對 Multi 元件 | 商業情境 | 配對說明 |
|----------|-----------|---------------|---------|---------|
| **LotteryWheel** | `host_lottery_wheel` | （獨立、可配 `check_in` 限定簽到者參加）| 活動：抽獎 / 尾牙年會 | 大轉盤抽獎、現場感強。 |
| **BingoBoard** | `host_bingo_board` | `check_in`（多人簽到 bingo） | 園遊會：集點賓果 / 街區：商圈走訪 | 所有人共享一張 bingo、達成連線。 |

---

### 🗺️ 故事/旅程類（2 個）

| Host 元件 | page_type | 配對 Multi 元件 | 商業情境 | 配對說明 |
|----------|-----------|---------------|---------|---------|
| **KnowledgeMap** | `host_knowledge_map` | `quest_chain` `role_assign` `treasure_hunt` | 公部門：景點串聯 / 私部門：員工旅遊 | 大地圖 + 玩家完成的點亮起。 |
| **BlessingWall** | `host_blessing_wall` | `wedding_vow` `gratitude_tree` `wish_wall` | 婚禮：祝福牆 / 生日：許願牆 | 玩家送祝福、大螢幕滾動顯示。 |

---

## 完整商業情境組合範例

### 💝 婚禮派對情境包
```
host: PolaroidCollage（拍立得合照牆）
       BlessingWall（祝福牆）
       GuestbookDigital（數位簽到）
       LotteryWheel（抽獎）

multi: photo_team（合照）→ host PolaroidCollage
       wedding_vow（祝福卡）→ host BlessingWall
       gratitude_tree（感恩之樹）→ host BlessingWall
       check_in（賓客簽到）→ host GuestbookDigital
```

### 🎂 生日聚會情境包
```
host: BlessingWall（祝福牆）
       WordCloud（祝福詞雲）

multi: birthday_candle（生日許願）→ host BlessingWall
       peer_praise（讚美壽星）→ host WordCloud
       brain_dump（驚喜點子）→ host WordCloud
```

### 🎯 企業內訓情境包
```
host: PollLive（即時投票）
       ProgressQuest（學習進度）
       ScoreboardAnnouncement（結業頒獎）

multi: vote_team（隊伍意見）→ host PollLive
       kpt_retro（敏捷回顧）→ host WordCloud
       collective_score（學習分數）→ host ProgressQuest
       award_ceremony（結業頒獎）→ host ScoreboardAnnouncement
```

### 🏛️ 公部門場域活化
```
host: CrowdGather（簽到聚眾）
       BingoBoard（集點賓果）
       KnowledgeMap（景點地圖）
       ProgressQuest（探索進度）

multi: check_in（場域簽到）→ host CrowdGather
       venue_rating（場地評分）→ host WordCloud
       gps_cascade（GPS 連鎖任務）→ host KnowledgeMap
       treasure_hunt（尋寶）→ host KnowledgeMap
```

### 🎉 活動／破冰／頒獎
```
host: PollLive（即時投票）
       EmojiReact（emoji 雨）
       TriviaShowdown（搶答）
       LotteryWheel（抽獎）
       ScoreboardAnnouncement（頒獎）

multi: spot_vote / never_have_i_ever / would_you_rather → host PollLive
       choice_verify_race（隊伍搶答）→ host TriviaShowdown
```

---

## 「獨立 host」說明（不需要 multi 配對）

部分 host 元件**設計就是 self-contained**、不需要玩家端送資料：

- `EmojiReact` — 玩家自己 emoji 反應，host 收 WS 訊息直接動畫
- `WaveResponse` — 大螢幕主導、玩家手機只是被動亮起
- `LotteryWheel` — 抽獎本身在 host 端，玩家只是看結果

這些可以**不配 multi**也能跑、但配上適當 multi 會強化體驗。

---

## 接入 admin editor 的後續工作

下一步（D1 後續）：在 admin editor 選 page_type 時提示「建議搭配的大螢幕元件」。
實作位置：`client/src/pages/game-editor/constants.ts` PAGE_TYPES 新增 `pairedHosts: string[]` 欄位。

例如：
```ts
{ value: "vote_team", label: "隊伍投票（即時同步）👥",
  pairedHosts: ["host_poll_live", "host_scoreboard_announcement"], ... }
```

UI 在元件被選中時顯示 toast/banner：「💡 建議搭配大螢幕：📺 即時投票 / 📊 計分公告」

---

## 相關文件

- [host-screen-components.md](host-screen-components.md) — host 元件技術規格
- [multiplayer-game-components.md](multiplayer-game-components.md) — multi 元件技術規格
- [Phase DBAC 規劃](../changes/2026-05-07-phase-dbac-plan.md)
- [admin editor constants.ts](../../client/src/pages/game-editor/constants.ts)
