# 🎮 多人遊戲元件 E2E 實機測試清單

> **建立日期**：2026-05-02
> **目的**：作為 admin 上線後的多人元件實機驗證 checklist
> **對應**：[GAME_COMPONENT_MULTIPLAYER_PLAN.md](GAME_COMPONENT_MULTIPLAYER_PLAN.md) v1.7 全部 8 個多人元件

---

## 📋 為什麼用實機 checklist 而非自動化 E2E

多人元件 E2E 自動化測試需要：
1. **DB 種子**：admin 預先建好 multi 遊戲（含各種 pageType 的 page）
2. **多瀏覽器 session**：模擬 2+ 玩家同時在線 + WebSocket 互動
3. **GPS 模擬**：TerritoryCapture / GpsTeamMission 需偽造位置
4. **MQTT 模擬**：ShootingTeam 需模擬 Arduino 靶機

工程量約 1-2 週才能完整自動化。**現階段先用人工 checklist 確保元件實機可用**，自動化留給後續。

實機驗證每個元件約 5-10 分鐘，全部走完約 60 分鐘。

---

## 🔧 前置設定（admin）

1. 登入 admin（twfam4@gmail.com / Firebase Dev 快速登入）
2. 進場域編輯（賈村或建測試場域）
3. 建一個 game，**gameMode 選「隊伍協作」或「競技」或「接力」**
4. 進 game 編輯器，依下列每章拖入對應元件並設定

---

## ✅ 8 個多人元件實機測試清單

### 1. PhotoTeam（團體合影）

**設定**：拖「團體合影 👥」→ teamConfig 留空（用預設 2-6 人）

**測試步驟**：
- [ ] 兩個玩家組同一隊
- [ ] 任一玩家進入 photo_team page
- [ ] 隊長介面顯示：選實際人數（2-6）→ 逐一拍每位隊員
- [ ] 拍完自動九宮格合成 + 名字 overlay
- [ ] 點繼續 → onComplete 觸發

**已知 bug 修復**：admin 沒填 teamConfig 不會卡死（commit `a7a4ea4e`）

---

### 2. VoteTeam（隊伍投票）

**設定**：拖「隊伍投票（即時同步） 👥」→ 設題目 + 2-4 個選項；votingMode 預設 majority

**測試步驟**：
- [ ] 兩個玩家組同一隊（兩個瀏覽器分頁）
- [ ] 玩家 A 投票 → 玩家 B 即時看到「1/2 已投」
- [ ] 玩家 B 投票同選項 → 達 majority 自動前進
- [ ] 切換 votingMode='unanimous' → 兩人投同票才前進
- [ ] 切換 votingMode='display' → 純顯示計票不影響進度

---

### 3. ShootingTeam（隊伍射擊累計）

**設定**：拖「隊伍射擊累計 👥」→ targetScore（建議 50）+ timeLimit

**前提**：場域要有 Arduino 靶機 + MQTT 連線（或啟用 simulateHit）

**測試步驟**：
- [ ] 兩個玩家組同一隊
- [ ] 任一玩家命中 → 兩人即時看到隊伍總分增加
- [ ] 排行榜顯示誰打了多少分（含 displayName）
- [ ] 達 targetScore → 自動前進
- [ ] 玩家斷線重連 → 看到當前總分（透過 §7.4 reconnect snapshot）

**已知 P0**：HMAC 防作弊未實作（暫緩）

---

### 4. GpsTeamMission（隊伍 GPS 尋寶）

**設定**：拖「隊伍 GPS 任務 👥」→ targetLocation + radius；triggerMode='any' 或 'all'

**測試步驟**：
- [ ] 兩個玩家組同一隊（建議實地或模擬 GPS）
- [ ] any 模式：任一隊員到達 → 全隊完成
- [ ] all 模式：全員到達才完成
- [ ] 地圖顯示所有隊友位置即時更新
- [ ] 玩家 GPS 不準 → fusion 自動過濾

---

### 5. ChoiceVerifyRace（隊伍搶答）

**設定**：拖「隊伍搶答 👥」→ N 題選擇題

**測試步驟**：
- [ ] 兩個玩家組同一隊
- [ ] 同時看到題目開始計時搶答
- [ ] 玩家 A 先答對 → 得分 + 隊內排行
- [ ] 連對加 streak 加分
- [ ] 全部錯 → 顯示正確答案再前進

---

### 6. LockCoop（協作解鎖）

**設定**：拖「協作解鎖 👥」→ 設 6 位密碼 `123456` + 3 組線索：
- 「奇數位是 1, 3, 5」
- 「偶數位是 2, 4, 6」
- 「正確答案是奇偶交錯」

**測試步驟**：
- [ ] 三個玩家組同一隊
- [ ] 進入元件後每人**自動分配不同線索**（依 fnv1aHash）
- [ ] 同玩家重整頁面後**線索不變**（穩定分配）
- [ ] 任一玩家輸入密碼 → 其他玩家即時看到輸入
- [ ] 答錯 → 累計 attempts，廣播給隊友
- [ ] 答對 → 全隊解鎖，顯示成功畫面 + 對講機提示
- [ ] 達 maxAttempts → 失敗畫面（仍可繼續跳過）
- [ ] 多人元件入場 toast「💬 建議開啟對講機」（同 session 只一次）

---

### 7. RelayMission（接力任務）

**設定**：拖「接力任務 👥」→ 3 段問答（每段 prompt + answer）

**測試步驟**：
- [ ] 三個玩家組同一隊
- [ ] 進入元件後每段**穩定分配給特定玩家**（依 hash）
- [ ] 第 1 段負責人看到題目 + 輸入框；其他人看「等待隊友完成」
- [ ] 第 1 段負責人答錯 → 顯示「答案不正確，再試試」（hook lastError）
- [ ] 第 1 段負責人答對 → 廣播 segment_complete + 推進到第 2 段
- [ ] 第 2 段負責人接手；前面段顯示在「已完成」區塊
- [ ] 全部完成 → Trophy 慶祝畫面 + onComplete

---

### 8. TerritoryCapture（地盤戰）

**設定**：拖「地盤戰 👥」→ 至少 3 個 GPS 點 + timeLimitSec=600 + cooldownSec=30

**前提**：**至少 2 隊**才能玩（單隊無對手）

**測試步驟**：
- [ ] 兩支隊伍同 game session
- [ ] A 隊玩家 1 接近點 1 → 顯示「佔領」按鈕
- [ ] 點佔領 → 即時廣播給**所有隊伍**（session 範圍）
- [ ] B 隊玩家在點 1 範圍內 → 顯示「奪回」按鈕
- [ ] 立刻奪回失敗 → 「冷卻中（避免來回搶）」
- [ ] 冷卻期過 → 可奪回
- [ ] 即時排行榜顯示每隊佔領數
- [ ] 倒數結束 → 結算畫面 Trophy + 我隊第一顯示「你們贏了」
- [ ] 距離 > radius → 不顯示按鈕，但顯示「距離 N 公尺」
- [ ] 無 GPS → 顯示「等待 GPS 定位中」

---

## 🔄 跨元件穩定性測試

### 重連狀態恢復（Phase 2.5 + Phase 3 §7.4）

**測試步驟**：
- [ ] 玩家 A 在 LockCoop 輸入「12」
- [ ] 玩家 B 後加入隊伍（重連）→ 應立刻看到 sharedCode = "12"（透過 server snapshot）
- [ ] 玩家 A 在 RelayMission 完成第 1 段
- [ ] 玩家 B 重連 → 應看到第 1 段已完成 + 當前是第 2 段

### 寬限期 + 自動 leave（Phase 2.5）

- [ ] 玩家 A 在多人遊戲中關瀏覽器
- [ ] 0~30s：其他人看到「⚠️ A 暫時離線」
- [ ] 30s 後：「⏳ A 寬限期已過，120 秒後自動離開」
- [ ] 150s 後：「👋 A 已離開遊戲」（DB leftAt 設值）
- [ ] A 重新打開 → my-team 回 null，不被自動拉回

### TTS 語音通知（Phase 3 TTS）

- [ ] 玩家 B 聽到「A 暫時離線」中文語音（小聲 volume 0.4）
- [ ] 60 秒內同事件不重複播放
- [ ] localStorage 設 `chito:voice:disabled=1` → 完全靜音

---

## 📝 紀錄結果

每個元件測試完，建議在 PROGRESS.md 加一筆：
```
- [x] LockCoop e2e 實機驗證 — 2026-MM-DD by [tester]
  - 通過項目：N/N
  - 發現 bug：（如有）
```

---

## 🚨 已知未做的優化（暫緩）

| 項目 | 影響 | 優先序 |
|------|------|--------|
| ShootingMission HMAC | 玩家可作弊（前端 simulateHit 改數字） | 🔴 P0 |
| 隊長 leader-decide UI | 寬限期過自動 leave，無隊長介入空間 | 🟡 |
| 後台寬限期 UI | 寬限期 hardcode 30s/120s | 🟢 |
| 語音 toggle UI | 玩家需手動改 localStorage | 🟢 |
| B 級多人化 | TextVerifyTeam / QrScanRelay / TimeBombCoop | 🟢 依需求 |
