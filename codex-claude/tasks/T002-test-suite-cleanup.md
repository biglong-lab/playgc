# T002 — Test Suite 全綠化（10 失敗檔）

- **狀態**：⏳ 進行中
- **建立時間**：2026-05-03 09:20
- **建立者**：Claude
- **負責人**：（多人協作、依 backlog）

---

## 🎯 任務目標

把完整 `npm run test:run` 的 10 失敗檔修到全綠：
- 144 / 154 檔通過 → **154 / 154**
- 2089 / 2129 測試通過 → **2129 / 2129**

## 📋 子任務（10 項、見 [BACKLOG.md](../BACKLOG.md)）

依優先順序：

| 子 ID | 檔 | 失敗 | 優先 | 估時 | 狀態 | 負責人 |
|-------|----|------|------|------|------|--------|
| T002.1 | adminContent.test.ts | 整檔崩 | P0 | 5 min | ⏳ | — |
| T002.2 | webhook-recur.test.ts | 整檔崩 | P0 | 5 min | ⏳ | — |
| T002.3 | battle-clans.test.ts | 4 | P1 | 15 min | ⏳ | — |
| T002.4 | locations.test.ts | 3 | P2 | 30 min | ⏳ | — |
| T002.5 | adminChapters.test.ts | 11 | P3 | 30 min | ⏳ | — |
| T002.6 | team-scores.test.ts | 6 | P3 | 20 min | ⏳ | — |
| T002.7 | team-votes.test.ts | 5 | P3 | 20 min | ⏳ | — |
| T002.8 | playerChapterActions.test.ts | 3 | P3 | 15 min | ⏳ | — |
| T002.9 | adminRoles.test.ts | 4 | P4 | 15 min | ⏳ | — |
| T002.10 | field-memberships.test.ts | 3 | P4 | 15 min | ⏳ | — |

**總估時**：~3 小時

## 🔍 失敗類型分布

### 類型 A：環境問題（2 檔、~6 失敗）
路由 import 觸發 `db.ts` 頂層 throw（DATABASE_URL 未設）

**修法樣板**：
```ts
// 在 import 路由之前加：
vi.mock("../db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    query: { /* ... */ },
  },
}));
```

### 類型 B：紅線商業邏輯（1 檔、4 失敗）
battle-clans POST 凍結為 410 Gone（Squad 系統取代）

**修法**：改測試斷言為期望 410、刪「成功建立」case
**🚨 紅線**：絕對不要把路由 410 改回 200

### 類型 C：真 bug 嫌疑（1 檔、3 失敗）
locations 路由「不存在 → 應 404」可能實作不完整

**修法**：先 read 路由判斷、必要時修真 bug + 補 mock
**參考**：T001 player-sessions 同類修法

### 類型 D：測試過時（4 檔、25 失敗）
路由架構演進、測試 mock 沒同步

**徵兆**：
- 401 / 404 / 500 vs 期望 200/201 → mock 沒注入 admin / 缺 storage method
- 「應 404 但實際 500」→ 真 bug 嫌疑（先排除）

**修法樣板**：
```ts
// 補 admin auth mock
vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req, res, next) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.admin = { id: "admin-1", systemRole: "super_admin", fieldId: "field-1" };
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }),
  requirePermission: vi.fn(() => (_req, _res, next) => next()),
}));

// 補 storage method
const mockStorage = {
  /* 路由用到的全部 method */
};
```

### 類型 E：訊息文案不匹配（2 檔、7 失敗）
錯誤訊息文案改過、測試斷言沒同步

**修法**：對齊新訊息（grep 路由錯誤訊息、複製到測試）

## 🛠 標準作業流程（每個子任務）

1. **讀路由**：`server/routes/<file>.ts`
2. **跑測試看完整錯誤**：`npm run test:run -- server/__tests__/<file>.test.ts`
3. **判斷類型**：A / B / C / D / E
4. **修**：依類型對應樣板
5. **驗證**：
   ```bash
   npm run test:run -- server/__tests__/<file>.test.ts  # 單檔綠
   npx tsc --noEmit                                     # TS 零錯誤
   node scripts/smoke-test-scenarios.mjs                # smoke 51/51 維持
   ```
6. **append 紀錄**到 `logs/{今日}.md`
7. **更新 BACKLOG.md**：標 [x] 移到「✅ 已完成」
8. **commit + push**：commit message 格式參考 [PROTOCOL.md](../PROTOCOL.md#step-5-commit--push如有改檔)

## 📊 進度追蹤

更新此區（每完成一項）：

```
P0：[ ][ ]                    0/2
P1：[ ]                        0/1
P2：[ ]                        0/1
P3：[ ][ ][ ][ ]              0/4
P4：[ ][ ]                    0/2
總：[ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]  0/10
```

## 🔗 相關

- [BACKLOG.md](../BACKLOG.md) — 完整 backlog
- [logs/2026-05-03.md](../logs/2026-05-03.md) — 紀錄
- [T001 (已完成)](T001-leaderboard-playerSessions.md) — 同類修繕經驗
