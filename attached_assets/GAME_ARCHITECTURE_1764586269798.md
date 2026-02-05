# 賈村競技體驗場 - 實境遊戲系統架構設計

## 專案概述

本專案旨在為**賈村競技體驗場**打造一套完整的實境遊戲開發與管理系統,讓遊戲設計者能夠輕鬆創建結合射擊、拍照、定位、任務等多元互動的沉浸式體驗。系統將整合 Arduino 設備串接功能,實現線上線下的深度互動。

### 核心特色

本系統專為實體競技場域設計,具備以下核心特色:

- **模組化頁面編輯器**:如同製作簡報般直觀,無需編程即可組合遊戲流程
- **多元互動機制**:整合射擊、拍照、GPS定位、QR Code掃描、Arduino感應器等
- **即時對話系統**:支援玩家間即時通訊與團隊協作
- **積分與排行榜**:完整的遊戲化機制,提升競爭與重玩性
- **設備串接擴展**:預留 Arduino 介面,可串接射擊靶機、感應器、燈光等實體設備

### 應用場景

**賈村競技體驗場**可運用本系統設計多種遊戲模式:

| 遊戲類型 | 核心玩法 | 技術應用 |
| --- | --- | --- |
| **戰術射擊任務** | 玩家依據手機指示前往指定射擊點,完成射擊任務獲得積分 | GPS定位 + Arduino射擊靶機串接 + 即時積分計算 |
| **諜報解謎** | 在場域中尋找線索、拍攝特定物品、破解密碼 | 拍照辨識 + QR Code + 文字驗證 |
| **團隊競賽** | 多隊同時進行,透過即時對話協作,搶先完成任務 | 即時通訊 + 排行榜 + GPS追蹤 |
| **生存挑戰** | 限時內完成多項關卡,結合體能與智力挑戰 | 計時器 + 多點定位 + 設備感應 |

## 系統架構

### 技術堆疊

本系統採用現代化的全端技術堆疊,確保開發效率與系統穩定性:

| 層級 | 技術選型 | 說明 |
| --- | --- | --- |
| **前端框架** | React + Vite | 快速的開發體驗,組件化架構 |
| **UI框架** | Tailwind CSS + DaisyUI | 快速建構美觀的響應式介面 |
| **後端服務** | Supabase | 提供資料庫、即時通訊、身份驗證、檔案儲存 |
| **地圖服務** | Leaflet.js | 開源地圖庫,顯示玩家位置與任務點 |
| **即時通訊** | Supabase Realtime | WebSocket 即時資料同步 |
| **圖片處理** | Canvas API + Compressor.js | 前端圖片壓縮與處理 |
| **IoT串接** | MQTT + Arduino | 透過 MQTT 協定與 Arduino 設備通訊 |
| **部署平台** | Replit (開發) → Vercel (正式) | 快速原型開發,後續可升級至 Vercel |

### 系統架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                        玩家端 (手機)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 遊戲介面 │  │ 地圖導航 │  │ 拍照上傳 │  │ 即時聊天 │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS / WebSocket
┌───────────────────────┴─────────────────────────────────────┐
│                      Supabase 後端服務                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │PostgreSQL│  │ Realtime │  │   Auth   │  │ Storage  │   │
│  │  資料庫  │  │ 即時通訊 │  │ 身份驗證 │  │ 檔案儲存 │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │ MQTT Broker
┌───────────────────────┴─────────────────────────────────────┐
│                    Arduino 設備層                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 射擊靶機 │  │ 感應器   │  │ 燈光控制 │  │ 計分板   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 資料庫設計

#### 核心資料表

**1. games (遊戲)**
```sql
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  difficulty VARCHAR(20), -- easy, medium, hard
  estimated_time INTEGER, -- 預估完成時間(分鐘)
  max_players INTEGER DEFAULT 6,
  status VARCHAR(20) DEFAULT 'draft', -- draft, published, archived
  creator_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**2. pages (頁面)**
```sql
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  page_order INTEGER NOT NULL,
  page_type VARCHAR(50) NOT NULL, -- text_card, dialogue, video, button, text_verify, choice_verify, etc.
  config JSONB NOT NULL, -- 頁面配置(JSON格式)
  created_at TIMESTAMP DEFAULT NOW()
);
```

**3. items (道具)**
```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  item_type VARCHAR(50), -- consumable, equipment, quest_item, collectible
  effect JSONB, -- 道具效果配置
  created_at TIMESTAMP DEFAULT NOW()
);
```

**4. events (搜索事件)**
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- qrcode, gps, photo, arduino
  trigger_config JSONB NOT NULL, -- 觸發條件配置
  reward_config JSONB, -- 獎勵配置
  created_at TIMESTAMP DEFAULT NOW()
);
```

**5. game_sessions (遊戲場次)**
```sql
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  team_name VARCHAR(100),
  player_count INTEGER,
  status VARCHAR(20) DEFAULT 'playing', -- playing, completed, abandoned
  score INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

**6. player_progress (玩家進度)**
```sql
CREATE TABLE player_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  current_page_id UUID REFERENCES pages(id),
  inventory JSONB DEFAULT '[]', -- 持有道具
  variables JSONB DEFAULT '{}', -- 遊戲變數
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**7. chat_messages (即時聊天)**
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**8. arduino_devices (Arduino設備)**
```sql
CREATE TABLE arduino_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_name VARCHAR(100) NOT NULL,
  device_type VARCHAR(50), -- shooting_target, sensor, light_control
  mqtt_topic VARCHAR(200),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  status VARCHAR(20) DEFAULT 'online', -- online, offline
  last_heartbeat TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**9. shooting_records (射擊記錄)**
```sql
CREATE TABLE shooting_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES game_sessions(id),
  device_id UUID REFERENCES arduino_devices(id),
  user_id UUID REFERENCES auth.users(id),
  hit_score INTEGER,
  hit_position VARCHAR(50), -- 命中位置
  timestamp TIMESTAMP DEFAULT NOW()
);
```

**10. leaderboard (排行榜)**
```sql
CREATE TABLE leaderboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  session_id UUID REFERENCES game_sessions(id),
  team_name VARCHAR(100),
  total_score INTEGER,
  completion_time INTEGER, -- 完成時間(秒)
  rank INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 頁面模組設計

### 故事型頁面

**1. 字卡 (Text Card)**
```json
{
  "type": "text_card",
  "config": {
    "title": "任務開始",
    "content": "歡迎來到賈村競技場...",
    "background_image": "url",
    "text_color": "#ffffff",
    "font_size": "large",
    "animation": "fade_in"
  }
}
```

**2. 對話 (Dialogue)**
```json
{
  "type": "dialogue",
  "config": {
    "character": {
      "name": "指揮官",
      "avatar": "url"
    },
    "messages": [
      "士兵,你的任務是...",
      "記住,時間緊迫!"
    ],
    "auto_advance": false
  }
}
```

**3. 影片 (Video)**
```json
{
  "type": "video",
  "config": {
    "video_url": "youtube_url",
    "auto_play": true,
    "skip_enabled": false
  }
}
```

**4. 圖文按鈕 (Button)**
```json
{
  "type": "button",
  "config": {
    "buttons": [
      {
        "text": "開始任務",
        "icon": "url",
        "next_page_id": "uuid"
      }
    ]
  }
}
```

### 驗證型頁面

**1. 文字驗證 (Text Verify)**
```json
{
  "type": "text_verify",
  "config": {
    "question": "請輸入密碼",
    "answers": ["ALPHA", "alpha"],
    "case_sensitive": false,
    "hints": [
      "提示1: 與希臘字母有關",
      "提示2: 第一個字母"
    ],
    "max_attempts": 3,
    "success_message": "密碼正確!",
    "failure_message": "密碼錯誤,請重試"
  }
}
```

**2. 選擇驗證 (Choice Verify)**
```json
{
  "type": "choice_verify",
  "config": {
    "question": "選擇你的武器",
    "options": [
      {"text": "步槍", "correct": true},
      {"text": "手槍", "correct": false},
      {"text": "狙擊槍", "correct": false}
    ],
    "multiple": false
  }
}
```

**3. 條件驗證 (Conditional Verify)**
```json
{
  "type": "conditional_verify",
  "config": {
    "question": "你選擇往哪裡前進?",
    "conditions": [
      {
        "keywords": ["左", "left"],
        "next_page_id": "left_path_uuid"
      },
      {
        "keywords": ["右", "right"],
        "next_page_id": "right_path_uuid"
      }
    ],
    "default_page_id": "default_uuid"
  }
}
```

### 互動型頁面 (賈村專屬)

**1. 射擊任務 (Shooting Mission)**
```json
{
  "type": "shooting_mission",
  "config": {
    "target_device_id": "arduino_uuid",
    "required_hits": 5,
    "time_limit": 60,
    "min_score": 30,
    "success_reward": {
      "points": 100,
      "items": ["item_uuid"]
    }
  }
}
```

**2. 拍照任務 (Photo Mission)**
```json
{
  "type": "photo_mission",
  "config": {
    "instruction": "拍攝紅色標靶",
    "ai_verify": true,
    "target_keywords": ["紅色", "標靶"],
    "manual_verify": false
  }
}
```

**3. GPS定位任務 (GPS Mission)**
```json
{
  "type": "gps_mission",
  "config": {
    "target_location": {
      "lat": 25.0330,
      "lng": 121.5654
    },
    "radius": 10,
    "instruction": "前往A區射擊點"
  }
}
```

**4. QR Code掃描 (QR Scan)**
```json
{
  "type": "qr_scan",
  "config": {
    "qr_code_id": "qr_uuid",
    "success_message": "發現線索!",
    "reward": {
      "points": 50,
      "items": []
    }
  }
}
```

**5. Arduino感應器 (Arduino Sensor)**
```json
{
  "type": "arduino_sensor",
  "config": {
    "device_id": "arduino_uuid",
    "sensor_type": "motion",
    "trigger_condition": "detected",
    "timeout": 30
  }
}
```

## Arduino 設備串接方案

### MQTT 通訊協定

系統採用 MQTT 協定與 Arduino 設備通訊,確保低延遲與高可靠性。

#### 主題 (Topic) 設計

```
jiachun/devices/{device_id}/status    # 設備狀態
jiachun/devices/{device_id}/command   # 控制指令
jiachun/devices/{device_id}/data      # 數據回傳
jiachun/sessions/{session_id}/events  # 遊戲事件
```

#### 射擊靶機整合範例

**Arduino 端程式碼架構**
```cpp
#include <WiFi.h>
#include <PubSubClient.h>

const char* mqtt_server = "broker.hivemq.com";
const char* device_id = "target_001";

void callback(char* topic, byte* payload, unsigned int length) {
  // 接收控制指令
  if (strcmp(topic, "jiachun/devices/target_001/command") == 0) {
    // 處理指令 (如: 重置靶機、開始計分)
  }
}

void setup() {
  // WiFi 與 MQTT 連接設定
  client.setCallback(callback);
}

void loop() {
  // 偵測射擊
  if (hitDetected()) {
    int score = calculateScore();
    String payload = "{\"hit\":true,\"score\":" + String(score) + "}";
    client.publish("jiachun/devices/target_001/data", payload.c_str());
  }
}
```

**後端處理**
```javascript
// Supabase Edge Function
import { createClient } from '@supabase/supabase-js'

// 監聽 MQTT 訊息
mqtt.on('message', async (topic, message) => {
  const data = JSON.parse(message.toString())
  
  // 記錄射擊數據
  await supabase.from('shooting_records').insert({
    session_id: currentSessionId,
    device_id: data.device_id,
    hit_score: data.score,
    timestamp: new Date()
  })
  
  // 更新玩家積分
  await updatePlayerScore(currentSessionId, data.score)
})
```

### 支援的設備類型

| 設備類型 | 功能說明 | 數據格式 |
| --- | --- | --- |
| **射擊靶機** | 偵測命中並計算分數 | `{hit: true, score: 10, position: "center"}` |
| **動作感應器** | 偵測玩家通過特定區域 | `{detected: true, timestamp: 1234567890}` |
| **燈光控制** | 根據遊戲狀態控制燈光 | `{color: "red", brightness: 80}` |
| **計分板** | 顯示即時積分與排名 | `{team: "A", score: 350}` |
| **RFID讀卡機** | 識別玩家身份或道具 | `{card_id: "ABC123", type: "player"}` |

## 即時通訊系統

### 功能設計

玩家在遊戲過程中可透過即時聊天系統進行團隊協作:

- **團隊頻道**: 同隊玩家可互相通訊
- **系統通知**: 自動推送任務提示、積分變化等
- **語音訊息**: 支援錄音並上傳(可選功能)
- **位置分享**: 分享當前GPS位置給隊友

### 技術實作

使用 Supabase Realtime 實現 WebSocket 即時通訊:

```javascript
// 訂閱聊天訊息
const channel = supabase
  .channel(`session_${sessionId}`)
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'chat_messages' },
    (payload) => {
      displayMessage(payload.new)
    }
  )
  .subscribe()

// 發送訊息
async function sendMessage(text) {
  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    user_id: currentUserId,
    message: text
  })
}
```

## 積分與排行榜系統

### 積分計算規則

| 行為 | 基礎分數 | 加成條件 |
| --- | --- | --- |
| 完成文字驗證 | 10 | 首次答對 +5 |
| 射擊命中靶心 | 20 | 連續命中 x1.5 |
| 完成GPS任務 | 15 | 快速完成 +10 |
| 拍照任務 | 10 | 高品質照片 +5 |
| 發現隱藏線索 | 30 | - |
| 完成遊戲 | 100 | 時間獎勵 0-50 |

### 排行榜類型

- **即時排行**: 顯示當前遊戲場次的即時排名
- **每日排行**: 當日所有場次的最高分
- **歷史排行**: 所有時間的最高紀錄
- **好友排行**: 與好友的分數比較

## 後台管理功能

### 遊戲編輯器

提供視覺化的拖曳式編輯器,讓管理員能夠:

- 新增/編輯/刪除頁面模組
- 設定頁面跳轉邏輯
- 預覽遊戲流程
- 測試模式快速驗證

### 設備管理

- 查看所有 Arduino 設備狀態
- 遠端控制設備(重啟、校正)
- 查看設備歷史數據
- 設定設備維護提醒

### 數據分析

- 遊戲遊玩次數統計
- 玩家完成率分析
- 熱門關卡排行
- 設備使用率統計
- 玩家回饋與評分

## 開發階段規劃

### Phase 1: 核心系統 (2週)
- 基礎架構搭建
- 資料庫設計與建立
- 身份驗證系統
- 基本頁面模組(字卡、對話、按鈕)

### Phase 2: 驗證與互動 (2週)
- 驗證型頁面實作
- GPS定位功能
- QR Code掃描
- 拍照上傳功能

### Phase 3: Arduino整合 (2週)
- MQTT通訊建立
- 射擊靶機串接
- 感應器整合
- 即時數據同步

### Phase 4: 遊戲化功能 (1週)
- 積分系統
- 排行榜
- 即時聊天
- 道具系統

### Phase 5: 後台管理 (1週)
- 遊戲編輯器
- 設備管理介面
- 數據分析儀表板

### Phase 6: 測試與優化 (1週)
- 完整功能測試
- 效能優化
- UI/UX調整
- 正式上線準備

## 總結

本系統將為賈村競技體驗場打造一個功能完整、擴展性強的實境遊戲平台。透過模組化設計,管理員可以快速創建多樣化的遊戲內容;透過 Arduino 設備串接,實現線上線下的深度整合;透過即時通訊與積分系統,提升玩家的參與感與競爭性。

系統採用現代化的技術堆疊,確保開發效率與未來的可維護性。初期可在 Replit 上快速原型開發,後續可無縫遷移至 Vercel 等生產環境,滿足更大規模的使用需求。
