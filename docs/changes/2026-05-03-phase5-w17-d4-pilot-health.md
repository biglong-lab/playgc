# Phase 5 W17 D4 — Admin Pilot 健康度雛形 endpoint

**日期**：2026-05-03
**範圍**：W17 D4（業務週工程備援任務 v3、為 W20 觀測週鋪路）
**狀態**：🟢 W17 D4 完成、admin 一個 endpoint 看平台運作

---

## 🎯 目標達成

> ADR-0012 W20 規劃完整觀測儀表板
> W17 D4 先做雛形 endpoint（給 admin 用 curl / 瀏覽器看 JSON）
> W20 才包成完整 UI

---

## 📦 新增

### 1. `server/routes/admin-pilot-health.ts`

**`GET /api/admin/pilot/health`** 端點：

```json
{
  "windowDays": 30,
  "timestamp": "2026-05-03T...",
  "isSuperAdmin": true,
  "activity": {
    "activeSessions": 3,
    "completedSessions30d": 12,
    "totalSessions30d": 15,
    "completionRate": 80
  },
  "coverage": {
    "distinctScenarios": 4,
    "scenarioIds": ["wedding", "icebreaker", "reunion", "corporate-training"],
    "fieldsCount": 2
  },
  "serviceStatus": {
    "lineBot": true,
    "lineNlu": true,
    "lineAdmin": true,
    "cronEnabled": false,
    "webhookDispatch": false,
    "payment": false,
    "email": false,
    "ai": true
  }
}
```

### 2. 三大區塊

**activity（活動量）**：
- activeSessions — 目前 active host sessions
- completedSessions30d — 30 天結束數
- totalSessions30d — 30 天總數
- completionRate — 完成率（%）

**coverage（覆蓋度）**：
- distinctScenarios — 用過幾種情境
- scenarioIds — 哪幾個情境
- fieldsCount — 幾個場域（super_admin 看全部）

**serviceStatus（服務配置）**：
- lineBot / lineNlu / lineAdmin — LINE 三層配置
- cronEnabled — 排程推播
- webhookDispatch — 客戶 webhook
- payment / email / ai — 三方服務

→ 不暴露 secrets，只看「有沒有配置」

### 3. 場域過濾

- super_admin：全平台數據 + fieldsCount
- 其他：只看自己場域 + fieldsCount=1

### 4. Smoke test 加 401 驗證

`GET /api/admin/pilot/health`（無認證 → 401）

Smoke test 50 → 51。

---

## 💡 設計決策

### 為何雛形先做 endpoint、不做 UI？

選擇：W17 D4 endpoint only、W20 才做完整 UI

理由：
- W17 是業務週、UI 不是優先
- endpoint 出來 admin 可以 curl / 瀏覽器即看（即時可用）
- W20 規劃會看真實 30 天數據再決定 UI 設計（避免做過頭）
- 業務同學想看 → 工程同學給 curl 命令 + 解釋

### 為何把所有 service status 放一起？

選擇：activity + coverage + serviceStatus 三大區塊

理由：
- 一個 endpoint 給「平台運作快照」（看完知道整體狀態）
- 分散到多個 endpoint = 業務不知道從哪看起
- 一頁圖（W20 UI）對應一個 endpoint，最簡單

### 為何 completionRate 只算 30 天？

選擇：固定 30 天窗口

理由：
- 與 scenarios/stats 端點一致（已有 30 天慣例）
- 30 天足以看趨勢、又不太久
- W20 評估是否需要 7d / 90d 多 windows

### 為何不直接擴充 scenarios/stats？

選擇：新建獨立 endpoint

理由：
- scenarios/stats 是「情境統計」、用途特定
- pilot/health 是「平台健康度」、更廣
- 概念不同、合在一起會很臃腫
- 命名語意化（admin 看 pilot 監控時不會想到 scenarios）

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- Smoke test：50 → 51（新增 pilot/health 401 驗證）

---

## 📊 業務 / admin 使用方式（W17 D4 雛形）

**業務查看健康度**（給工程同學發指令）：

```bash
# 1. admin 登入後取得 cookie
# 2. curl 取得 health JSON
curl https://game.homi.cc/api/admin/pilot/health \
  -H "Cookie: <admin-session-cookie>"
```

**瀏覽器看**：
- 開瀏覽器 dev tools → Network
- 訪問 admin 後台後、複製貼上 endpoint URL
- 看 JSON

W20 完整 UI 後 → 直接 admin 後台一頁圖看完。

---

## ⏭ 下一步：W17 D5

- W17 D5：W17 業務週 retro + W18 元件擴充清單確認
- 業務反饋彙整 → 決定 W18 哪 5 個新元件優先
- 工程同學：W18 規劃文件（哪些元件）

---

## 🔗 相關文件

- [W17 D3 ROI 計算機](2026-05-03-phase5-w17-d3-roi-calculator.md)
- [W17 D2 FAQ 頁](2026-05-03-phase5-w17-d2-faq-page.md)
- [W17 D1 客戶 pilot 啟動](2026-05-03-phase5-w17-d1-customer-pilot.md)
- [ADR-0012 Phase 5 方向](../decisions/0012-phase5-direction.md)
