# Phase 2 W5 — HostScreen 軸線收尾（10/10 完成）

**日期**：2026-05-02
**範圍**：5 天連續推進 / 5 個新元件 / 28 個新測試
**狀態**：🟢 W5 完成、HostScreen 軸線 10/10、E2E 5 端點全綠

---

## 🎯 目標達成

> Phase 1 已完成 HostScreen 軸線 5/10（PollLive / EmojiReact / WaveResponse / CrowdGather / LiveLeaderboard）
> Phase 2 W5 補齊剩餘 5 個 — **整個 HostScreen 軸線正式 100% 就位**

---

## 📦 W5 5 個新元件

### W5 D1 — PolaroidCollage（M 級，紀念類）

**用途**：婚禮 / 派對 / 退休歡送 拍立得紀念牆

**核心特色**：
- Hash-based 旋轉角度（每張穩定 -10° ~ +10°）
- 12 個預設 emoji（💖🎉🥂💍🌹🎂✨🎊💐🎁💑👰）+ 6 種柔色卡背
- 大螢幕：拍立得自動瀑布、最新淡入、按 ts 排列
- 玩家：emoji + 100 字訊息表單，送出後不能再寫
- pulse: `polaroid` { emoji, message, color }

**測試**：6/6 通過
**Commit**：W5 D1

### W5 D2 — GuestbookDigital（S 級，紀念類）

**用途**：婚禮配套 / 退休歡送 數位簽名簿

**核心特色**：
- 翻頁式（6 entries/頁，可前後翻）
- 5 種水彩風背景（hash 穩定）
- 200 字訊息 + 30 字名字
- 大螢幕：手寫斜體字、頁碼底部
- 玩家：簽完顯示「已留下祝福」，不可重簽
- pulse: `sign` { name, message }

**測試**：6/6 通過
**Commit**：W5 D2

### W5 D3 — TriviaShowdown（M 級，競賽類）

**用途**：園遊會主舞台 / 課堂搶答 / 多回合知識競賽

**核心特色**：
- 多題搶答（intro → answering → revealed → ended）
- 4 色選項按鈕（A 紅 / B 藍 / C 綠 / D 黃）
- 倒數 timeLimitSec（預設 15s），超時自動 reveal
- 排名計分：前 N 名得 [100, 75, 50, 25] 分
- 結束顯示 🥇🥈🥉 + Top 10
- pulse: `answer` { choice }

**測試**：6/6 通過
**Commit**：W5 D3

### W5 D4 — ScoreboardAnnouncement（S 級，競賽 + 通用）

**用途**：賽事插播得分 / 活動通知 / 現場廣播

**核心特色**：
- 3 種公告類型 + 漸層底色：
  - `score`：blue→cyan 🏆 得分
  - `info`：zinc 📣 通知
  - `celebrate`：yellow→orange 🎉 慶祝
- 大螢幕：頂部跑馬燈（最近 5 則）+ 中間大字（最新一則 8 秒淡出）
- 大螢幕底部 admin 表單（type select + 100 字 input + 播報按鈕）
- 玩家：唯讀最近 20 則
- 不接受玩家 pulse — admin 直接 broadcastState
- 用基本版 `useHostScreenSync`

**測試**：6/6 通過
**Commit**：`7554be00`

### W5 D5 — KnowledgeMap（M 級，場域類）⭐ HostScreen 軸線收尾

**用途**：街區商圈 / 景點串聯 / 空間活化 / 企業園區導覽

**核心特色**：
- 大螢幕場域全景圖（POI 點百分比座標散布、可選背景圖）
- 熱力化 marker：依造訪人數變色（zinc → blue → emerald → amber → red）
- 已造訪 POI 顯示計數徽章 + 漣漪動畫
- 大螢幕頂部統計（總打卡 / 參與者 / 地標數）
- 大螢幕底部跑馬燈（最近 8 則打卡 + 留言）
- 玩家：列表式 POI（展開後輸入留言 + 打卡）
- 名字 input + 80 字留言（可選）
- pulse: `visit` { pointId, name, message? }
- 預設 5 個金門地標（後浦老街 / 莒光樓 / 翟山坑道 / 金門酒廠 / 水頭聚落）

**測試**：9/9 通過
**Commit**：（本次 W5 D5）

---

## 🔧 配套基建

### 1. ShowcaseHub demo 全面擴充

- 新增 5 個 W5 元件 demo 卡片區段（紀念類 + 競賽類）
- 加入 10 個 demo 入口（5 元件 × 雙版型）
- HostDemo 類型擴充至 25 個 demo 模式
- 每個 demo 有逼真資料（婚禮、賽事、金門地標）

### 2. PAGE_TYPES stale test 修正

- W3-W5 累積導致 PAGE_TYPES 從 27 增至 30，但 test 未同步
- 一次修正 `client/src/pages/game-editor/constants.test.ts`：
  - 期望長度 27 → 30
  - multi 元件清單從 5 個（含 photo_team / vote_team / shooting_team / gps_team_mission / choice_verify_race）
    擴充到 8 個（加 lock_coop / relay_mission / territory_capture）

### 3. Renderer 註冊

每個 W5 元件都四件套就位：
- `XxxComponent.tsx`（純 UI / 純函式 reducer）
- `XxxComponentPage.tsx`（容器、useHostScreenSync 整合）
- `__tests__/XxxComponent.test.tsx`（vitest + RTL）
- `HostPageRenderer` + `GamePageRenderer` 雙註冊

---

## 📊 元件狀態總覽

### HostScreen 軸線 — 10/10 ✅ 全部就位

| # | 元件 | 級別 | 階段 | 狀態 |
|---|------|------|------|------|
| 1 | PollLive | M | W2 | ✅ |
| 2 | EmojiReact | S | W3 D1 | ✅ |
| 3 | WaveResponse | S | W3 D2 | ✅ |
| 4 | CrowdGather | S | W3 D3 | ✅ |
| 5 | LiveLeaderboard | M | W3 D4 | ✅ |
| 6 | PolaroidCollage | M | W5 D1 | ✅ |
| 7 | GuestbookDigital | S | W5 D2 | ✅ |
| 8 | TriviaShowdown | M | W5 D3 | ✅ |
| 9 | ScoreboardAnnouncement | S | W5 D4 | ✅ |
| 10 | KnowledgeMap | M | W5 D5 | ✅ |

### 累積測試
- HostScreen 軸線：85 個測試（W5 新增 33 個）
- Multi 軸線：60+ 個測試
- 整體 host + multi：150+ 個測試

---

## 🎬 商業情境覆蓋

| 市場 | 對應元件 |
|------|---------|
| 婚禮 / 派對 | PolaroidCollage（紀念牆）+ GuestbookDigital（簽名簿）+ EmojiReact（情緒池）|
| 園遊會 / 主舞台 | TriviaShowdown（搶答）+ LiveLeaderboard（排行）+ ScoreboardAnnouncement（播報）|
| 街區商圈 / 景點 | KnowledgeMap（全景地圖）+ CrowdGather（聚眾）|
| 企業內訓 | TriviaShowdown + PollLive + LiveLeaderboard |
| 演講 / 課堂 | EmojiReact + PollLive + WaveResponse |

**結論**：5 大市場的 HostScreen 場景全部有元件可組合 — 進入 W6 情境模板階段。

---

## ⏭ 下一步：Phase 2 W6

- 12 個情境模板 — TemplateMarket（已 scaffold，補上婚禮 / 園遊會 / 街區 / 內訓四大模板）
- 客戶可一鍵套用模板，省去逐元件選的時間
- 配套：模板預覽圖（取自 ShowcaseHub demo screenshot）

---

## 🔗 相關文件

- ADR：`docs/decisions/0004-host-screen-axis.md`
- 多人元件平台主計畫：`docs/changes/2026-05-02-multiplayer-component-platform.md`
- W5 各元件原始碼：`client/src/components/game/host/`
