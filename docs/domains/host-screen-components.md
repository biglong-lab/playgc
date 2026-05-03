# Host Screen Components — 大螢幕互動元件總覽

> **更新日期**：2026-05-03
> **元件總數**：14 個（W19 + TeamBattleScore）
> **設計依據**：[ADR-0004 host-screen-axis](../decisions/0004-host-screen-axis.md) + [ADR-0013 W18 元件擴充](../decisions/0013-w18-component-expansion.md)

---

## 🎯 設計哲學

**三層協作**：
```
玩家手機（player）─ pulse ─→  WebSocket  ─→ 大螢幕（host）─ broadcast ─→ 所有玩家
                              ↑                ↓
                      sendPulse(type, payload)   onPulse(type, payload, currentState)
                                                 → 計算新 state → 廣播
```

每個 host 元件都包含：
- **純 UI**：`<XComponent>`（接 config / state / hostMode props）
- **純函式邏輯**：`reduceX(currentState, pulse) → newState`
- **Page wrapper**：`<XComponentPage>`（用 `useHostScreenSyncWithPulse` hook 連 WS）

---

## 📋 14 個元件總覽

| # | 元件 | pageType | 玩家互動 | 主要場景 |
|---|------|----------|----------|----------|
| 1 | PollLive | `host_poll_live` | 選項投票 | 民調、活動意向、群體決策 |
| 2 | EmojiReact | `host_emoji_react` | emoji 點擊 | 即時反饋、情緒互動 |
| 3 | WaveResponse | `host_wave_response` | 連點 / tap | 熱場、能量喚醒、應援 |
| 4 | CrowdGather | `host_crowd_gather` | 簽到 / check-in | 報到、達標進度 |
| 5 | LiveLeaderboard | `host_live_leaderboard` | 自動同步 | 競賽即時排名 |
| 6 | PolaroidCollage | `host_polaroid_collage` | 文字 + emoji | 婚禮、生日、紀念 |
| 7 | GuestbookDigital | `host_guestbook_digital` | 留言簽名 | 婚禮、聚會、紀念活動 |
| 8 | TriviaShowdown | `host_trivia_showdown` | 答題（多選） | 知識搶答、企業內訓 |
| 9 | ScoreboardAnnouncement | `host_scoreboard_announcement` | admin 主動播報 | 頒獎、成績公告 |
| 10 | KnowledgeMap | `host_knowledge_map` | 拜訪打卡 | 街區走讀、景點串聯 |
| 11 | LotteryWheel | `host_lottery_wheel` | 報名 + 旋轉 | 抽獎、隨機選擇 |
| 12 | ProgressQuest | `host_progress_quest` | 完成回報 | 任務進度、團隊里程碑 |
| 13 | WordCloud | `host_word_cloud` | 提交詞彙 | 關鍵字蒐集、發想互動 |
| 14 | **TeamBattleScore** | `host_team_battle_score` | 加分（雙隊） | **紅藍對抗、團體競賽、男女組互動** |

---

## 🗂️ 5 大市場 × 元件對照矩陣

### 1️⃣ 公部門：街區商圈、景點串聯、空間活化

| 元件 | 適配 | 用法 |
|------|------|------|
| **KnowledgeMap** | ⭐⭐⭐ | 街區走讀打卡、景點互動 |
| **TeamBattleScore** | ⭐⭐ | 商圈陣營對抗、街區紅藍隊集點 |
| CrowdGather | ⭐⭐ | 達標報到、活動計人數 |
| LiveLeaderboard | ⭐⭐ | 商圈集點競賽 |
| PolaroidCollage | ⭐ | 街區紀念回憶 |
| WordCloud | ⭐ | 民眾意見蒐集 |

**典型情境**：街區走讀（KnowledgeMap）+ 達標獎勵（CrowdGather）+ 社群留念（PolaroidCollage）

### 2️⃣ 私部門：企業內訓、員工旅遊、團隊互動

| 元件 | 適配 | 用法 |
|------|------|------|
| **TriviaShowdown** | ⭐⭐⭐ | 知識考核、訓練評估 |
| **ProgressQuest** | ⭐⭐⭐ | 團隊里程碑、進度可視化 |
| **TeamBattleScore** | ⭐⭐⭐ | **部門對抗賽、團建紅藍隊**（多市場核心元件）|
| LiveLeaderboard | ⭐⭐ | 部門 / 小組競賽 |
| ScoreboardAnnouncement | ⭐⭐ | 表揚 / 頒獎播報 |
| EmojiReact | ⭐ | 講者即時反饋 |

**典型情境**：內訓考核（TriviaShowdown）+ 團隊任務（ProgressQuest）+ 頒獎（ScoreboardAnnouncement）

### 3️⃣ 活動：破冰、熱場、群體投票答題、園遊會

| 元件 | 適配 | 用法 |
|------|------|------|
| **PollLive** | ⭐⭐⭐ | 群體投票答題 |
| **WaveResponse** | ⭐⭐⭐ | 熱場、群體應援 |
| **EmojiReact** | ⭐⭐⭐ | 破冰、即時情緒 |
| **LotteryWheel** | ⭐⭐⭐ | 抽獎、園遊會主節目 |
| **TeamBattleScore** | ⭐⭐⭐ | 派對紅藍對抗、男女組互動 |
| WordCloud | ⭐⭐ | 群體腦力激盪 |
| TriviaShowdown | ⭐⭐ | 競賽答題 |

**典型情境**：破冰（EmojiReact）→ 熱場（WaveResponse）→ 投票決定（PollLive）→ 抽獎結尾（LotteryWheel）

### 4️⃣ 空間：遊戲腳本、創意發想

| 元件 | 適配 | 用法 |
|------|------|------|
| **WordCloud** | ⭐⭐⭐ | 創意發想、共筆腦力激盪 |
| **ProgressQuest** | ⭐⭐⭐ | 解謎進度、章節推進 |
| KnowledgeMap | ⭐⭐ | 場域 NFC / QR 散點任務 |
| TriviaShowdown | ⭐⭐ | 解謎卡關問答 |
| PollLive | ⭐ | 群體決定情節走向 |

**典型情境**：場域解謎（KnowledgeMap）+ 進度推進（ProgressQuest）+ 創意收集（WordCloud）

### 5️⃣ 交誼：婚禮、生日、聚會

| 元件 | 適配 | 用法 |
|------|------|------|
| **PolaroidCollage** | ⭐⭐⭐ | 拍照拼貼、回憶牆 |
| **GuestbookDigital** | ⭐⭐⭐ | 數位簽名祝福 |
| **EmojiReact** | ⭐⭐⭐ | 即時情緒分享 |
| **TeamBattleScore** | ⭐⭐⭐ | 婚禮男女組互動、生日壽星陣營 |
| LotteryWheel | ⭐⭐ | 婚禮抽獎、生日禮物分配 |
| WaveResponse | ⭐⭐ | 主秀應援 |
| ScoreboardAnnouncement | ⭐ | 公告播報 |

**典型情境**：簽到（GuestbookDigital）+ 拍照牆（PolaroidCollage）+ 抽獎（LotteryWheel）+ 主秀應援（WaveResponse）

---

## 🧩 推薦元件組合

### 組合 A：「破冰熱場套餐」（活動）
1. EmojiReact（破冰）
2. WordCloud（蒐集自我介紹關鍵字）
3. PollLive（投票決定下一關）

### 組合 B：「企業團建套餐」（私部門）
1. TriviaShowdown（知識考核）
2. ProgressQuest（任務進度）
3. ScoreboardAnnouncement（頒獎播報）

### 組合 C：「婚禮交誼套餐」
1. GuestbookDigital（簽到）
2. PolaroidCollage（拍照牆）
3. LotteryWheel（抽獎主秀）
4. WaveResponse（主秀應援）

### 組合 D：「街區走讀套餐」（公部門）
1. KnowledgeMap（地圖打卡）
2. CrowdGather（達標報到）
3. LiveLeaderboard（隊伍排名）

### 組合 E：「場域解謎套餐」（空間）
1. ProgressQuest（章節進度）
2. TriviaShowdown（解謎答題）
3. WordCloud（線索收集）

### 組合 F：「紅藍對抗套餐」（多市場通用）
1. TeamBattleScore（雙隊計分主軸）
2. TriviaShowdown（搶答得分）
3. WaveResponse（陣營應援）
4. LotteryWheel（勝隊抽獎）

---

## ⚙️ 統一技術規範（W18 完成）

所有 13 個 host pages 已於 2026-05-03 W18 收尾統一以下 pattern：

```typescript
// ✅ 用 useMemo 穩定 config 物件 identity
const config = useMemo<XConfig>(() => {
  const raw = (page.config as { config?: XConfig } | XConfig | null) ?? null;
  return (raw && "config" in raw ? raw.config : (raw as XConfig | null)) ?? {};
}, [page.config]);

// ✅ handlePulse 用 useCallback、dep 依靠穩定值
const handlePulse = useCallback(
  (pulseType, payload, currentState) => { ... },
  [config], // config 是 useMemo 包過的、dep 穩定
);

// ✅ 透過 hook 連 WS
const { state, sendPulse, broadcastState, hostMode } =
  useHostScreenSyncWithPulse<XStateShape>({ onPulse: handlePulse });
```

---

## 📚 相關文件

- [ADR-0004 Host Screen 軸線設計](../decisions/0004-host-screen-axis.md)
- [ADR-0013 W18 元件擴充](../decisions/0013-w18-component-expansion.md)
- [Multiplayer Game Components](multiplayer-game-components.md) — 多人遊戲 client 元件
- [Game Components Audit](game-components-audit.md) — 整體元件健檢

---

## 🚀 未來擴充方向

依商業需求，可優先考慮新增（按 ROI 排序）：
1. ~~**TeamBattleScore**~~ ✅ 已完成（W19、commit a98781b4 + 6aee8f3e）
2. **PhotoMosaic** — 玩家拍照即時拼貼大馬賽克（婚禮 / 場域）
3. **TimeAuction** — 限時搶購 / 競標（活動 / 商圈）
4. **EmotionFlow** — 多階段情緒曲線回饋（內訓 / 演講後評估）
5. **InteractiveQuestion** — 玩家提問 + 票選 + admin 回答（演講 / 教育）
6. **ChainReaction** — 玩家接力傳遞（破冰、團建）
