# 📻 遊戲內對講機（Walkie-Talkie）+ 場地管理者廣播 完整規劃

> **版本**: v2 (加入廣播 + 儀表板 2026-04-22)
> **決策**: LiveKit 自託管（Linode 8GB/4core，硬限 1 core/512MB）
> **作者**: Hung | 大哉實業

---

## 🎯 三個功能需求

### 1️⃣ 玩家隊內對講機
- 同組（team）2-6 人雙向語音
- Push-to-talk（按住講話）
- 不存檔、多人同時可講

### 2️⃣ 場地管理者廣播
- 可對**所有玩家**廣播
- 可**選擇特定幾組**廣播（勾選式）
- 單向（管理者 → 玩家），玩家聽得到但不能回應廣播頻道
- Push-to-talk（管理者按住才發送）

### 3️⃣ 管理者即時儀表板
- 目前正在遊戲的**總人數**
- 依**隊伍/場次分組**顯示人數
- 哪些隊正在用對講機（可視化）
- 每隊旁邊有「**單獨廣播此隊**」按鈕

---

## 🏗 最終架構（含廣播）

```
┌───────────────────────────────────────────────────────┐
│           LiveKit SFU (Docker container)               │
│                                                       │
│  room: team-{teamId-1}     ◄── player-a, player-b    │
│  room: team-{teamId-2}     ◄── player-c, player-d    │
│  room: team-{teamId-3}     ◄── player-e, player-f    │
│                                                       │
│  管理員廣播方式：connect 進多個 room，同時 publish    │
└───────▲─────────────▲─────────────▲──────────────────┘
        │             │             │
   ┌────┴───┐   ┌────┴────┐   ┌────┴────┐
   │ Team 1 │   │ Team 2  │   │ Team 3  │
   │ a + b  │   │ c + d   │   │ e + f   │
   └────────┘   └─────────┘   └─────────┘

┌──────────────────────────────────┐
│  場地管理者                       │
│  勾選 [✓ Team 1] [ ] Team 2      │
│        [✓ Team 3] → 按住廣播     │
│                                  │
│  SDK 自動 connect 進 team-1 +    │
│  team-3 room，publish 同一 mic   │
│  stream 到兩個 room              │
└──────────────────────────────────┘
```

### 關鍵設計：**管理者動態 multi-room connect**

管理者廣播的技術方案選比較：

| 方案 | 優點 | 缺點 |
|------|------|------|
| **A. Single global room + track permissions** | 最省資源 | 權限邏輯複雜、玩家全員連同一 room、隔離弱 |
| **B. 玩家同時 join 2 個 room（team + broadcast）** | 架構清晰 | 玩家每人開 2 WS、流量 2x、手機耗電 |
| **C. 管理者動態連多個 team room publish** | **玩家完全不用動**、流量最省 | 管理者端要管理 N 個 connection |

**✅ 選 C**：玩家端極簡、所有複雜度集中在管理者端（人數少）

### 管理者廣播流程
```
1. 管理者勾選 [Team 1, Team 3] 要廣播
2. 前端呼叫 POST /api/walkie/broadcast-tokens
   body: { teamIds: ['team-1', 'team-3'] }
3. 後端驗證管理者權限 → 回傳多個 JWT（每個 room 一張）
4. 前端用 livekit-client 同時連 2 個 room
5. 按住 [🎙️ 廣播] 按鈕：
   - getUserMedia 取得 MediaStream
   - 把同一個 stream publish 到 2 個 room
6. 放開：disableMicrophone × 2
7. 結束廣播：disconnect × 2
```

---

## 🔌 API 設計

### 玩家端

```ts
POST /api/walkie/token
Header: Cookie: session + Authorization: Bearer <firebase-token>
Body: { sessionId: string }

Response: {
  token: string,          // LiveKit JWT
  roomName: string,       // "team-{teamId}" or "session-{sessionId}"
  wsUrl: string,          // "wss://game.homi.cc/livekit"
  displayName: string,    // "玩家 John"
}

權限 grants:
  - canPublish: true (麥克風)
  - canSubscribe: true
  - publishSources: ['microphone']
  - roomJoin: true
```

### 管理者廣播端

```ts
POST /api/admin/walkie/broadcast-tokens
Header: adminToken
Body: {
  target: 'all' | 'selected',
  teamIds?: string[],       // 若 target=selected
  gameId?: string,
}

Response: {
  tokens: [
    { roomName: 'team-1', token: 'jwt...', memberCount: 6 },
    { roomName: 'team-3', token: 'jwt...', memberCount: 5 },
  ],
  wsUrl: string,
  broadcasterName: string,   // 「場地管理員 Hung」
}

權限：僅發 publish 權限（管理者不需要聽玩家對話，避免監聽疑慮）
  - canPublish: true
  - canSubscribe: false     ← 關鍵：廣播模式不竊聽
  - publishSources: ['microphone']
```

### 儀表板即時統計

```ts
GET /api/admin/walkie/live-stats
Response: {
  totalPlaying: 24,            // 目前 active session 玩家數
  byTeam: [
    {
      teamId: 'team-1',
      teamName: '第 1 隊',
      memberCount: 6,
      onlineCount: 5,           // 對講機有連線的
      speakingNow: ['user-a'],  // 正在說話的
    },
    ...
  ],
  gameId: 'jiachun-defense-battle',
  sessionCount: 4,              // 有幾個場次在跑
}

實作：
  - 60 秒內有 session heartbeat → count as playing
  - 即時 speaking 資料從 LiveKit Webhooks 取得（track_published 事件）
  - 儀表板前端 5 秒 poll 一次或用 SSE
```

---

## 🚦 Phase A 實作（這輪做，伺服器端）

### A.1 Docker 加 LiveKit container

**`docker-compose.prod.yml` 新增**：
```yaml
livekit:
  image: livekit/livekit-server:latest
  container_name: gamehomicc-livekit
  command: --config /etc/livekit.yaml
  volumes:
    - ./livekit.yaml:/etc/livekit.yaml:ro
  ports:
    - "7880:7880"                  # API + WebSocket
    - "7881:7881"                  # Real-time RTP (TCP fallback)
    - "50000-50100:50000-50100/udp" # RTP UDP (限範圍，避免 port 爆炸)
  restart: unless-stopped
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 512M
      reservations:
        cpus: '0.1'
        memory: 128M
  networks:
    - backend
```

**`livekit.yaml` 設定**：
```yaml
port: 7880
bind_addresses:
  - ""                             # 所有網卡
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50100            # 100 個 port = ~300 參與者上限
  use_external_ip: true

keys:
  APIxxxx: secretxxxx              # 從 .env 讀

room:
  max_participants: 20             # 🔒 物理硬上限，防 room 爆

logging:
  level: info
  sample: false

# 🔒 明確關閉所有錄音/中繼功能（安全檢查）
# （egress 預設不啟用，此為 defensive config）
```

### A.2 後端路由

**新增檔案**：
- `server/lib/livekit.ts` — 封裝 AccessToken 生成
- `server/routes/walkie.ts` — player 端 `/api/walkie/token`
- `server/routes/admin-walkie.ts` — admin 端 broadcast + stats

**套件**：
```bash
npm install livekit-server-sdk
```

### A.3 Nginx 反向代理（aaPanel）

```nginx
location /livekit {
  proxy_pass http://127.0.0.1:7880;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_read_timeout 3600s;      # 長連線
}
```

玩家連線 URL：`wss://game.homi.cc/livekit`

---

## 📱 Phase B 實作（下輪，前端 UI）

### B.1 玩家端（浮動對講機）
```
┌──────────────────────┐
│ 📻 隊伍對講機          │
│                      │
│  ● John（我）         │
│  ● Mary（正在說話）   │  ← 綠色 pulse
│  ● Tom                │
│                      │
│  ╔════════════════╗  │
│  ║  🎙️ 按住講話    ║  │  ← 按下變 🔴 傳送中
│  ╚════════════════╝  │
│                      │
│  （本對話不儲存）      │
└──────────────────────┘

位置：遊戲右下角浮動按鈕，點開展開面板
```

### B.2 管理者儀表板 + 廣播
```
┌───────────────────────────────────────────┐
│ 📊 即時遊戲狀態                            │
├───────────────────────────────────────────┤
│ 🟢 正在遊戲：24 人 / 4 隊                  │
│                                           │
│ ┌─────────┬──────┬────────┬─────────────┐ │
│ │ 隊伍    │ 人數 │ 對講機 │ 單獨廣播     │ │
│ ├─────────┼──────┼────────┼─────────────┤ │
│ │ ✓ 第1隊 │  6   │ 🟢 線上 │ [🎙️ 廣播]  │ │
│ │   第2隊 │  4   │ 🔴 離線 │ [🎙️ 廣播]  │ │
│ │ ✓ 第3隊 │  5   │ 🟢 線上 │ [🎙️ 廣播]  │ │
│ │   第4隊 │  9   │ 🟢 線上 │ [🎙️ 廣播]  │ │
│ └─────────┴──────┴────────┴─────────────┘ │
│                                           │
│ ┌───────────────────────────────────────┐ │
│ │ 🎙️ 按住廣播給已勾選隊伍（第1+第3隊）  │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ 或：[🔊 全體廣播（24 人）]                │
└───────────────────────────────────────────┘
```

### B.3 路由規劃

- `/admin/live` — 即時儀表板（super_admin + field_manager 可見）
- 遊戲內對講機浮動元件：掛在 `GamePlay.tsx` 右下

---

## 🔐 安全考量

| 風險 | 對策 |
|------|------|
| **玩家濫用廣播** | 只有 admin_accounts 有 broadcast-tokens 端點權限 |
| **監聽疑慮** | 管理者 broadcast token grants `canSubscribe: false` — 物理上聽不到玩家說話 |
| **錄音疑慮** | LiveKit server 不啟用 egress；UI 明確「本對話不儲存」 |
| **Token 竊取** | JWT TTL = 2 小時（遊戲時長 + buffer），過期需重新取 |
| **跨場域偷窺** | token 生成時驗證 admin.fieldId === game.fieldId |

---

## 📅 工時重新估算

| Phase | 內容 | 工時 | 本輪做 |
|-------|------|------|--------|
| A | LiveKit 容器 + Token API + Nginx | 1.5-2 天 | ✅ 這輪 |
| B | 玩家端浮動對講機 | 1.5 天 | 下輪 |
| C | 管理者儀表板 | 1 天 | 下輪 |
| D | 管理者廣播 UI | 1 天 | 下輪 |
| E | 音效 cue + 優化 | 1 天 | 之後 |
| **合計** | | **6-7 天** | |

---

## ✅ Phase A DoD（本輪）

- [ ] LiveKit container 啟動且可用 `curl` 探測
- [ ] `POST /api/walkie/token` 能回 JWT（玩家端）
- [ ] `POST /api/admin/walkie/broadcast-tokens` 能回多 token（管理者）
- [ ] `GET /api/admin/walkie/live-stats` 能回即時人數
- [ ] Nginx wss://game.homi.cc/livekit 反代通過
- [ ] Docker 資源硬限確認生效（不影響其他 container）
- [ ] 部署到生產

下輪再做 Phase B-D（純前端，不動後端）。

---

## 🎛 後續擴展預留

即使這輪不做，API 設計已留接口：
- **緊急靜音**：管理者可強制某玩家 mute（未來可加）
- **個人語音訊息**：若要做存檔訊息，改 room 加 egress（未來）
- **語音轉文字**：LiveKit 支援 webhook → 串 Whisper
- **視訊會議升級**：已是 audio-only room，未來改 video 一行切換

這些都不影響現在架構，之後要做直接擴。
