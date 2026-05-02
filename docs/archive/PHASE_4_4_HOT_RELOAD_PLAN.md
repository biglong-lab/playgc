# 🔄 Phase 4.4 後續 — Server WS 動態讀 admin 設定

> **建立日期**：2026-05-02
> **狀態**：📝 規劃文件（admin UI 已就位，server 端動態讀取留後續）
> **依據**：[GAME_COMPONENT_MULTIPLAYER_PLAN.md](GAME_COMPONENT_MULTIPLAYER_PLAN.md) §11 暫緩項 4/5

---

## 當前 4/5 完成度

```
✅ shared/schema/fields.ts FieldSettings 加 3 欄位
✅ server/index.ts /api/admin/fields/:id/settings PATCH 已存在（settings jsonb）
✅ admin UI（FieldSettingsPage FeaturesTab）— admin 可設值並存入 DB
✅ server/routes/websocket.ts env var fallback（DISCONNECT_GRACE_MS / AUTO_LEAVE_AFTER_GRACE_MS）

⏳ server WS 動態從 DB 讀 fields.settings.disconnectGracePeriodSec（**未做**）
```

---

## 為什麼留待後續

`startGraceTimer(teamId, userId, userName)` 在 socket close 時觸發。要動態讀：

1. **同步 DB query 風險**：每次 close 都打 DB（teamId → gameId → fieldId → settings）
   - 性能影響：每場活動 100+ 人同時 close 會打 100+ 次 DB
2. **快取策略需設計**：
   - per-team cache（team_join 時拉一次）→ admin 改設定不會立即生效（需重連）
   - per-game cache + invalidate hook → 複雜
3. **目前 env var 已能用**：ops 可直接改 docker-compose 環境變數

依「**最小可行 + 依需求迭代**」原則，現階段：
- admin UI 持久化值（給未來 server 拉用）
- ops 用 env var 即時調（已可用）
- server hot-reload 留待**真有頻繁調整需求**才實作

---

## 完整實作方案（後續 follow-up）

### 方案 A：team_join cache（推薦，無 DB 性能影響）

```ts
// server/routes/websocket.ts
const teamGraceCache: Map<string, { gracePeriodMs: number; autoLeaveMs: number }> = new Map();

case "team_join":
  // 既有邏輯...
  // 🆕 第一次 team_join 時拉 field settings 進 cache
  if (!teamGraceCache.has(message.teamId)) {
    try {
      const team = await db.query.teams.findFirst({
        where: eq(teams.id, message.teamId),
        with: { game: true },
      });
      const fieldId = team?.game?.fieldId;
      if (fieldId) {
        const field = await db.query.fields.findFirst({
          where: eq(fields.id, fieldId),
        });
        const settings = field?.settings as FieldSettings | undefined;
        teamGraceCache.set(message.teamId, {
          gracePeriodMs: (settings?.disconnectGracePeriodSec ?? 30) * 1000,
          autoLeaveMs: (settings?.autoLeaveAfterGraceSec ?? 120) * 1000,
        });
      }
    } catch {
      /* fallback to env/hardcode */
    }
  }

// startGraceTimer 內部：
const cache = teamGraceCache.get(teamId);
const graceMs = cache?.gracePeriodMs ?? GRACE_PERIOD_MS;
const autoLeaveMs = cache?.autoLeaveMs ?? AUTO_LEAVE_AFTER_GRACE_MS;
```

**取捨**：
- ✅ 無同步 DB query 在 close 路徑
- ⚠️ admin 改設定不會立即生效，需要 team 重新建（或 server 重啟）

### 方案 B：API endpoint 觸發 cache invalidate

```ts
// admin 改完 settings 時，client 多打一個 endpoint
POST /api/admin/fields/:fieldId/reload-grace-cache
→ server 清掉 teamGraceCache 中該 fieldId 對應的 entries
```

**取捨**：
- ✅ admin 改完即時生效
- ⚠️ 多一個 endpoint + admin UI 整合

### 方案 C：完整 hot reload（最複雜）

server 啟動時建立全域 settings cache + 每 N 分鐘重新讀 DB + WS 廣播給玩家「設定變更」。
工程量大，**不建議現階段做**。

---

## 觸發實作條件

當以下任一出現時啟動方案 A：

1. **使用者明確要求**：「我需要 admin 改寬限期能立即影響玩家」
2. **實機驗證發現**：env var 不夠用（多場域不同設定）
3. **多場域差異化需求**：賈村 30s / 後浦 60s 等實際差異

---

## 結語

✅ admin UI 4/5 階段性完成 — admin 可設值並存 DB，env var 提供 ops 即時調整。
完整 server hot reload 留待方案 A 實作觸發條件出現時推進。

關連文件：
- [GAME_COMPONENT_MULTIPLAYER_PLAN.md](GAME_COMPONENT_MULTIPLAYER_PLAN.md) §11 Phase 2.5 暫緩項
- [B_LEVEL_MULTIPLAYER_EVAL.md](B_LEVEL_MULTIPLAYER_EVAL.md) — 5/5 評估
- [MULTIPLAYER_FINAL_SUMMARY.md](MULTIPLAYER_FINAL_SUMMARY.md) — 整體完工總結
