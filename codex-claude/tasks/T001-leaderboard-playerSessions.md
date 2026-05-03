# T001 — Leaderboard + PlayerSessions 測試修繕

- **狀態**：✅ 已完成
- **完成時間**：2026-05-03 09:15
- **完成者**：Claude
- **commit**：`14eaaea2`

---

## 🎯 任務目標

修復使用者指定的 3 個測試檔失敗：
- `leaderboard.test.ts`（4 失敗）
- `auth.test.ts`（已綠、不動）
- `playerSessions.test.ts`（5 失敗）

## 🔍 根因分析

### Leaderboard（4 失敗）
1. 路由 `/api/analytics/overview` 用 `requireAdminAuth`（admin JWT）
2. 測試 mock 把 `requireAdminAuth` 改成「直接 next()」、**沒注入 `req.admin`**
3. 結果：handler 內 `if (!req.admin) return 401` → 永遠走 401
4. 另：路由用 `getSessionsByField` / `getGamesByField`（場域過濾），測試 mock 只有 `getSessions` / `getGames`

### PlayerSessions（5 失敗）
| 失敗測試 | Handler | 真因 |
|---------|---------|------|
| 應建立新場次（500 vs 201）| POST /api/sessions | `storage.getGame` 不在 mock → throw |
| 新使用者應自動建立（upsertUser 未 call）| 同上 | 同上、提早 throw |
| 應更新現有進度（500 vs 200）| PATCH progress | `storage.getPlayerProgressByUser` 不在 mock |
| 無現有進度應自動建立（500 vs 200）| 同上 | 同上 |
| **場次不存在應回傳 404（500 vs 404）**| 同上 | **路由真 bug**：註解承諾「sessionId 無效 → 404」但實作沒做 |

## 🔧 修法

### Leaderboard 測試（純 mock 修正）
```ts
// mock requireAdminAuth 注入 req.admin
requireAdminAuth: vi.fn((req, res, next) => {
  if (req.headers.authorization === "Bearer valid-token") {
    req.admin = { id: "admin-1", systemRole: "super_admin", fieldId: "field-1" };
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
}),

// 補 storage method
getGamesByField: vi.fn(),
getSessionsByField: vi.fn(),

// 移除「非 admin → 403」case（新架構無 role check）
```

### PlayerSessions 路由（真 bug 修復）
```ts
// server/routes/player-sessions.ts line 338-348
let progress = await storage.getPlayerProgressByUser(sessionId, userId);

// 沒進度紀錄 → 確認 session 存在才建立，否則 404（兌現 contract）
if (!progress) {
  const session = await storage.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ message: "Session not found" });
  }
}
```

### PlayerSessions 測試（補 mock）
```ts
// 補缺方法
getPlayerProgressByUser: vi.fn(),
getGame: vi.fn(),
getItems: vi.fn(),

// 補動態 import mock
vi.mock("../utils/rate-limiters", () => ({
  hotPathLimiter: vi.fn((_req, _res, next) => next()),
  chatLimiter: vi.fn((_req, _res, next) => next()),
}));
vi.mock("../services/field-memberships", () => ({ ensureMembership: vi.fn() }));
vi.mock("../services/achievement-unlock", () => ({ checkAndUnlockAchievements: vi.fn(() => []) }));
```

## ✅ 驗證

| 項目 | 結果 |
|------|------|
| leaderboard.test.ts | 6/6 ✅（原 7、刪 1 個不適用 case）|
| playerSessions.test.ts | 17/17 ✅ |
| auth.test.ts | 21/21 ✅（未動）|
| TypeScript | 零錯誤 ✅ |
| Smoke | 51/51 ✅ |

## 📚 學到什麼（給未來協作參考）

1. **看到「應 404 但實際 500」要先判斷**：是真 bug（路由 fallback 缺）還是測試過時（mock 缺方法）
2. **mock 過時的徵兆**：401 vs 200 通常是 auth mock 沒注入 req.user/req.admin
3. **路由架構演進**：`getSessions` → `getSessionsByField`（場域過濾）等改動需要同步更新測試 mock
4. **註解承諾要實作**：`// 省去 session 存在檢查（會回 undefined → 404）` 這種註解一定要實作驗證、不然容易留下假承諾
