# 📺 HostScreen 軸線元件

> 設計依據：[`docs/decisions/0004-host-screen-axis.md`](../../../../../docs/decisions/0004-host-screen-axis.md)
> 第三軸線：solo / multi / **host**

---

## 用途

「群體投票答題搭配螢幕顯示」場景的元件群（園遊會 / 破冰 / 熱場 / 公部門活動核心）。

技術契約與 `multi/` 完全不同：
- 一對多單向廣播（大螢幕 → 玩家群眾）
- 無隊伍、無人數限制
- 無重連 snapshot 需求（state 由大螢幕端 server-broadcast）
- hostToken 認證（無 Firebase auth）

---

## 元件規劃（8 個）

| 元件 | pageType | 狀態 |
|------|----------|------|
| PollLive | `host_poll_live` | Phase 1 W2 首發 |
| EmojiReact | `host_emoji_react` | Phase 1 W3 |
| WaveResponse | `host_wave_response` | Phase 1 W3 |
| TriviaShowdown | `host_trivia_showdown` | Phase 1 W3 |
| LiveLeaderboard | `host_live_leaderboard` | Phase 1 W3 |
| CrowdGather | `host_crowd_gather` | Phase 1 W3 |
| ScoreboardAnnouncement | `host_scoreboard_announcement` | Phase 1 W4 |
| KnowledgeMap | `host_knowledge_map` | Phase 1 W4 |

---

## 新增元件流程

```bash
npm run scaffold:host PollLive
```

腳手架會生成：
- `PollLive.tsx` 元件本體（hostMode/玩家版型骨架）
- `PollLivePage.tsx` 容器頁
- `__tests__/PollLive.test.tsx` 測試樣板

接著手動：
1. 加 case 到 `client/src/components/game/GamePageRenderer.tsx`
2. 替換 TODO 區段
3. `npm run check` 驗 TS
4. `npm run test:run` 驗測試

---

## 元件範本契約

每個 host 元件接收 4 個 props：
- `config` — admin 後台填的設定（自訂結構）
- `hostMode: boolean` — 是否大螢幕端
- `state: unknown` — WS 訂閱的當前狀態
- `onPulse?(pulseType, payload)` — 玩家端送訊號
- `onBroadcastState?(state)` — 大螢幕端廣播狀態

---

## 紅線

- ❌ 不得 import multi/ 或 solo/ 內部檔案（共用走 shared/）
- ❌ pageType 不以 `host_` 開頭的元件不得放此目錄
- ❌ 不得使用 Firebase auth（依賴 hostToken）
