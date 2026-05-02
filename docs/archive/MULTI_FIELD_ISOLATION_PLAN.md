# 🏢 多場域隔離與路由規劃

> 盤點日期：2026-04-24
> 背景：新增後浦金城場域後發現系統許多地方沒真正隔離

---

## 📊 問題盤點

### 問題 A：後台 `super_admin` 無差別看全部（已修主要部分）

`admin` 路由有 **20+ 處** 做「`super_admin` 無 where → 看全部」，導致 super_admin 登入 HPSPACE 還看 JIACHUN 資料。

#### ✅ 本輪已修（使用者會立刻看到的 5 個核心 API）

| 檔案 | 端點 | 狀態 |
|------|------|------|
| `admin-games.ts` | `GET /api/admin/games`、`POST /api/admin/games` | ✅ 統一 `admin.fieldId` |
| `admin-sessions.ts` | `GET /api/admin/sessions` | ✅ |
| `admin-sessions.ts` | `GET /api/admin/stats/overview` | ✅ |
| `leaderboard.ts` | `GET /api/analytics/overview` | ✅ |
| `leaderboard.ts` | `GET /api/analytics/sessions` | ✅ |
| `admin-walkie.ts` | `GET /api/admin/walkie/live-stats` | ✅ |

#### 🟡 仍待處理（下一輪，15 處）

| 檔案 | 影響範圍 | 優先級 |
|------|---------|--------|
| `admin-roles.ts` (×6) | 角色管理、成員清單、帳號列表 | 高 |
| `revenue.ts` (×4) | 收入、商品、兌換碼、交易 | 高 |
| `admin-modules.ts` | 模組庫 | 中 |
| `admin-purchases.ts` | 購買紀錄 | 中 |
| `admin-fields.ts` (×3) | 場域管理、設定 | 中（合理保留 super_admin 看全部場域） |
| `field-memberships.ts` | 場域成員 | 中 |
| `field.ts` (×2) | 場域訂閱/用量 | 低 |
| `utils.ts:83` | checkGameOwnership（權限邊界） | ⚠️ 需謹慎 |

#### ⚠️ 應保留 super_admin 放行的地方
- `admin-fields.ts`: 場域列表（super_admin 要看所有場域才能搬遊戲）
- `utils.ts:checkGameOwnership`: 權限守門（super_admin 能改任意遊戲，但這是「動作權限」非「看見權限」）
- `admin-games.ts:/health/orphans`: 孤兒檢查（僅 super_admin）

---

### 問題 B：玩家端沒有場域入口（尚未解決）

#### 現況
```
game.homi.cc/           → Landing
↓ 登入
game.homi.cc/home       → 讀 localStorage.lastFieldCode → 無則 JIACHUN
```

**沒有任何地方讓玩家明確選「我要去後浦金城」。**

#### 三個方案比較

| 方案 | 網址 | 優點 | 缺點 | 工程量 |
|------|------|------|------|--------|
| **A. 路徑前綴** | `game.homi.cc/f/JIACHUN`<br>`game.homi.cc/f/HPSPACE` | 一套網域、可分享、QR 好做 | 需改路由 | 🟡 中（~1 天） |
| **B. 子網域** | `jiachun.homi.cc`<br>`hpspace.homi.cc` | 視覺最清楚 | DNS + SSL + Nginx 設定 | 🔴 大（~2 天） |
| **C. 登入後切場域** | `/home?field=HPSPACE` | 最簡單 | 玩家不知道可切換 | 🟢 小（~0.5 天） |

#### 推薦方案：**A. 路徑前綴 + C. UI 場域切換器**

路由設計：
```
game.homi.cc/              ← 總入口：若 localStorage 有場域 → redirect；否則顯示場域選擇畫面
game.homi.cc/f/JIACHUN     ← 賈村 Landing（套賈村主題）
game.homi.cc/f/JIACHUN/home ← 賈村 Home
game.homi.cc/f/HPSPACE     ← 後浦 Landing
game.homi.cc/f/HPSPACE/home ← 後浦 Home

現有路由保留向後相容：
game.homi.cc/home          ← 仍可用（使用 localStorage 的場域）
game.homi.cc/g/:slug       ← 短連結進入單一遊戲（自動偵測場域）
```

前端改動：
- 新增 `/pages/FieldEntry.tsx`：場域選擇畫面（列出 active 場域的卡片）
- 擴充 `FieldThemeProvider` 讀 URL param `/f/:fieldCode`
- Landing / Home header 加「切換場域」按鈕（開 Dialog 列場域）

---

## 🎯 完整修復清單（供您決策）

### Phase 1（本輪已完成）✅
- [x] super_admin 跨場域登入
- [x] 正式 DB 清除 pending 殘留
- [x] 5 個核心 admin API 移除 super_admin 放行

### Phase 2（下一步選做）
- [ ] 剩餘 15 處 admin API 統一場域隔離
- [ ] 玩家端 `/f/:fieldCode` 路由 + 場域選擇頁
- [ ] Landing 加場域列表 / 切換 UI
- [ ] AdminGames 頁 UI 「搬移場域」按鈕保留（super_admin 跨場域操作入口）

### Phase 3（SaaS 成熟後）
- [ ] `/platform` 後台擴充（super_admin 全域儀表板）
- [ ] 子網域部署（若需要品牌獨立）
- [ ] 場域白標（每場域可自訂 favicon / OG tags）

---

## 🚦 請您決定

**Q1：Phase 2 的 admin 清理**
- A. 繼續把剩下 15 處都改（我可以分批）
- B. 先這樣就好（等遇到具體問題再改）

**Q2：玩家端場域路由**
- A. 走方案 A（路徑前綴）— 我馬上實作
- B. 走方案 C（只加切換器 UI）— 最快
- C. 兩個都要
- D. 先不做（等場域再多幾個才考慮）

---

## 📝 附註：super_admin 要看全域怎麼辦？

設計原則（調整後）：
- `/admin/*` = **場域後台**（一律受 `admin.fieldId` 約束）
- `/platform/*` = **平台後台**（super_admin 跨場域視角）

super_admin 若要看全域：
1. 到 `/platform` 後台（已存在）
2. 或切換到想看的場域登入
3. 用「場域切換器」（Phase 2 會做）

這是標準 SaaS 多租戶設計 — **同一個人可以擁有平台權限，也可以以場域身分工作，兩個視角明確分開**。
