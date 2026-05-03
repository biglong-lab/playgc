# 2026-05-03 QA 測試確認清單

> **範圍**：2026-05-03 一日內所有修法（11:30 → 17:30、~60 commits）
> **適用**：QA / 業務 / 一般測試人員
> **生產**：[https://game.homi.cc](https://game.homi.cc)（commit `335ecfb7` 之後）

---

## 🔥 高優先：直接影響使用者操作

### A. Admin 後台登入（**最重要、先測這個**）

**A.1 super_admin 場域代號留空登入**
- **怎麼測**：到 [https://game.homi.cc/admin/login](https://game.homi.cc/admin/login)
- **操作**：
  1. 場域編號**留空**（不填）
  2. 點「Google 登入」用 super_admin 帳號（如 twfam4@gmail.com）
- **期望**：直接進入賈村場域後台
- **失敗回報**：截圖 + Browser Console 錯誤訊息 + Network tab 的 `/api/admin/firebase-login` response
- **背景**：之前 findFirst 隨機抓非 super_admin 會回 400 卡住

**A.2 super_admin 跨場域登入**
- **怎麼測**：同 A.1 路徑、但場域編號分別填以下任一：
  - `HPSPACE`（後浦金城）
  - `HDSH`（海島學校）
  - `WDLW`（烈嶼）
- **期望**：每個都能成功進入該場域後台
- **背景**：軟刪了 3 個冗餘 field_director 帳號、但 super_admin 跨場域守門邏輯讓你仍能進

---

### B. 玩家對講機 UX

**B.1 單人遊戲對講機**
- **怎麼測**：用任一遊戲（如賈村單人故事）、手機掃 QR 進入
- **期望**：
  - 對講機 Pill 在右下顯示
  - **不會自動登入任何房間**（之前會自動連）
  - 點開 Pill 看到選單：「邀請朋友」/「掃 QR」/「輸入 6 碼」
- **失敗回報**：是否一進遊戲就自動連對講機？

**B.2 多人組隊對講機**
- **怎麼測**：兩支手機分別開同一個組隊遊戲、加入同隊
- **期望**：
  - 兩支手機自動連到同一個對講群組
  - 長按 Pill 可講話、對方聽得到
- **背景**：多人組隊跟之前一樣自動連

---

### C. 多人組隊功能（影響大、需仔細測）

**C.1 隊員加入/離開即時通知**
- **怎麼測**：3 支手機（A/B/C）依序加入同一個組隊遊戲
- **期望**：
  - B 加入時、A 看到 toast「B 加入」
  - C 加入時、A/B 看到「C 加入」
  - 任一人離開時、其他人看到通知
- **背景**：之前有 silent bug 隊員加入訊息送不到、現已修

**C.2 隊伍投票**
- **怎麼測**：組隊中 admin 觸發投票（VoteTeam 元件）
- **期望**：
  - 隊員看到投票選項
  - 任一隊員投票、其他隊員即時看到結果
- **失敗回報**：投票結果是否同步？延遲多久？

**C.3 隊伍分數變動**
- **怎麼測**：玩到任何加分情境（答題正確 / 完成任務）
- **期望**：分數變動廣播給所有隊員、即時看到
- **背景**：之前 score_update 訊息送不到、現已修

**C.4 隊伍 ready 狀態**
- **怎麼測**：組隊大廳、各隊員按下「準備」按鈕
- **期望**：其他隊員即時看到誰準備好了

**C.5 ChoiceVerifyRace 多人答題**
- **怎麼測**：多人答題遊戲、4 人同時參賽
- **期望**：
  - 任一玩家答題、其他 3 人即時看到該玩家的答題進度
  - 排行榜即時更新
- **背景**：之前是「假同步」（只本地累積）、現補完真實 WebSocket 同步

---

## 🎯 中優先：聊天 / 互動

### D. 隊伍聊天

**D.1 訊息送出 + 接收**
- **怎麼測**：組隊中、A 送訊息「測試 1」
- **期望**：
  - A 自己畫面看到「測試 1」
  - B/C 即時收到「A: 測試 1」
- **背景**：之前 chat 雙寫 DB（同一訊息進兩次），現修為單一資料流

**D.2 頭像顯示**
- **怎麼測**：聊天列表內看每則訊息的頭像
- **期望**：
  - 自己訊息頭像顯示自己名字首字
  - 其他人訊息頭像顯示對方識別碼（暫時用 userId 末 4 碼首字）
- **失敗回報**：是否每則訊息都顯示「我」的頭像？（之前 bug）

---

### E. 新元件展示

**E.1 TeamBattleScore 紅藍對抗（第 14 個 host 元件）**
- **怎麼測**：到 admin 後台、建立含 `host_team_battle_score` 的遊戲
- **元件位置**：admin → 遊戲頁面編輯器 → 加新頁面 → 選「紅藍對抗即時計分」
- **使用流程**：
  - admin 在大螢幕（投影機）開 host 模式
  - 玩家手機加分（如有設 `acceptPlayerPulse=true`）
  - 大螢幕即時顯示紅隊 vs 藍隊分數 + 進度條
  - 達 targetScore（預設 50）→ winner 鎖定、慶祝動畫
- **期望**：分數即時同步、達標自動結束

---

## 🛡️ 低優先：安全修法（業務驗證、非一般 QA 測）

這些是後端安全強化、一般使用者無感、但需確認**舊功能仍正常運作**：

### F. Webhook 簽章驗證
- **/api/payments/recur/webhook**（Recur.tw 付費通知）
- **/api/webhooks/line**（LINE Bot）
- **/api/rewards/external/callback**（Aihomi 好康券）
- **驗證**：如果有實際付費 / LINE / 好康券測試流程、確認仍能成功完成

### G. Public POST rate limit
- **/api/apply**（場域申請）：同一 IP 1 小時內最多 10 次
- **/api/invites/:token/click**（邀請點擊）：1 IP 1 分鐘 120 次
- **驗證**：正常一個人一次申請應該沒問題、超量會被擋

### H. WebSocket 防護
- **強制認證**：team_chat / team_vote / team_ready / team_location
- **per-connection rate limit**：每 ws 每秒 10 訊息上限
- **驗證**：正常使用無感、攻擊者腳本灌訊息會被擋

---

## 🔍 必看的「明顯壞掉」回報項目

如果以下任一發生、立即回報：

1. ❌ super_admin Google 登入失敗（不論留空或填場域）
2. ❌ 進遊戲對講機自動連（單人模式）
3. ❌ 多人組隊看不到隊員加入/離開通知
4. ❌ 隊伍聊天訊息消失或重複出現
5. ❌ 多人答題沒同步（隊員看不到別人答題）
6. ❌ 任何頁面載入 500 錯誤

## 📊 生產系統健康狀態

可隨時查驗：
- 生產健康端點：[https://game.homi.cc/api/scenarios/health](https://game.homi.cc/api/scenarios/health)
- 期望：HTTP 200 + `{"status":"ok","total":12,...}`

---

## 📚 詳細紀錄（給開發者 / 排錯用）

- [docs/CHANGELOG.md](../CHANGELOG.md) — 2026-05-03 release entry
- [docs/changes/2026-05-03-codex-realtime-cleanup.md](../changes/2026-05-03-codex-realtime-cleanup.md) — Codex 9 輪審查紀錄
- [docs/changes/2026-05-03-security-and-ux-fixes.md](../changes/2026-05-03-security-and-ux-fixes.md) — 使用者 P0/UX + webhook 統一
- [docs/decisions/0014-realtime-protocol-cleanup.md](../decisions/0014-realtime-protocol-cleanup.md) — Realtime 協定設計決策
- [docs/decisions/0015-websocket-anonymous-write-policy.md](../decisions/0015-websocket-anonymous-write-policy.md) — WebSocket 匿名寫入政策
- [codex-claude/logs/2026-05-03.md](../../codex-claude/logs/2026-05-03.md) — 完整時序紀錄（含每一筆 commit + 判斷）

---

## 🎯 推薦測試順序

1. **A.1 + A.2**（5 分鐘）— 最重要、影響你們團隊每天使用
2. **B.1 + B.2**（5 分鐘）— 對講機 UX 是使用者明顯感受
3. **D.1**（2 分鐘）— 聊天簡單測一下
4. **C.1 + C.2 + C.3**（15 分鐘）— 多人組隊三大同步功能
5. **C.5**（10 分鐘）— ChoiceVerifyRace 多人答題（如有用）
6. **E.1**（10 分鐘）— TeamBattleScore 新元件

**總時間**：約 45 分鐘可完成核心 QA。
