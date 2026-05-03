# 🎬 情境模板 — 16 個（5 大市場全覆蓋）

> 預設好的元件組合包、客戶選一個就能 30 分鐘現場可玩
> 設計依據：[Phase 2 W6 一鍵建場 ADR](../changes/2026-05-02-phase2-complete.md)

---

## 🎯 什麼是情境模板？

**單一情境 = 多元件預設組合 + 業務文案 + 收費建議 + admin 一鍵建場**

```
客戶問：「我要辦婚禮、有什麼？」
  ↓
業務 → 推「婚禮派對情境包」
  ↓
admin 後台一鍵建場（含 3 個元件 + 預設文案 + QR）
  ↓
A4 列印 QR → 婚禮現場貼桌卡 → 賓客掃 + 互動
```

**規格**：[`shared/scenario-templates.ts`](../../shared/scenario-templates.ts)（533 行、12 情境）

---

## 💝 交誼類（4 個）

### 1. wedding — 婚禮派對情境包 ✅ live

| 項目 | 內容 |
|------|------|
| **Tagline** | 拍立得紀念牆 + 數位簽名簿 + 情緒池 |
| **適用** | 婚宴主桌投影、二進場前儀式、戶外證婚台、迎賓區牆面 |
| **人數** | 30-300 人 |
| **時長** | 2-4 小時 |
| **收費** | NT$ 8,000-15,000 / 場 |
| **狀態** | ✅ live |

**含元件**：
- PolaroidCollage（拍立得紀念牆）— 大螢幕主視覺
- GuestbookDigital（數位簽名簿）— 替代紙本
- EmojiReact（情緒池應援）— 戒指交換時刻 emoji 雨

**商業價值**：替代傳統紙本簽名簿、提供拍照分享素材、活動結束後新人可下載完整紀錄

---

### 2. birthday — 生日派對情境包 ✅ live

| 項目 | 內容 |
|------|------|
| **Tagline** | 回憶相簿 + 祝福瀑布 + 全場情緒池 |
| **適用** | 壽宴主桌投影、親友聚餐、公司同事慶生、兒童生日派對 |
| **人數** | 10-80 人 |
| **時長** | 1-3 小時 |
| **收費** | NT$ 3,000-6,000 / 場 |
| **狀態** | ✅ live |

**含元件**：
- PolaroidCollage（回憶相簿牆）
- GuestbookDigital（生日留言簿）
- EmojiReact（派對情緒池）— 切蛋糕、吹蠟燭時全場應援

**商業價值**：輕量版婚禮模板、適合中小型私人場合

---

### 3. reunion — 同學會 / 聚會情境包 ✅ live

| 項目 | 內容 |
|------|------|
| **Tagline** | 重逢搶答 + 故事接龍 + 數位簽名簿 |
| **適用** | 畢業 N 週年同學會、工作老同事聚會、社團校友會 |
| **人數** | 10-60 人 |
| **時長** | 2-3 小時 |
| **收費** | NT$ 2,000-5,000 |
| **狀態** | ✅ live |

**含元件**：
- TriviaShowdown（重逢搶答）— 「誰最快結婚？」、「誰是當年校隊隊長？」
- GuestbookDigital（回憶簽名簿）— 近況留言、聯絡方式更新
- PolaroidCollage（重逢拍立得）— 現場合照即時上牆

**商業價值**：輕量、不複雜、主辦方一人就能搞定

---

### 4. kids-adventure — 親子冒險情境包 ✅ live

| 項目 | 內容 |
|------|------|
| **Tagline** | 尋寶任務 + 拼圖協作 + 應援池 |
| **適用** | 百貨親子節活動、親子館主題日、主題樂園定點互動、暑期夏令營、兒童節市集 |
| **人數** | 5-50 組親子 |
| **時長** | 60-120 分鐘 |
| **收費** | NT$ 8,000-25,000 / 場 + 月訂閱 |
| **狀態** | ✅ live |

**含元件**：
- TreasureHunt（尋寶任務）— 親子一起找線索、解謎
- JigsawPuzzle（拼圖協作）— 孩子貼拼圖、家長拍照
- EmojiReact（終點應援池）— 完賽時全場 emoji 慶祝

**商業價值**：親子市場高黏著度、可日常常駐主題館 + 節慶包裝活動

---

## 🎉 活動類（3 個）

### 5. carnival-stage — 園遊會主舞台 ✅ live

| 項目 | 內容 |
|------|------|
| **Tagline** | 搶答秀 + 即時排行 + 全場應援 |
| **適用** | 大學校慶園遊會、商場開幕活動、社區嘉年華、夏日祭 |
| **人數** | 50-500 人 |
| **時長** | 20-60 分鐘 |
| **收費** | NT$ 15,000-30,000 / 場（場次包套）|
| **狀態** | ✅ live |

**含元件**：
- TriviaShowdown（知識搶答）— 在地知識題、品牌冷知識
- LiveLeaderboard（即時排行）— 金銀銅排行榜投影
- WaveResponse（全場應援）— 節目高潮時的人浪
- ScoreboardAnnouncement（跑馬燈播報）— 得分插播、活動公告

**商業價值**：搭配主持人腳本就是一場 30 分鐘節目

---

### 6. icebreaker — 破冰熱場情境包 ✅ live

| 項目 | 內容 |
|------|------|
| **Tagline** | 聚眾簽到 + 拼圖協作 + emoji 池 |
| **適用** | 新進員工訓練、夏令營報到、讀書會首次聚會、社團迎新 |
| **人數** | 10-80 人 |
| **時長** | 30-60 分鐘 |
| **收費** | NT$ 5,000-12,000 / 場 |
| **狀態** | ✅ live |

**含元件**：
- CrowdGather（聚眾簽到）— 報到熱場、達標 banner
- JigsawPuzzle（拼圖協作）— 分組拼圖破冰
- EmojiReact（情緒池）— 結尾全場互動

**商業價值**：顧問入場前 30 分鐘暖身

---

### 7. awards-ceremony — 頒獎典禮情境包 🟡 preview

| 項目 | 內容 |
|------|------|
| **Tagline** | 即時投票 + 跑馬燈 + 全場掌聲 |
| **適用** | 公司年會頒獎、競賽結果公佈、校園金鼎獎 |
| **人數** | 50-500 人 |
| **時長** | 30-90 分鐘 |
| **收費** | NT$ 8,000-20,000 |
| **狀態** | 🟡 preview |

**含元件**：
- PollLive（即時投票）— 「人氣獎」由觀眾票選
- ScoreboardAnnouncement（跑馬燈得獎）— 輪播得獎名單
- EmojiReact（全場應援）— 得獎時的 emoji 雨

**商業價值**：頒獎場合的觀眾參與機制

---

## 🏛 公部門類（2 個）

### 8. street-walk — 街區走讀情境包 ✅ live

| 項目 | 內容 |
|------|------|
| **Tagline** | GPS 連鎖點 + 場域全景 + 簽到牆 |
| **適用** | 金門後浦老街、台南神農街、迪化街文創導覽、校園歷史散步 |
| **人數** | 5-100 人 |
| **時長** | 30-90 分鐘 |
| **收費** | NT$ 80,000-200,000 / 季（公部門委辦）|
| **狀態** | ✅ live |

**含元件**：
- GpsCascade（連鎖點解鎖）— 強制走訪每一站
- KnowledgeMap（場域全景地圖）— 大螢幕呈現所有人軌跡
- CrowdGather（簽到熱場）— 起點集合、達標解鎖

**商業價值**：公部門委辦案、觀光局街區活化

---

### 9. district-checkin — 商圈打卡情境包 🟡 preview

| 項目 | 內容 |
|------|------|
| **Tagline** | 尋寶任務 + 場域全景 + 排行榜 |
| **適用** | 夜市導覽、商圈集章、美食街尋寶、市集 X 活動 |
| **人數** | 20-200 人 |
| **時長** | 1-3 小時 |
| **收費** | NT$ 30,000-100,000 / 場 |
| **狀態** | 🟡 preview |

**含元件**：
- TreasureHunt（尋寶任務）— 店家線索拼密碼
- KnowledgeMap（商圈全景）— 店家熱度視覺化
- LiveLeaderboard（尋寶排行）— 前 10 名上榜

**商業價值**：商圈聯合活動

---

## 💼 私部門類（2 個）

### 10. corporate-training — 企業內訓情境包 ✅ live

| 項目 | 內容 |
|------|------|
| **Tagline** | 搶答 + 即時投票 + 角色分派 |
| **適用** | 新進員工訓練、中階主管培訓、業務技能訓練、顧問講座 |
| **人數** | 10-50 人 |
| **時長** | 2-4 小時 |
| **收費** | NT$ 1,500-5,000 / 帳號 / 月（訂閱）|
| **狀態** | ✅ live |

**含元件**：
- TriviaShowdown（知識搶答）— 驗收 + 競賽氛圍
- PollLive（即時投票）— 決策模擬、議題討論
- RoleAssign（角色分派）— 情境模擬、劇本演練

**商業價值**：顧問 / 講師端的 SaaS、月訂閱

---

### 11. company-trip — 員工旅遊情境包 🟡 preview

| 項目 | 內容 |
|------|------|
| **Tagline** | 團體合影 + GPS 任務 + 聚會留念 |
| **適用** | 年度員工旅遊、部門團建、Off-site Workshop |
| **人數** | 20-100 人 |
| **時長** | 半天 - 1 天 |
| **收費** | NT$ 10,000-30,000 / 場 |
| **狀態** | 🟡 preview |

**含元件**：
- PhotoTeamFlow（團體合影）— 分組拍照、自動合成
- GpsTeamMission（GPS 隊伍任務）— 拓荒、找特定地標
- GuestbookDigital（團隊簽名簿）— 活動結束時的留念

**商業價值**：HR 一人就能搞定整天活動

---

## 🏠 空間類（1 個）

### 12. venue-storyline — 場域故事情境包 ✅ live

| 項目 | 內容 |
|------|------|
| **Tagline** | NPC 對話 + 任務鏈 + 紀念牆 |
| **適用** | 主題民宿、故事咖啡廳、小型博物館、AR 互動展 |
| **人數** | 1-20 人 |
| **時長** | 30-90 分鐘 |
| **收費** | NT$ 800-2,500 / 月 + 活動分潤（訂閱）|
| **狀態** | ✅ live |

**含元件**：
- dialogue（NPC 對話）— 場域主人公開場介紹（已存在於 shared/components/）
- TreasureHunt（任務鏈）— 解謎找密碼、解鎖故事
- PolaroidCollage（紀念牆）— 客人離開前留念

**商業價值**：民宿 / 餐廳長期訂閱

---

## ✨ W22 新增情境（2 個）

### 13. wedding-deluxe — 婚禮派對 ✨ 升級版 ✅ live

| 項目 | 內容 |
|------|------|
| **Tagline** | 祝福瀑布 + 拍立得牆 + 賓客 Bingo + 情緒池 |
| **適用** | 大型婚宴主桌投影、海外婚禮現場直播、戶外證婚台、二次戶外婚禮 |
| **人數** | 50-300 人 |
| **時長** | 3-5 小時 |
| **收費** | NT$ 12,000-20,000 / 場 |
| **狀態** | ✅ live |

**含元件**（4 個）：
- BlessingWall（祝福瀑布牆、W22 新增）— 戒指交換時刻全場飄
- PolaroidCollage（拍立得紀念牆）
- BingoBoard（賓客 Bingo、W22 新增）— 「找穿紅衣賓客」「跟新郎合照」
- EmojiReact（情緒池）— 拋捧花時 emoji 雨

**商業價值**：婚禮升級版、4 元件互動體驗、適合追求記憶深刻的新人

---

### 14. carnival-bingo — 園遊會 Bingo 集章嘉年華 ✅ live

| 項目 | 內容 |
|------|------|
| **Tagline** | Bingo 集章 + 即時排行 + 跑馬燈 + 全場應援 |
| **適用** | 大學校慶園遊會、百貨週年慶、夜市夏日祭、社區園遊嘉年華 |
| **人數** | 100-500 人 |
| **時長** | 2-4 小時 |
| **收費** | NT$ 25,000-50,000 / 場（包套） |
| **狀態** | ✅ live |

**含元件**（4 個）：
- BingoBoard（25 個攤位、W22 新增）— 走訪攤位即時集章
- LiveLeaderboard（Bingo 排行榜）— 達成連線排前 10
- ScoreboardAnnouncement（跑馬燈）— 「X 攤位剛達成連線」插播
- WaveResponse（全場應援）— 節目高潮人浪

**商業價值**：園遊會升級版、把分散攤位串起來、提升賓客整場參與率

---

### 15. escape-room — 密室逃脫情境包 ✅ live

| 項目 | 內容 |
|------|------|
| **Tagline** | 協作解鎖 + 任務鏈 + 線索拼密碼 + 隊伍搶答 |
| **適用** | 主題密室、實境解謎、企業 team building、校園尋寶、夏令營解謎 |
| **人數** | 4-30 人 / 場 |
| **時長** | 60-120 分鐘 |
| **收費** | 月費 NT$ 1.5K-3.5K + 一次性 NT$ 8K-25K |
| **狀態** | ✅ live |

**含元件**（4 個 multi）：
- LockCoop（協作解鎖）— 每人持密碼片段、合作開鎖
- TreasureHunt（線索拼密碼）— 解謎找最終答案
- QuestChain（任務鏈）— 故事 + 解謎多階段
- ChoiceVerifyRace（隊伍搶答）— 對戰場景緊張感

**商業價值**：密室主題店面長期訂閱 + 一次性活動雙軌

---

### 16. team-building — 企業團建活動情境包 ✅ live

| 項目 | 內容 |
|------|------|
| **Tagline** | 角色分派 + 接力任務 + 全場應援 + 即時排行 |
| **適用** | 年度員工旅遊、季度部門團建、新進主管 workshop、Off-site 共識營、尾牙活動 |
| **人數** | 20-80 人 / 場 |
| **時長** | 半天 - 1 天 |
| **收費** | NT$ 15,000-40,000 / 場 |
| **狀態** | ✅ live |

**含元件**（4 個、混合 multi + host）：
- RoleAssign（角色分派、multi）— 劇本式分組（DISC / 能力互補）
- RelayMission（接力任務、multi）— 強制每人完成、團隊互動深度
- EmojiReact（全場應援、host）— 高潮時刻 emoji 雨
- LiveLeaderboard（即時排行、host）— 組別積分排行榜

**商業價值**：私部門年度團建主推、HR 不用準備、一鍵建場

---

## 📊 16 情境一覽表

| ID | 名稱 | 類別 | 狀態 | 收費 | 主元件 |
|----|------|------|------|------|--------|
| wedding | 婚禮派對 | 💝 social | ✅ | 8K-15K | Polaroid + Guestbook + Emoji |
| birthday | 生日派對 | 💝 social | ✅ | 3K-6K | Polaroid + Guestbook + Emoji |
| reunion | 同學會 | 💝 social | ✅ | 2K-5K | Trivia + Guestbook + Polaroid |
| kids-adventure | 親子冒險 | 💝 social | ✅ | 8K-25K | Treasure + Jigsaw + Emoji |
| carnival-stage | 園遊會 | 🎉 event | ✅ | 15K-30K | Trivia + Leaderboard + Wave + Scoreboard |
| icebreaker | 破冰熱場 | 🎉 event | ✅ | 5K-12K | Crowd + Jigsaw + Emoji |
| awards-ceremony | 頒獎典禮 | 🎉 event | 🟡 | 8K-20K | Poll + Scoreboard + Emoji |
| street-walk | 街區走讀 | 🏛 public | ✅ | 80K-200K/季 | GpsCascade + KnowledgeMap + Crowd |
| district-checkin | 商圈打卡 | 🏛 public | 🟡 | 30K-100K | Treasure + KnowledgeMap + Leaderboard |
| corporate-training | 企業內訓 | 💼 corporate | ✅ | 1.5K-5K/月 | Trivia + Poll + RoleAssign |
| company-trip | 員工旅遊 | 💼 corporate | 🟡 | 10K-30K | Photo + GpsTeam + Guestbook |
| venue-storyline | 場域故事 | 🏠 venue | ✅ | 800-2.5K/月 | Dialogue + Treasure + Polaroid |
| **wedding-deluxe** ✨ | **婚禮 ✨ 升級版** | 💝 social | ✅ | 12K-20K | Blessing + Polaroid + Bingo + Emoji |
| **carnival-bingo** ✨ | **園遊會 Bingo 嘉年華** | 🎉 event | ✅ | 25K-50K | Bingo + Leaderboard + Scoreboard + Wave |
| **escape-room** ✨ | **密室逃脫** | 🏠 venue | ✅ | 月 1.5-3.5K + 8K-25K/場 | LockCoop + Treasure + QuestChain + ChoiceVerifyRace |
| **team-building** ✨ | **企業團建** | 💼 corporate | ✅ | 15K-40K | RoleAssign + RelayMission + Emoji + Leaderboard |

✅ = live、🟡 = preview（待真實活動驗證）

---

## 💡 商業模式三軌

```
┌─────────────────┬─────────────────┬─────────────────┐
│  一次性活動      │  訂閱（月費）   │  公部門委辦      │
├─────────────────┼─────────────────┼─────────────────┤
│ 婚禮、生日       │ 企業內訓        │ 街區商圈活化     │
│ 同學會、頒獎     │ 民宿故事        │ 觀光局景點串聯   │
│ 園遊會、破冰     │ 顧問師          │                 │
├─────────────────┼─────────────────┼─────────────────┤
│ NT$ 3K-30K     │ NT$ 1.5K-5K    │ NT$ 80K-200K   │
│  / 場          │  / 月          │  / 季          │
└─────────────────┴─────────────────┴─────────────────┘
```

---

## 🚀 客戶選定情境後的步驟

```
1. 客戶或業務在 /find-scenario 找到適合情境
   ↓
2. 進 /template-market/:scenarioId 看詳細
   ↓
3. admin 後台「一鍵建場」按鈕
   ↓
4. 系統自動建立：sessionId + hostToken + 玩家 QR
   ↓
5. /admin/scenario-qr-print 列印 A4 版 QR
   ↓
6. 現場貼 QR / 投影、玩家掃即玩
```

詳細流程 → [05-platform-flow.md](05-platform-flow.md) §4 客戶 30 分鐘現場可玩

---

## 🔗 下一步

- 看業務怎麼推 → [04-business-pages.md](04-business-pages.md) §1 PitchDeck
- 看 admin 怎麼建場 → [05-platform-flow.md](05-platform-flow.md) §5
- 完整收費策略 → [`docs/runbooks/customer-onboarding.md`](../runbooks/customer-onboarding.md)
