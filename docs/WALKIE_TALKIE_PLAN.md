# 📻 遊戲內對講機（Walkie-Talkie）功能規劃

> **需求**：同組玩家在遊戲中能用語音即時對話，push-to-talk 模式、不存檔、純溝通
> **保留**：既有文字聊天不動
> **作者**：Hung | 2026-04-22

---

## 🎯 需求細化

| 項目 | 規格 |
|------|------|
| **互動模式** | 按住說話（push-to-talk），放開靜音 |
| **參與者** | 同組（team / session）玩家，預期 2-6 人 |
| **媒體** | 純語音（audio-only），不需影像 |
| **儲存** | ❌ 不存檔（ephemeral，伺服器不 record） |
| **同時說話** | ✅ 支援多人同時 broadcast（不需像真對講機只能一人） |
| **延遲要求** | <300ms（理想 <150ms） |
| **加入/離開** | 加入遊戲自動入 room，離開自動退 |
| **平台** | Web（PWA，iOS Safari / Android Chrome 為主） |

---

## 🔬 技術選型研究

### 方案比較

| 方案 | 類型 | 優點 | 缺點 | 適合度 |
|------|------|------|------|--------|
| **WebRTC Mesh P2P** | 點對點直連 | 不用中繼 server，延遲最低 | N² 連線數，3 人以上瀏覽器就卡 | 🔴 淘汰（超過 3 人不可用） |
| **LiveKit** (self-hosted) | SFU（開源 Go） | 生態完整、React 元件庫、TypeScript SDK、audio-only room 支援、[GitHub ⭐12k+](https://github.com/livekit/livekit) | 效能比 mediasoup 低（但我們不到 100 人場景） | ✅ **最佳** |
| **mediasoup** | SFU（開源 C++） | 效能最強（比 LiveKit 2x） | 底層 API，需自建信令/房間邏輯，開發時間 3-4 倍 | 🟡 過度工程（殺雞用牛刀） |
| **Janus Gateway** | 專業 WebRTC gateway | 功能完整 | C 寫的、部署配置複雜 | 🟡 過度複雜 |
| **LiveKit Cloud** | 商業託管 | 零運維 | 付費 $0.99/GB audio | 🟢 備案（若自託管有困難） |
| **Twilio Voice / Agora** | 商業 PaaS | 極穩、極簡 | $0.004/min/user，長期成本高 | 🟡 備案 |

### 為什麼選 LiveKit

1. **已有 Docker 架構** — LiveKit 就是一個 container，完美融入現有部署
2. **TypeScript SDK + React 元件庫**（`@livekit/components-react`）— 直接套用，省大量前端工時
3. **Room-based 隔離天然對應 team/session** — 不用自己設計房間邏輯
4. **Audio-only + Push-to-Talk 是官方用例** — `setMicrophoneEnabled(true/false)` 一行切換
5. **開源免付費**，未來若要上 cloud 只需改 URL
6. **有活躍社群** — 問題幾乎都有人答

### 為什麼 Push-to-Talk 對遊戲體驗更好

- **節省頻寬**：玩家多半在聽指示/觀察關卡，只有需要溝通時開麥 → 大幅減少不必要的噪音傳輸
- **降低干擾**：戶外風聲、環境音不會全程播送
- **類對講機儀式感**：配合按鈕音效「嗶」，強化戰術團隊氛圍（賈村保衛戰的軍事主題很契合）
- **隱私友善**：離開遊戲自動斷，不會忘記關麥洩漏生活隱私

---

## 🏗 架構設計

```
┌─────────────────────────────────────────────────────────┐
│                    玩家瀏覽器 (PWA)                       │
│  ┌────────────┐   ┌──────────────────┐                 │
│  │ GamePlay   │   │ WalkieTalkie.tsx │                 │
│  │ (現有文聊) │   │  - PTT 按鈕      │                 │
│  │ 不動       │   │  - 組員狀態      │                 │
│  └────────────┘   │  - 說話指示燈    │                 │
│                   └─────────┬────────┘                 │
│                             │                          │
│                   livekit-client SDK                   │
└─────────────────────────────┼──────────────────────────┘
                              │
                       WebSocket (signaling)
                       + DTLS/SRTP (media)
                              │
                ┌─────────────▼──────────────┐
                │   LiveKit Server (Go SFU)  │
                │   Docker: game-livekit     │
                │   - 管理 room              │
                │   - 中繼 audio RTP         │
                │   - 不存檔（停用 egress）  │
                └──────▲─────────────────────┘
                       │
                       │ 只走 token 驗證
                       │
                ┌──────┴─────────────┐
                │  遊戲平台 Server    │
                │  (Express，現有)    │
                │  POST /api/walkie/ │
                │  token → 生 JWT    │
                │  room = team-{id}  │
                └────────────────────┘
```

### 關鍵設計決策

#### 1. **Room 命名規則**
```
team-{teamId}           若已在團隊遊戲中
session-{sessionId}     否則用 session
```
同 room 的人互相聽得到；不同 team 完全隔離。

#### 2. **Token 發放**
- 遊戲平台後端用 `livekit-server-sdk`（npm）發 JWT
- JWT 內含 `room`、`identity=user.id`、`name=user.firstName`
- grants: `canSubscribe: true`, `canPublish: true`, `publishSources: ['microphone']`
- TTL = 遊戲剩餘時間 + 1h buffer

#### 3. **Push-to-Talk 行為**
- 進 room 時 `setMicrophoneEnabled(false)` — 預設靜音
- 按住 PTT 按鈕（touchstart / mousedown） → `setMicrophoneEnabled(true)`
- 放開按鈕（touchend / mouseup） → `setMicrophoneEnabled(false)`
- 按鈕文字：「🎙️ 按住講話」→ 按下時 → 「🔴 傳送中...」

#### 4. **不存檔**
- LiveKit server config 關閉所有 egress
- 不啟用 `recording` / `composite` / `track-egress` 功能
- 音訊純中繼，經 SFU 後直接 forward 給其他 peer，server 不落盤

#### 5. **噪音抑制**
- LiveKit client SDK 內建 Chrome RNNoise（可選）
- 在 audio capture options 開 `{ noiseSuppression: true, echoCancellation: true, autoGainControl: true }`

#### 6. **同時說話**
- SFU 不做混音，每個 peer 收到 N-1 個獨立 audio track
- 瀏覽器 Web Audio 自動疊加播放 — 多人同時說沒問題
- 上限：每 track 約 20-40 kbps，6 人同時 = 120-240 kbps × 6 subscribers，合理

---

## 💰 資源估算

### 自託管 LiveKit Server（建議）

| 項目 | 估算 |
|------|------|
| **CPU** | 1-2 cores / 50 concurrent rooms（每房 2-6 人） |
| **RAM** | 512 MB 基礎 + ~50MB/room |
| **頻寬** | Audio only ~30 kbps × 每 track<br>6 人 room：入 30kbps × 6 = 180kbps，出 30kbps × 5 × 6 = 900kbps |
| **Port** | TCP 7880（API）、UDP 50000-60000（RTP） |
| **月費** | 0（Linode 既有機器） |

### LiveKit Cloud 備案

| 項目 | 估算 |
|------|------|
| **頻寬** | $0.99/GB outbound |
| **100 場遊戲 × 30min × 6 人** | ≈ 1.5 GB × $0.99 = **$1.5/月** |
| **破千場**  | ≈ $15-30/月 |

通常自託管就夠，有規模再切 cloud。

---

## 📋 實作計畫（3 Phase，估 7-10 天）

### Phase A：伺服器層（2-3 天）

1. **Docker 加 LiveKit container**
   - `docker-compose.prod.yml` 加 `game-livekit` service
   - 開 port 7880、UDP 50000-60000
   - LIVEKIT_KEYS 產生 API Key/Secret 存 .env
   - 無外部 TURN（先用 LiveKit 內建 STUN，不夠再補）

2. **後端 `/api/walkie/token` 端點**
   - 檔案：`server/routes/walkie.ts`
   - 用 `livekit-server-sdk`（npm package）生 JWT
   - room = `team-${teamId}` || `session-${sessionId}`
   - identity = user.id, name = user.firstName || "玩家"
   - 驗證：玩家必須在這 session 內才能拿 token

3. **nginx 反向代理**
   - `/livekit` → LiveKit WebSocket（ws → wss）
   - 已有 HTTPS cert，不用額外配

### Phase B：前端元件（3-4 天）

1. **依賴安裝**
   ```bash
   npm install livekit-client @livekit/components-react
   ```

2. **`client/src/components/walkie/WalkieRoom.tsx`**
   - 用 `<LiveKitRoom>` 包裹 room context
   - 呼叫 `/api/walkie/token` 取得 JWT
   - 自動連線 / 斷線管理（ConnectionState）

3. **`client/src/components/walkie/PushToTalkButton.tsx`**
   - 大按鈕，touchstart/mousedown 開麥、touchend/mouseup 關麥
   - 音效提示：按下「嗶」、放開「噠」
   - 按下時顯示 pulsing 紅光動畫
   - Safari iOS 特殊：要 `touch-action: manipulation` 避免縮放

4. **`client/src/components/walkie/MemberList.tsx`**
   - 列出 room 內所有人
   - 用 LiveKit 的 `useParticipants` hook
   - 誰正在說話時顯示閃爍綠點（`isSpeaking` + `audioLevel`）

5. **整合 GamePlay**
   - 右下角新增浮動的對講機面板（類似現有聊天按鈕）
   - 可收合為 icon-only
   - 只在 team 模式或多人 session 啟用

### Phase C：體驗優化（2-3 天）

1. **音效 cue**（重要）
   - PTT 按下：「嗶」（440Hz 短音，100ms）
   - PTT 放開：「噠」（330Hz 短音，50ms）
   - 有人開始說話：淺淺「咔」通知
   - 用 Web Audio API 合成，不用下載檔

2. **權限處理**
   - 首次開啟對講機需 getUserMedia permission
   - 拒絕時顯示明確說明：「需要麥克風權限才能使用對講機」
   - 設定頁可開關對講機功能（預設開）

3. **降級策略**
   - 瀏覽器不支援 WebRTC（舊 Safari）→ 隱藏按鈕
   - 連線中斷 → 自動重連 3 次，仍失敗顯示離線狀態
   - 網路差 → LiveKit 自動調整 bitrate（simulcast for audio）

4. **音量控制**
   - 組員名單旁每人一個 mute 按鈕（不想聽某人時）
   - 總音量 slider

---

## 🧪 測試計畫

### 本地測試
- 2-3 個瀏覽器分頁同時登入不同帳號
- 驗證：按住 PTT 時，其他分頁能聽到
- 驗證：不按時完全靜音

### 實機測試（實際遊戲場景）
- 2 人場：iPhone + Android 各一台
- 6 人場：測試多人同時 PTT 是否疊音
- 網路切換：WiFi → 4G 斷線重連

### 壓測
- 10 個模擬 client 同時講話
- 觀察 LiveKit CPU 使用率
- 若 >50% → 考慮加 CPU 或切 cloud

---

## 🚨 風險與對策

| 風險 | 機率 | 影響 | 對策 |
|------|------|------|------|
| **iOS Safari 麥克風權限陷阱** | 中 | 中 | getUserMedia 必須在 user gesture 內呼叫；用 `touchstart` 不要 `load` |
| **NAT 穿透失敗** | 低 | 高 | 內建 STUN 應付 95%；剩 5% 可加 TURN（Cloudflare 免費或 coturn 自架） |
| **LiveKit 自身崩潰** | 低 | 中 | Docker 自動重啟；client 自動重連 3 次 |
| **多人同時 PTT 造成音訊疊音混亂** | 低 | 低 | 這是預期行為（跟真實對話一樣），若問題大可加「正在說話中」排隊視覺提示 |
| **低端手機 CPU 跑不動** | 低 | 中 | 關閉 noise suppression（降 CPU），或降低 audio bitrate |
| **遊戲錄音隱私疑慮** | 低 | 高 | 明確在 UI 標示「本對話不存檔」，且 server config 確實不啟用 egress |

---

## 🔗 參考資源

### 核心開源
- **[LiveKit Server](https://github.com/livekit/livekit)** ⭐ 12k+ — 主要選擇
- **[@livekit/components-react](https://github.com/livekit/components-js)** — 官方 React 元件
- **[livekit-client](https://github.com/livekit/client-sdk-js)** — JS SDK
- **[livekit-server-sdk-js](https://github.com/livekit/server-sdk-js)** — Node.js server SDK（發 token 用）

### 文件
- [LiveKit Docs — Audio Rooms](https://docs.livekit.io/guides/audio-rooms/)
- [LiveKit Docs — Push to Talk Example](https://docs.livekit.io/client-sdk-js/microphone/)
- [LiveKit Self-hosting](https://docs.livekit.io/realtime/self-hosting/server-setup/)

### 類似開源參考（可看 UI 怎麼做）
- **[OpenAI Realtime Push-to-Talk](https://github.com/swooby/openai-realtime-push-to-talk)** — React PTT UI 範例
- **[WebRTC Intercom](https://github.com/codewithmichael/webrtc-intercom)** — 純 vanilla JS 對講機，可看核心邏輯

### 備案（若 LiveKit 行不通）
- [mediasoup](https://github.com/versatica/mediasoup) — C++ SFU 效能最強
- [mirotalksfu](https://github.com/miroslavpejic85/mirotalksfu) — 基於 mediasoup 的完整範例

---

## ✅ Definition of Done

上線前必須符合：
- [ ] 2 人同組 PTT 互通（iOS + Android 實機）
- [ ] 6 人同 room 同時說話不破音
- [ ] 遊戲離開時自動斷線
- [ ] 無麥克風權限時降級不崩潰
- [ ] server 確認無錄音（checklist 手動驗證）
- [ ] UI 明確標示「本對話不儲存」
- [ ] 整合既有文字聊天，不衝突
- [ ] 生產 Docker 容器 CPU <30% 於 10 併發 room

---

## 📅 建議下一步（需您確認再動工）

**這只是規劃，還沒動手寫任何程式碼**。確認方向後：

1. 若同意採 LiveKit 自託管 → 下一輪我們：
   - 加 LiveKit docker compose service
   - 加 `/api/walkie/token` 端點
   - 建前端元件
2. 若想先試 LiveKit Cloud 免費額度（開發階段省事）→ 我改用 cloud URL
3. 若擔心效能想直接上 mediasoup → 可以，但工作量 3-4 倍

**我的推薦：LiveKit 自託管，Phase A-B 約 5 天，上線後再考慮優化。**

預計總工時：**7-10 天**（Phase A 2-3 + Phase B 3-4 + Phase C 2-3）
