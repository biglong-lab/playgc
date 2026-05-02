# 🏢 多場域架構完整診斷與建構方案

> 診斷日期：2026-04-24
> 範圍：玩家端路由、後台資料隔離、快取、資料模型、跨場域管理
> 狀態：**需要您通盤決策後一次做到位**，不要再頭痛醫頭

---

## 🔍 為什麼前面修了還有問題

前幾輪的修法是「見招拆招」：
- Q1 後端改 6 個檔案 → 後端 API 對了
- Q2 加 `/f/:code` 路由 → Landing 對了
- **但玩家點「進入遊戲大廳」跳 `/home` 而非 `/f/:code/home`** → 離開場域 scope，重整理就變回 JIACHUN
- **後台 admin 登入後 React Query cache 沒清** → 換場域登入仍看上次 cached 資料

> 這是**系統性設計缺陷**，不是單點 bug。

---

## 📋 完整盤點（4 個層次）

### 層次 1：前端硬編碼路徑（14 處完全沒考慮 fieldCode）

```
❌ 硬編碼 /home（11 處）：
   Landing.tsx / Home.tsx / ChapterSelect.tsx / Checkout.tsx × 2
   JoinWalkie.tsx × 2 / GamePlay.tsx × 2 / PurchaseGate.tsx
   MyPurchases.tsx / PurchaseSuccess.tsx

❌ 硬編碼 /leaderboard（3 處）：
   Home.tsx / MeCenter.tsx / Landing.tsx

❌ setLocation(`/game/${id}`) 無 fieldCode（5 處）：
   Home.tsx × 2 / GameBySlug.tsx / PurchaseGate.tsx / PurchaseSuccess.tsx
```

**症狀**：玩家從 `/f/HPSPACE` 進入後，任何內部導航都離開場域 scope。重整理讀 localStorage → 若 localStorage 有舊值就錯誤。

### 層次 2：前端快取污染（React Query）

```
❌ 切換 admin 帳號時沒清 React Query cache
❌ admin API query key 多數只有 URL，不含 admin.fieldId
   例：queryKey: ["/api/admin/games"]
   結果：JIACHUN admin cache 的資料 → HPSPACE admin 切換後仍看到
```

**症狀**：您用後浦代號登入後看到賈村資訊 — 高機率是**瀏覽器 React Query memory cache**，刷新 3-5 分鐘後才會自動過期。

### 層次 3：後端 API（已大致完成，但需確認）

```
✅ 已改為統一 admin.fieldId：
   admin-games / admin-sessions / admin-roles / revenue
   admin-modules / admin-purchases / admin-walkie
   field-memberships / field / leaderboard (analytics)

✅ 合理保留的 super_admin 放行：
   admin-fields.ts:46       — 場域列表（切場域需要）
   utils.ts:checkGameOwnership — 動作權限
   auth.ts:145,196          — 跨場域登入救援

❓ 尚未檢驗的次要 API：
   /api/admin/client-logs (suspicious log)
   /api/admin/devices
   /api/admin/redeem-codes
   battle-* 系列
```

### 層次 4：資料模型（先天結構）

```
✅ 直接有 field_id 的表：
   games / chapter_templates / roles / admin_accounts
   battle_* / purchases / field_memberships / platform_*

⚠️ 只有 game_id 的表（間接繼承 field_id）：
   items / locations / achievements / chapters / pages
   shooting_records / location_visits / player_progress 等

這是「單一來源」設計（資料在 games 不重複），正確但要求 API 都 JOIN games：
  ❌ 若直接 SELECT * FROM items 就洩漏
  ✅ 若 SELECT items JOIN games WHERE games.field_id = X 就 OK
```

### 層次 5：跨場域管理 UI（完全缺失）

```
❌ 沒有「切換場域」按鈕
❌ super_admin 想看別場域 → 必須登出 + 重新輸入代碼 + 重新登入
❌ UI 不顯示「我現在在哪個場域」（Header 沒有場域徽章）
```

---

## 🎯 統一建構方案（三層藥方）

### 藥方 A：前端中央 Link Builder（解決層次 1）

**新增 `useFieldLink()` hook**：
```ts
// client/src/hooks/useFieldLink.ts
export function useFieldLink() {
  const currentField = useCurrentField();
  return (path: string) => {
    if (path.startsWith("/f/") || path.startsWith("http")) return path;
    // 玩家端路徑前綴：/home /leaderboard /game/xxx → /f/:code/...
    if (!currentField?.code) return path;
    return `/f/${currentField.code}${path.startsWith("/") ? path : "/" + path}`;
  };
}
```

**改寫 14 處硬編碼**：
```tsx
// Before
<Link href="/home">
// After
const link = useFieldLink();
<Link href={link("/home")}>
```

**擴充 App.tsx 路由**：
```
/f/:code                → Landing
/f/:code/home           → Home
/f/:code/leaderboard    → Leaderboard
/f/:code/game/:gameId   → GamePlay
/f/:code/team/:gameId   → TeamLobby
/f/:code/match/:gameId  → MatchLobby
/f/:code/chapters/:gameId → ChapterSelect
/f/:code/map/:gameId    → MapView
/f/:code/purchase/:id   → PurchaseGate
/f/:code/me             → MeCenter
... 全部 player 路由都加 /f/:code 前綴
```

**保留向後相容 + smart redirect**：
```tsx
<Route path="/home" component={() => {
  const field = useCurrentField();
  if (field?.code) return <Redirect to={`/f/${field.code}/home`} />;
  return <Redirect to="/f" />;  // 不知道場域 → 選擇頁
}} />
```

### 藥方 B：前端 Query Cache 隔離（解決層次 2）

**方法 1（推薦，改動最小）**：登入/登出時清快取
```ts
// 在 useAdminLogin 的 onSuccess
queryClient.clear();  // 清所有 query cache
queryClient.setQueryData(["/api/admin/session"], newSession);
```

**方法 2（更嚴謹）**：admin query key 包含 fieldId
```ts
// 所有 admin query 加 admin.fieldId
queryKey: ["/api/admin/games", admin?.fieldId]
```

**建議：先做方法 1**（簡單有效），未來再漸進遷移方法 2。

### 藥方 C：跨場域管理 UI（解決層次 5）

**Header 場域切換器**（UnifiedAdminLayout）：
```
┌──────────────────────────────────────┐
│ 🏢 後浦金城 ▼    [儀表板] [遊戲]...  │
│   └ 展開：                           │
│     ┌──────────────────┐             │
│     │ 🟢 後浦金城（目前）│            │
│     │ 🔵 賈村競技場     │             │
│     │ ─────────────    │             │
│     │ + 新增場域       │             │
│     └──────────────────┘             │
└──────────────────────────────────────┘
```

點擊切換 → 清 query cache → 重新登入該場域（共用 Google token）→ 跳轉到相同頁面。

**純 super_admin 功能**：一般 admin 看不到切換器。

---

## 📊 工程量估計

| 藥方 | 改動規模 | 預估時數 |
|------|---------|---------|
| A. 前端路由統一 | 10+ 檔案、14+ link 改寫、App.tsx 加 20+ 路由 | **4-6h** |
| B. Query cache 清除 | 2 檔案（useAdminLogin + 登出）| **0.5h** |
| C. 場域切換器 UI | 新 Component + 切換 API 邏輯 | **3-4h** |

**總計：~8-10h**，可一次做完（建議）或分兩批。

---

## 🚦 我的建議：一次做完 A+B+C

因為：
1. 只做 A 不做 B → 使用者還是看到 cache 污染
2. 只做 B 不做 A → 路由還是錯
3. C 是 super_admin 日常工作必備，現在沒有很痛

### 推薦執行順序

```
Step 1（30 分）：藥方 B（登入清 cache）
  → 立刻解決「用後浦登入看到賈村資訊」
  → 安全、副作用小

Step 2（4h）：藥方 A（中央 Link Builder + 路由擴充）
  → 解決「/home 掉回預設場域」
  → 14 處 + 20+ 路由

Step 3（3h）：藥方 C（場域切換器 UI）
  → super_admin 日常體驗升級

Step 4：刪除過時的 /home /leaderboard legacy 路由（待一週觀察）
```

---

## ⚠️ 順便指出一個隱憂

目前 `/f/HPSPACE` 路由會觸發 `FieldThemeProvider` 的 500ms 輪詢。這在切場域時會有 **0.5 秒延遲**。更好的做法是：
- 用 wouter 的 `useLocation()` hook 訂閱路徑變更（即時觸發）
- 或在路由改變時透過 `navigate` 附帶 state 通知

這屬於藥方 A 的延伸，一起做了。

---

## 🤔 需要您決策

**方案 1**：我依 Step 1→4 執行（推薦 — 最徹底）
**方案 2**：只做 Step 1（30 分完成，解決最痛的 cache 問題）
**方案 3**：您想改調整哪個 step 順序 / 範圍

請回覆方案號。
