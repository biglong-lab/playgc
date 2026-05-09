# 多人斷線根因 + 團體合照隊長鎖 — 2026-05-10

> 範圍：WebSocketContext config_change 根因修 / PhotoTeam 隊長鎖 / Trivia 補拉 state / reconnect 加速
> 狀態：✅ 完成、tsc 0 / smoke 51/51 / ADR-0018 通過、本地 commit、待業主授權部署
> 歷史脈絡：[Phase 0-4 完整重構](2026-05-08-phase-4-complete.md) + [v2 audit §12 R9](2026-05-08-multi-stability-audit-v2.md#12-補充討論r9-timing-詳細評估2026-05-08-增)

---

## 1. 業主回報

> 「未修復多人遊戲，容易斷線，組隊成功但一進入開始遊戲就會分別斷線，或是進度不同步，對講機也是容易進入遊戲隊友就離線。」
>
> 「未修復團體合照功能要設計成只有隊長能使用鏡頭來拍攝，其他隊員不能使用鏡頭，這個部分已經處理過很多次。」

Phase 0-4 全套架構重構已上生產（commit `b7524c4c`），業主仍回報「未修復」 → 真實環境有殘留問題、需要靠生產觀測找根因。

---

## 2. 找到根因 — `config_change` 67% 比例

### 2.1 SSH 撈生產 ws_event_log 統計（過去 7 天）

```
event_type    count
broadcast     89
close         76
connect       76
message       76
grace_start   59  (78% of connect)
grace_expired 43  (73% of grace_start)
auto_leave    34  (45% of connect)
kick          3
```

### 2.2 close.reason 分佈

```
config_change  51  (67%)  ← Provider 自己關
（空白）        22  (29%)  ← 真實 abnormal close
left_team      3   (4%)
```

### 2.3 完整因果鏈（樣本 timeline）

```
15:21:09.673  close (config_change)        ← Provider 主動關 ws
15:21:10.457  message (team_join)          ← 0.78 秒後新 ws team_join 到 server
15:21:14.677  grace_start (4.2 秒後)        ← server 仍進 grace 流程！
15:21:44.698  grace_expired (30 秒後)
15:23:44.688  auto_leave (120 秒後)         ← 玩家被誤踢出 team
```

### 2.4 結論

`WebSocketContext.tsx` acquire() 偵測到 `alsoJoinSessionId` 變動 → `oldWs.close(1000, "config_change")` → 50ms 後重連。但 server 端的 race（close handler 與新 ws team_join 處理順序）導致 cancel 失敗、grace timer 仍跑。

**典型場景**：玩家從 TeamLobby 進 game page → `alsoJoinSessionId` 變動 → ws 被 Provider 關掉 → server 進 grace → 30 秒後 expired → 120 秒後 auto_leave → 隊友看到「對方離線」+ 玩家被踢出 team。

→ **這就是業主回報的「組隊成功一進入遊戲就分別斷線」**。

---

## 3. 修法

### 3.1 WebSocketContext.tsx — 不必要 close 修除

```ts
// 舊：alsoJoinSessionId 變動就 close ws + 50ms 重連
const sameUser = current && /* 含 alsoJoinSessionId */;
if (!sameUser) {
  oldWs.close(1000, "config_change");
  setTimeout(connect, 50);
}

// 新：只 alsoJoinSessionId 變動 → 保留 ws + send 新 join 訊息
const onlySessionChanged = current &&
  current.teamId === config.teamId &&
  current.userId === config.userId &&
  current.userName === config.userName &&
  current.alsoJoinSessionId !== config.alsoJoinSessionId;

if (onlySessionChanged) {
  ws.send(JSON.stringify({ type: "join", sessionId: ..., userId, userName }));
  return;  // 不關 ws
}

// 真的要切 user/team 才 close（罕見）
oldWs.close(1000, "user_change");
```

### 3.2 WebSocketContext.tsx — reconnect 首次加速

```ts
// 舊：首次 reconnect 等 800-1200ms（base=1000 + jitter ±20%）
// 新：首次 200ms（接近立即）、之後 exp backoff 防 spam
const computeBackoff = (attempts: number): number => {
  if (attempts === 0) return 200; // 首次 200ms
  const base = 500;
  const ms = Math.min(base * Math.pow(2, attempts - 1), 30_000);
  ...
};
```

→ 即使真的有 abnormal close、200ms 內就 ws 重連回來、server 5 秒 buffer 內 cancel grace timer。

### 3.3 PhotoTeamGather.tsx — 隊長鎖（業主新需求）

```ts
const isLeader = !!user && !!myTeam?.leaderId && myTeam.leaderId === user.id;
const hasLeader = !!myTeam?.leaderId;

// 非隊長：等待頁、不開鏡頭、訂 ws 等隊長拍完跳 done
if (hasLeader && !isLeader) {
  return (
    <div data-testid="photo-gather-waiting-leader">
      <Loader2 className="animate-spin" />
      <p>等待隊長 {leaderDisplayName} 拍照</p>
      <p>相機只開放給隊長使用</p>
      <Button onClick={handleContinue}>先跳過此題</Button>
    </div>
  );
}
// 隊長 / 無 leaderId（向後兼容）→ 原本拍照 UI
```

**核心保證**：
- 隊長正常拍照、其他人即時收到 `photo_gather_updated` ws 廣播 → 自動跳 done
- 非隊長**完全沒有相機 UI**、只能等
- `leaderId === null`（舊資料）保留任何人能拍的舊行為（向後兼容）

### 3.4 PhotoTeamFlow.tsx — collage 強制改 gather

```ts
// 舊：captureMode='collage' → PhotoTeamCollage（逐位拍 N 張）
// 新：永遠走 PhotoTeamGather（含隊長鎖）
if (props.config.teamConfig?.captureMode === "collage") {
  console.warn("captureMode='collage' 已 deprecated、自動走 gather 模式");
}
return <PhotoTeamGather {...props} />;
```

PhotoTeamCollage 程式碼保留作向後兼容（未啟用、未來可評估刪除）。

### 3.5 TriviaShowdownPage.tsx — reconnect 補拉 state

Phase 4 §6 已知限制：玩家 reconnect 後沒立即補拉、依賴下次 broadcast。中途加入或長時間沒人答題 → state 一直 null。

```ts
const wsApi = useWebSocket();
const [hydratedState, setHydratedState] = useState(null);

useEffect(() => {
  if (!sessionId || !wsApi.isConnected) return;
  fetch(`/api/trivia/${sessionId}/state`)
    .then(r => r.ok ? r.json() : null)
    .then(data => data?.state && setHydratedState(data.state));
}, [sessionId, wsApi.isConnected]);

const effectiveState = state ?? hydratedState; // ws 廣播優先
```

---

## 4. 變動檔案

| 檔案 | 行數變化 | 用途 |
|------|----------|------|
| `client/src/contexts/WebSocketContext.tsx` | +35 / -8 | config_change 根因修 + reconnect 加速 |
| `client/src/components/game/multi/PhotoTeamGather.tsx` | +50 / -1 | 隊長鎖 |
| `client/src/components/game/multi/PhotoTeamFlow.tsx` | +8 / -10 | collage 強制 gather |
| `client/src/components/game/host/TriviaShowdownPage.tsx` | +25 / -3 | reconnect 補拉 state |

---

## 5. 驗收

| 項目 | 結果 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `node scripts/smoke-test-scenarios.mjs` | ✅ 51/51 全綠 |
| `bash scripts/check-ws-singleton.sh` | ✅ ADR-0018 通過 |
| 既有 60 元件相容 | ✅ 不變動 hook 介面 |
| 部署可逆性 | 100%（純 client 改動、git revert 即可恢復）|

---

## 6. 預期改善（部署後驗證）

### 6.1 量化指標（看 admin/multi-sessions 7 天前後對比）

| 指標 | 改前（生產 7 天）| 改後預期 |
|------|------------------|---------|
| close.reason='config_change' 比例 | 67% | < 5% |
| grace_start / connect 比例 | 78% | < 30% |
| grace_expired / grace_start | 73% | < 30% |
| auto_leave / connect | 45% | < 10% |

### 6.2 業主可感受變化

- ❌ 「組隊成功一進入遊戲就分別斷線」 → ✅ 進場不斷線
- ❌ 「對講機進入遊戲就離線」 → ✅ 對講機保持連線
- ❌ 「進度不同步」 → ✅ Trivia 補拉確保中途加入也有狀態
- ✅ 隊長合照鎖：非隊長看「等待隊長」、無法開鏡頭

---

## 7. 部署提示

### 必要動作

```bash
ssh root@172.233.89.147
cd /www/wwwroot/game.homi.cc
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build app
```

### 部署後驗證（必做）

1. 進 admin 開 multi 遊戲、玩家從 lobby 進場：
   - 進 `/admin/multi-sessions` 看：玩家 ws 連線是否保持、不該觸發 grace
2. 業主湊 5 人實機 + 進 admin/multi-sessions 即時觀察：
   - 隊伍裡 connect:close 比例應大幅下降
   - grace_start 數量應大幅下降
3. 測試合照題：
   - 隊長進去看到「開始拍照」按鈕
   - 非隊長進去看到「等待隊長 [name] 拍照」、無相機按鈕
   - 隊長拍完、非隊長畫面自動跳到合照完成頁
4. 進 `/admin/sessions/:id/replay` 看 ws_event_log 確認 config_change 不再大量出現

### 回滾預案

```bash
# 純 client 改、無 schema 變動、無 server 行為改變
git log --oneline | head -8   # 看本次 8 個 auto-commit
git revert <commit>...<commit>  # 一次 revert 全部
git push origin main
docker compose up -d --build app
```

---

## 8. 已知限制與後續優化

### 8.1 未做（評估後不做）
- WS timing .env 調整（grace 30s/auto-leave 120s）：根因修完應大幅降低 grace 觸發率、先看實機效果再決定
- ChatPanel reconnect 補漏訊：Phase 2 已合併 Provider、reconnect 後 onConnect 自動重發 chat_join；補漏訊複雜度高、先觀察是否仍有問題
- Phase 5 例外整合（ShootingMissionPage / use-match-websocket）：不在主路徑、暫不動

### 8.2 待後續觀察決定
- 部署後 1 週看 admin/multi-sessions 數據、若 grace 觸發率仍 > 30% → 進一步調 server timing 或 reconnect 邏輯
- 業主實機實測「實際感受」是否改善

---

## 9. 相關文件

- [Phase 4 完成（Phase 0-4 整套）](2026-05-08-phase-4-complete.md)
- [v2 audit + R9 timing 討論](2026-05-08-multi-stability-audit-v2.md)
- [ADR-0018 全域單例 WS](../decisions/0018-realtime-architecture.md)
- [拍照元件盤點](2026-05-07-camera-audit.md)

---

**END Multi Leader & Stability Fix — 2026-05-10**
