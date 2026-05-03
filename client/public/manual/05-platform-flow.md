# 🔄 整體運作流程 — 業務 / 客戶 / admin / 玩家 / 開發者

> 從業務拜訪到玩家互動的完整流程、各角色的具體操作步驟
> 配合手冊前 4 份文件、看完這份就知道平台怎麼跑

---

## 🎯 5 個角色 + 4 個動線

```
┌─────────────────────────────────────────────────────────┐
│                  業務 → 客戶 → admin → 玩家               │
│                          ↓                              │
│               （開發者 / 代理商可繞過、直接 API 接入）        │
└─────────────────────────────────────────────────────────┘
```

| 角色 | 入口 | 主要動線 |
|------|------|---------|
| 業務 | /pitch | 簡報 → 找情境 → 報價 |
| 客戶 | /find-scenario | 找情境 → 看模板 → 諮詢 |
| admin | /admin/dashboard | 一鍵建場 → 印 QR → 跑活動 |
| 玩家 | 掃 QR | 進場 → 互動 → 結算 |
| 開發者 / 代理商 | /api-docs | 拿 API key → 程式建場 |

---

## §1. 業務動線（從拜訪到成交）

### 步驟 1：拜訪前準備

```
業務手機開：
  https://game.homi.cc/pitch
  ↓
傳客戶 Email：
  「附上我們平台簡介，有 12 個現成情境，5 大市場通用」
```

### 步驟 2：拜訪當下展示

```
1. 打開 /pitch（或投影）
   - Hero 區：平台一句話
   - 5 大市場輪播
   - 客戶看到自己的市場（如：婚禮屬於💝）
       ↓
2. 跳到 /find-scenario
   - 跟客戶聊 3 題
   - 推薦 Top 3 情境
       ↓
3. 點推薦 → /template-market/:id
   - 看含哪些元件
   - 看商業價值 + 收費
       ↓
4. 點「立即互動 demo」→ /showcase
   - 讓客戶看實際元件運作
   - 有問題即時答（或查 /faq）
       ↓
5. 開 /roi 計算 ROI
   - 跟客戶確認預估規模
   - 算自己做 vs 用我們、節省多少
```

### 步驟 3：成交與後續

```
談妥：
  - 一次性 → 寄 Recur.tw checkout 連結 → 客戶付款 → admin 開帳號
  - 訂閱 → 客戶到 /pricing 訂閱 → 自動開帳號
  - 委辦 → 簽合約 → 業務協助 admin 上線

合約後：
  業務寄 customer-onboarding 教學
  通知 admin team 協助設定第一場
```

### 業務 KPI 追蹤

```
入口頁瀏覽：/pitch / /find-scenario PV
轉換漏斗：
  /pitch → /find-scenario → /template-market → /pricing → 諮詢
成交：客戶簽約 / 訂閱 / 付款
```

---

## §2. 客戶動線（從接觸到使用）

### Path A：自助型（看到廣告 / 推薦進來）

```
1. https://game.homi.cc/pitch
   看簡介、知道平台能做什麼
       ↓
2. /find-scenario
   3 題找適合情境
       ↓
3. /template-market/:id
   看詳細、看 demo、看收費
       ↓
4. 兩種選擇：
   A. 直接訂閱 → /pricing 訂閱 → admin 帳號開通 → 自助建場
   B. 諮詢業務 → 業務協助設定
```

### Path B：被動型（業務帶看）

```
業務遠端 / 現場展示
  ↓
客戶決定採用 → 簽約 / 付款
  ↓
業務協助開 admin 帳號
  ↓
業務示範一次「一鍵建場」
  ↓
客戶第一場由業務 + admin team 陪跑
  ↓
第二場起客戶自助
```

### 客戶第一場活動的「30 分鐘現場可玩」

```
T-30 分：admin 後台一鍵建場
T-25 分：跳轉 /admin/scenario-qr-print 列印 A4
T-20 分：A4 QR 貼桌卡 / 投影到大螢幕
T-15 分：admin 打開 /host/:sessionId 大螢幕版
T-10 分：admin 測試掃 QR、確認玩家端 OK
T-0 分：活動開始、賓客掃 QR 進入
```

---

## §3. admin 動線（一鍵建場到活動結束）

### 設定第一場活動

```
1. 登入 https://game.homi.cc/admin
   - super_admin / field_director 角色
       ↓
2. /admin/dashboard 點「一鍵建場」
   或進 /template-market 選情境
       ↓
3. 選情境（如：婚禮）
       ↓
4. 點 /template-market/wedding 的「立即建場」
       ↓
5. 系統自動：
   ✓ 建立 game session（含 fieldId）
   ✓ 套用 wedding 模板（PolaroidCollage + Guestbook + Emoji）
   ✓ 產生 hostToken（30 天有效）
   ✓ 產生大螢幕網址 /host/:sessionId
   ✓ 產生玩家 QR /play/:sessionId
       ↓
6. 跳轉 /admin/scenario-qr-print
   - 看 A4 預覽
   - Cmd + P 列印
       ↓
7. 客製化內容（可選）：
   - 改活動名稱「王小明 & 林小美的婚禮」
   - 改文案「新郎新娘的祝福」
   - 加自訂 emoji 集（💕 💍 🎂）
   - 加題目（如使用 Trivia）
```

### 活動進行中

```
1. 主持人 / admin 打開大螢幕版
   /host/:sessionId on 投影機 / 大螢幕電視
       ↓
2. 賓客陸續掃 QR 進入
   /play/:sessionId 在手機開
       ↓
3. admin 在手機 / 平板看 /admin/dashboard 即時數據
   - 多少人加入了
   - 多少留言上傳
   - 多少 emoji 觸發
       ↓
4. 主持人引導「現在請上傳合照」
   PolaroidCollage 即時飄入
       ↓
5. 高潮時刻（戒指交換）
   admin 可手動觸發 emoji burst
   或玩家自由按 emoji
```

### 活動結束

```
1. admin 點 /admin/dashboard 「結束活動」
       ↓
2. 系統自動：
   ✓ 凍結 hostToken
   ✓ 鎖玩家端 /play/:sessionId
   ✓ 產生統計報表
   ✓ 整合所有照片 / 留言為 ZIP
       ↓
3. admin 可下載：
   - 完整照片包
   - 留言匯出（PDF / CSV）
   - 統計報表（PDF）
       ↓
4. （訂閱型）系統自動發送：
   - Resend 郵件給客戶「活動完成、紀錄附件」
   - 配額更新（已用 1 場）
```

---

## §4. 玩家動線（從掃 QR 到結束）

### Host 軸線（婚禮 / 園遊會）

```
1. 在現場看到 QR
   ↓
2. 手機相機掃 → /play/:sessionId
   ↓
3. 進入活動頁（無需登入）
   - 系統識別 hostToken
   - 顯示活動名稱 + 主持說明
   ↓
4. 互動（依當前 host 元件）：
   - PolaroidCollage：「上傳一張合照」
   - GuestbookDigital：「留祝福」
   - EmojiReact：「按 emoji」
   - PollLive：「投票」
   - TriviaShowdown：「搶答」
   ↓
5. 看大螢幕同步反應
   ↓
6. 活動結束、可下載個人紀錄（含自己上傳的照片）
```

### Multi 軸線（街區 / 企業內訓）

```
1. 看到 QR / 收到邀請連結
   ↓
2. 手機開 → 提示 Firebase 登入
   - LINE Login / Google / Email
   ↓
3. 進入活動頁、選擇加入隊伍
   - 建立 Squad（永久隊伍）/ 加入既有 / Ad-hoc team
   ↓
4. 依關卡互動：
   - GpsCascade：到指定地點解鎖
   - JigsawPuzzle：跟隊員拼圖
   - RoleAssign：抽角色 + 演劇本
   - TreasureHunt：找線索拼密碼
   ↓
5. 累積分數 / 戰績到 Squad
   ↓
6. 活動結束、戰績進個人檔案
   - /me/squads 看自己加入的所有 Squad
   - /squad/:id 看 Squad 完整紀錄
```

---

## §5. 開發者 / 代理商動線（API 直接接入）

### 取得 API Key

```
1. 業務評估後寄 API Key 給代理商
   - API_KEYS 環境變數新增該 key
   - API_KEY_FIELD_<keyIdShort> 對應 fieldId
       ↓
2. 代理商收到：
   - API key 字串
   - fieldId
   - rate limit（60 req/min）
   - quota（每月 N 場）
```

### 程式建場

```typescript
// 1. 列出可用情境
const res = await fetch('https://game.homi.cc/api/v1/scenarios', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
});
const { scenarios } = await res.json();

// 2. 建場
const create = await fetch('https://game.homi.cc/api/v1/instances', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
    'Idempotency-Key': 'unique-uuid-here',
  },
  body: JSON.stringify({
    scenarioId: 'wedding',
    name: '張先生婚禮',
    customization: {
      coupleNames: ['張先生', '李小姐'],
      emojiSet: ['💕', '💍', '🎂'],
    },
  }),
});

const { sessionId, hostUrl, playUrl, qrCodeUrl } = await create.json();

// 3. 整合到自己平台
//    - 顯示 qrCodeUrl 給客戶
//    - 提供 hostUrl 給主持人
```

### 代理商常見場景

```
場景 A：白標包裝
  代理商有自己的活動平台、用我們 API 串遊戲互動
  
場景 B：批量建場
  公部門委辦案、一週要建 50 場、用 API 自動化
  
場景 C：嵌入既有系統
  HR 系統內訓模組、員工點擊「開始培訓」自動 call API
```

---

## §6. 系統架構速查

```
┌─────────────────┐         ┌─────────────────┐
│  玩家手機         │         │  大螢幕 / 主持   │
│  (multi/host)   │         │  /host/:id      │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │  WebSocket / REST         │
         └─────────┬─────────────────┘
                   ↓
         ┌─────────────────┐
         │  Express server │
         │  (Vite SSR)    │
         └────────┬────────┘
                  │
       ┌──────────┼──────────┐
       ↓          ↓          ↓
  ┌────────┐ ┌────────┐ ┌─────────┐
  │ Postgres│ │ Cloudinary│ │ Firebase│
  │ (資料)  │ │ (圖片)   │ │ (Auth)  │
  └────────┘ └────────┘ └─────────┘
       ↑
       │
  ┌─────────┐
  │ Coolify │ ← Docker Compose
  │ webhook │
  └────┬────┘
       │
  ┌────────┐
  │ GitHub │ ← git push origin main
  └────────┘
```

**技術棧**：
- 前端：React 18 + Vite + TypeScript + wouter + TanStack Query + Tailwind
- 後端：Express + Drizzle ORM + WebSocket
- DB：PostgreSQL 16（生產 Docker `gamehomicc-db-1`）
- Auth：Firebase Auth（玩家）+ Admin JWT（後台）+ hostToken（host 軸線）
- 儲存：Cloudinary（圖片）
- 部署：Docker Compose + Nginx + Coolify

---

## §7. 一場活動的資料流

### 範例：王小明的婚禮（wedding 情境）

```
T-1 day（前一天）：
  admin 一鍵建場 → DB 寫入：
    game_sessions table
      id: "abc123"
      fieldId: "wd-2026-may"
      scenarioId: "wedding"
      hostToken: "ht_xxxx"
      status: "ready"

T-30 min（活動前 30 分）：
  admin 列印 A4 QR + 貼現場
  打開 /host/abc123 投影

T-0 min（活動開始）：
  賓客掃 QR → /play/abc123
    ↓
  WS connect → broadcast guest_join
  DB 寫入：
    sessions_participants
      sessionId: "abc123"
      anonymousId: "uuid_yyyy"
      joinedAt: "..."

賓客上傳合照：
  POST /api/upload → Cloudinary
    ↓
  WS broadcast polaroid_added
  DB 寫入：
    polaroid_uploads
      sessionId: "abc123"
      photoUrl: "https://cloudinary.com/..."

戒指交換 emoji burst：
  賓客點 emoji
    ↓
  WS broadcast emoji_react
  in-memory pulse（不寫 DB、減負載）

T+3 hr（活動結束）：
  admin 點「結束活動」
    ↓
  game_sessions.status = "completed"
  異步：
    - 整合所有 polaroid_uploads → ZIP
    - 上傳到 Cloudinary
    - Resend 寄連結給客戶
```

---

## §8. 5 大紅線（避免事故）

依 [`CLAUDE.md`](../../CLAUDE.md)：

```
❌ 1. 禁止自動部署 — 只有 admin 明確說「部署」才執行
❌ 2. Schema 只新增不刪除 — 禁 DROP TABLE / DROP COLUMN
❌ 3. Squad 取代 battle_clans — 不可再加 battle_clans 寫入點
❌ 4. 禁直連生產 DB 開發 — 用本地 Docker
❌ 5. 禁密碼 / API key 寫程式碼 — 用環境變數
```

---

## §9. 平台健康度監控

| 指標 | 監控方式 | 健康範圍 |
|------|---------|---------|
| Smoke test | `node scripts/smoke-test-scenarios.mjs` | 51/51 通過 |
| TypeScript | `npx tsc --noEmit` | 零錯誤 |
| 完整測試 | `npm run test:run` | 157 檔 / 2207 tests 全綠 |
| 生產 CPU | SSH `docker stats` | < 50% |
| 生產記憶體 | SSH `docker stats` | < 50% |
| WebSocket 連線 | 後台監控 | 穩定不重連 |

部署後驗證指令：
```bash
curl -s https://game.homi.cc/api/v1/health | jq
curl -s https://game.homi.cc/api/scenarios/health | jq
curl -s https://game.homi.cc/api/v1/scenarios | jq '.scenarios | length'
```

---

## 🔗 完整文件索引

- [README.md](README.md) — 手冊主目錄
- [01-host-components.md](01-host-components.md) — 14 host 元件
- [02-multi-components.md](02-multi-components.md) — 14 multi 元件
- [03-scenario-templates.md](03-scenario-templates.md) — 12 情境模板
- [04-business-pages.md](04-business-pages.md) — 11 業務工具頁
- 本檔 — 整體運作流程

---

## 🚀 下一階段（Phase 6+）

依 [`docs/decisions/0012-phase5-direction.md`](../decisions/0012-phase5-direction.md) 與後續路徑：

- **W17-W21**：真實付費客戶、API 擴充、多語系
- **W22+**：元件擴充（賓果板、決策樹、商家集章 etc.）+ 情境補強
- **未來方向**：教育市場、AI 協同生成、跨場域聯盟

商業模式重點：
> **官方著力點 = 平台穩定好用 + 情境豐富、提供使用者想像**
> 這就是創作者的舞台、我們提供穩定基礎、創意是客戶的。
