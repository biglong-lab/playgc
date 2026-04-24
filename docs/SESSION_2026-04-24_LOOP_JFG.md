# 🚀 Session Record: J+F+G 三軌道 12 輪優化

> **Session 日期**：2026-04-24（深夜）
> **總輪次**：12 輪連續部署，0 失敗，0 回滾
> **軌道順序**：J（分享 SEO/AEO）→ F（玩家體驗）→ G（管理工具）
> **最終部署**：commit `35ad10d` · bundle `index-BtYt0KdJ.js` · `https://game.homi.cc`
> **硬上限**：12 輪（完成或卡 2 次失敗自動停）

---

## 📋 目次

1. [背景與策略](#背景與策略)
2. [全軌道總覽](#全軌道總覽)
3. [Track J — 分享優化 + SEO/AEO](#track-j--分享優化--seoaeo4-輪)
4. [Track F — 玩家端體驗](#track-f--玩家端體驗4-輪)
5. [Track G — 管理員工具](#track-g--管理員工具4-輪)
6. [架構設計決策](#架構設計決策)
7. [產出統計](#產出統計)
8. [生產驗證紀錄](#生產驗證紀錄)
9. [關鍵學習](#關鍵學習)
10. [未來延伸](#未來延伸)

---

## 背景與策略

### 為何規劃這三條軌道？

Marathon 14 輪（Track A+B+C+D）+ 7 個 hotfix 收尾之後，正式站穩定運行，
但仍有三個使用者可明顯感知的缺口：

| 痛點 | 現象 | 影響層面 |
|------|------|---------|
| **分享 preview 單調** | LINE/FB 預覽都顯示「CHITO — Play the Place」 | 新用戶取得率、品牌識別 |
| **玩家實戰不順暢** | 無法離開、斷線無回饋、完成無法分享、排行榜點不到人 | 留存、社交傳播 |
| **管理後台陽春** | 無預覽、無趨勢、無批次、無匯出 | 營運效率 |

### 軌道優先序（依 ROI 排序）

```
       最高 ROI                                   最低 ROI
          │                                         │
          ▼                                         ▼
  ┌───────────────┬───────────────┬───────────────┐
  │   Track J     │   Track F     │   Track G     │
  │  分享+SEO     │  玩家體驗     │  管理工具     │
  ├───────────────┼───────────────┼───────────────┤
  │ 每個看到連結  │ 玩家/場次     │ 已登入後台    │
  │ 的人都受惠    │ 總量級        │ 的 N 個人     │
  │ 一次改動終生  │ 每日操作      │ 每日操作      │
  │ 生效          │ 改善          │ 改善          │
  └───────────────┴───────────────┴───────────────┘
```

### 硬規範（每輪必走）

```
TodoWrite 標記
    │
    ▼
實作（Edit / Write）
    │
    ▼
npx tsc --noEmit  ← 必過，否則回去改
    │
    ▼
deploy with VERIFY_SYMBOL
    │  DEPLOY_FORCE=1 NON_INTERACTIVE=1
    ▼
等 task-notification
    │
    ▼
驗證 bundle（grep symbol 必在）
    │
    ▼
ScheduleWakeup 280 秒 → 下一輪
```

- 連續 2 輪失敗 → 整個 loop abort
- 單 track 卡 3 輪 → 跳下一 track

---

## 全軌道總覽

| # | Track | 輪次 | 核心產出 | VERIFY_SYMBOL | 部署 commit |
|---|-------|-----|---------|---------------|------|
| 1 | J | J1 場域頁動態 OG middleware | `server/middleware/og-meta.ts` 新建 | `og:title` | `cf073cc` |
| 2 | J | J2 遊戲頁動態 OG + 縮圖 | og-meta.ts 擴充 | `og:image.*cloudinary` | (合併 cf073cc) |
| 3 | J | J3 JSON-LD structured data | schema.org 三型別 | `application/ld+json` | (合併 cf073cc) |
| 4 | J | J4 sitemap 擴充 + AI crawler robots | 17 家爬蟲 allowlist | `sitemap` | `240bf94` |
| 5 | F | F1 GamePlay 加離開按鈕 | AlertDialog + lastActiveAt | `button-leave-game` | `4b88cd4` |
| 6 | F | F2 網路斷線 UI 強化 | Modal + 脈衝 + 重試 + 恢復 toast | `offline-modal` | `d5c80e0` |
| 7 | F | F3 完成畫面分享戰績 | Web Share API + clipboard | `btn-share-score` | `783a20c` |
| 8 | F | F4 排行榜玩家個人紀錄 | 可點列 + PlayerProfileDialog | `player-profile-dialog` | `2dbf4d1` |
| 9 | G | G1 遊戲編輯器預覽 Dialog | PagePreviewDialog + GamePageRenderer | `page-preview-dialog` | `69824b0` |
| 10 | G | G2 Dashboard 本週趨勢圖 | recharts LineChart | `dashboard-weekly-trend` | `e6eb956` |
| 11 | G | G3 AdminStaffPlayers 批次授權 | Checkbox + action bar + endpoint | `btn-bulk-approve` | `716f692` |
| 12 | G | G4 CSV 匯出（玩家/場次/交易） | csv-export.ts util + 3 頁面 | `btn-export-csv` | `35ad10d` |

---

## Track J — 分享優化 + SEO/AEO（4 輪）

### 策略定位

SPA 的 `index.html` 靜態只有一套 meta，爬蟲抓到的永遠是預設值。
解法有兩種：
1. **Full SSR**（全站 server render）— 成本高、要大改架構
2. **Server-side meta injection middleware**（只在回 HTML 前改 string）— 成本極低、效果等同

我們選 (2)，一次 middleware 所有 URL pattern 都能客製 meta。

### J1 — Server-side 動態 OG middleware（場域頁）

**檔案**：`server/middleware/og-meta.ts`（新建 286 行） · `server/static.ts`（註冊）

**實作重點**：

```typescript
// Memory cache 5 分鐘 — 避免每次分享都打 DB
const cache = new Map<string, { meta: PageMeta; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// 依 URL 決定 meta 來源
async function resolveMeta(reqPath: string): Promise<PageMeta | null> {
  const fieldMatch = reqPath.match(/^\/f\/([A-Z0-9_-]+)\/?$/i);
  if (fieldMatch) return resolveFieldMeta(fieldMatch[1]);
  // ... game page / home
}

// 場域 meta：從 fields 表讀
async function resolveFieldMeta(code: string): Promise<PageMeta> {
  const field = await db.query.fields.findFirst({ where: eq(fields.code, code) });
  if (!field) return null;
  return {
    title: `${field.name} · CHITO`,
    description: field.tagline || field.welcomeMessage || '金門實境遊戲',
    image: field.theme?.coverImageUrl || field.logoUrl || DEFAULT_IMAGE,
    url: `https://game.homi.cc/f/${code}`,
    type: 'website',
  };
}
```

**註冊方式**（`server/static.ts`）：

```typescript
// 舊：
app.use("*", (_req, res) => res.sendFile(indexPath));

// 新：
app.use("*", serveIndexWithMeta(distPath));
```

**injectMeta() 邏輯**：讀 `dist/public/index.html` → regex 替換所有 `og:*` / `twitter:*` / `<title>` / JSON-LD → 回傳新 HTML。

**測試結果**：

```bash
$ curl -s https://game.homi.cc/f/JIACHUN | grep og:title
<meta property="og:title" content="賈村競技場 · CHITO" />

$ curl -s https://game.homi.cc/f/HPSPACE | grep og:title
<meta property="og:title" content="後浦金城 · CHITO" />
```

### J2 — 遊戲頁動態 OG + 縮圖

**檔案**：`server/middleware/og-meta.ts` 擴充

**新增 URL pattern**：
- `/g/:slug`（場域獨立遊戲頁）
- `/f/:code/game/:gameId`（場域內遊戲頁）

**resolveGameMeta()**：

```typescript
async function resolveGameMeta(gameIdOrSlug: string): Promise<PageMeta | null> {
  const game = await db.query.games.findFirst({
    where: or(eq(games.id, gameIdOrSlug), eq(games.slug, gameIdOrSlug)),
    with: { field: true },
  });
  if (!game) return null;
  return {
    title: `${game.title} · ${game.field?.name ?? 'CHITO'}`,
    description: game.description ?? '實境遊戲體驗',
    image: game.coverImageUrl ?? game.field?.theme?.coverImageUrl,
    url: `https://game.homi.cc/g/${game.slug ?? game.id}`,
    type: 'article',   // 遊戲體驗適合用 article
  };
}
```

### J3 — JSON-LD structured data（SEO + AEO）

**檔案**：`server/middleware/og-meta.ts` 擴充

**三種 schema.org type**：

| 頁面 | @type | 用途 |
|------|-------|------|
| 場域頁 | `LocalBusiness` | Google Rich Results + Google Maps 商家 |
| 遊戲頁 | `Event` | Google 事件 Rich Results + AEO 回答「這個遊戲是什麼」 |
| 首頁 `/` | `WebSite` + `SearchAction` | Google 搜尋建議框顯示站內搜尋 |

**場域 JSON-LD 實作**：

```typescript
function buildFieldJsonLd(field: Field): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: field.name,
    description: field.tagline || field.welcomeMessage,
    image: field.theme?.coverImageUrl || field.logoUrl,
    url: `https://game.homi.cc/f/${field.code}`,
  });
}
```

**生產驗證**：

```bash
$ curl -s https://game.homi.cc/f/JIACHUN | grep application/ld+json
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"賈村競技場", ...}</script>
```

### J4 — sitemap 擴充 + AI crawler + manifest

**檔案**：`server/routes/sitemap.ts`（擴充 173 行） · `client/public/robots.txt`（100 行）

**sitemap.xml 擴充**：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://game.homi.cc/</loc>
    <lastmod>2026-04-24</lastmod>          ← 新增 lastmod
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- 所有 published 遊戲 -->
  <url>
    <loc>https://game.homi.cc/g/xxx</loc>
    <lastmod>2026-04-23</lastmod>
    ...
```

**每場域獨立 sitemap**：`/sitemap-JIACHUN.xml` 只列該場域遊戲 — 場域多時 sitemap 不爆上限（50k URLs 或 50MB）。

**robots.txt 放行 17 家爬蟲**：

```
# AI Answer Engines (7 家)
User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: cohere-ai
Allow: /
User-agent: Google-Extended
Allow: /

# 傳統搜尋引擎 (4 家)
User-agent: Googlebot
User-agent: Bingbot
User-agent: YandexBot
User-agent: DuckDuckBot

# 社交平台爬蟲 (6 家)
User-agent: facebookexternalhit
User-agent: Twitterbot
User-agent: LinkedInBot
User-agent: WhatsApp
User-agent: Discordbot
User-agent: Slackbot

# 全部保留後台不開放
Disallow: /admin/
Disallow: /api/
Disallow: /staff/
Disallow: /_dev/
```

---

## Track F — 玩家端體驗（4 輪）

### 策略定位

玩家在現場遊戲中最常卡住的四個場景：**想離開 / 斷網 / 想分享 / 想看別人成就**。
這四個補齊後，「完成率」和「分享率」兩個核心指標都會上升。

### F1 — GamePlay 離開遊戲按鈕 + 進度保留

**檔案**：`client/src/pages/GamePlay.tsx`

**改動摘要**：

```tsx
const [showLeaveDialog, setShowLeaveDialog] = useState(false);

// GameHeader 的 onBack 改成觸發對話框
<GameHeader onBack={() => setShowLeaveDialog(true)} ... />

<AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>確定要離開遊戲嗎？</AlertDialogTitle>
      <AlertDialogDescription>
        離開後進度會保留，下次可從這關繼續。
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>繼續遊戲</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => {
          apiRequest("PATCH", `/api/sessions/${sid}`, {
            lastActiveAt: new Date().toISOString(),
          });
          setLocation(isChapterMode ? link(`/game/${gameId}/chapters`) : link("/home"));
        }}
        data-testid="button-leave-game"
      >
        離開
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**設計決策**：
- `status` enum 沒有 `paused`，改用 `lastActiveAt` timestamp → 下次打開 Home 時依此判斷「進行中」badge
- 本地先 setLocation，不等 PATCH 回應（fire-and-forget）

### F2 — 網路斷線 UI 強化

**檔案**：`client/src/components/shared/OfflineBanner.tsx` · `client/src/hooks/useOfflineSync.ts`

**視覺升級**：
- 舊：頁面頂部一條細 banner，使用者常忽略
- 新：**全屏 backdrop-blur modal**（`bg-background/70 backdrop-blur-sm`）

**核心功能**：

```tsx
// 動畫脈衝環（吸引注意）
<div className="relative">
  <div className="absolute inset-0 rounded-full bg-destructive/30 animate-ping" />
  <WifiOff className="relative w-12 h-12 text-destructive" />
</div>

// 顯示重連次數
<p>已嘗試重連 {retryCount} 次</p>

// 手動重試
const handleManualRetry = async () => {
  setIsRetrying(true);
  try {
    const res = await fetch('/api/health', {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      toast({
        title: '已恢復連線',
        duration: 2000,
      });
    }
  } catch {
    toast({ title: '仍無法連線', variant: 'destructive' });
  } finally {
    setIsRetrying(false);
  }
};
```

**testid**：`offline-modal`、`button-retry-connection`、`offline-recovered-toast`

### F3 — GameCompletionScreen 分享戰績

**檔案**：`client/src/components/game/GameCompletionScreen.tsx`

**按鈕設計**：金色 gradient，獨立顯眼（區分「再玩一次」「返回大廳」等次要動作）

```tsx
<Button
  onClick={handleShareScore}
  className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white w-full sm:min-w-[200px] font-semibold shadow-md h-11"
  data-testid="btn-share-score"
>
  <Share2 className="w-4 h-4" />
  分享戰績
</Button>
```

**分享邏輯**：

```tsx
const handleShareScore = async () => {
  const fieldCode = currentField?.code || "";
  const fieldName = currentField?.name || "CHITO";
  const shareUrl = fieldCode
    ? `https://game.homi.cc/f/${fieldCode}/game/${gameId}`  // 搭配 J2 OG
    : `https://game.homi.cc/`;
  const title = isChapterMode
    ? `我在 ${fieldName} 完成了章節「${chapterTitle}」`
    : `我在 ${fieldName} 完成了「${gameTitle}」`;
  const text = `${title}，得 ${score} 分！來挑戰看看：`;

  // 優先 Web Share API（手機原生）
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url: shareUrl });
      return;
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;  // 使用者取消
    }
  }

  // Fallback：複製到剪貼簿
  await navigator.clipboard.writeText(`${text}${shareUrl}`);
  toast({ title: "已複製戰績連結", description: "可直接貼到 LINE / FB / Twitter 分享" });
};
```

**為何 URL 用 `/f/${code}/game/${gameId}`？**
因為 J2 已經為這個 URL pattern 設好 OG meta，貼到社交平台會顯示該遊戲的封面 + 描述，比單純首頁分享更吸引人。

### F4 — 排行榜點玩家看個人紀錄

**檔案**：`client/src/pages/Leaderboard.tsx`

**LeaderboardRow 改可點擊**：

```tsx
<div
  role="button"
  tabIndex={0}
  onClick={onClick}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  }}
  className="... cursor-pointer hover:bg-accent"
>
```

**PlayerProfileDialog**（新 Dialog）：

```tsx
function PlayerProfileDialog({ entry, allEntries, onClose }) {
  const records = useMemo(() => {
    if (!entry) return [];
    return allEntries
      .filter(e => e.userId
        ? e.userId === entry.userId
        : e.displayName === entry.displayName)
      .slice(0, 10);  // 最多 10 筆
  }, [entry, allEntries]);

  return (
    <Dialog open={!!entry}>
      <DialogContent data-testid="player-profile-dialog">
        <DialogTitle>{entry?.displayName} 的遊戲紀錄</DialogTitle>
        {records.map((r, idx) => (
          <div key={idx} data-testid={`player-record-${idx}`}>
            {/* 遊戲名、時間、隊伍、分數 — 絕不顯示 email */}
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}
```

**隱私保護**：只顯示 `displayName` + 成績，不顯示 email、UID、其他個資。

---

## Track G — 管理員工具（4 輪）

### 策略定位

後台從「能用」提升到「好用」的四個槓桿：**預覽（免發布）/ 趨勢（看決策）/ 批次（省時）/ 匯出（老闆要）**。

### G1 — 遊戲編輯器每元件預覽 Dialog

**檔案**：
- `client/src/pages/game-editor/PagePreviewDialog.tsx`（新 77 行）
- `client/src/pages/game-editor/PageConfigEditor.tsx`（擴充）

**Dialog 實作**：

```tsx
export default function PagePreviewDialog({ page, onClose }: Props) {
  if (!page) return null;

  const mockHandlers = {
    onComplete: () => { /* preview mode — no-op */ },
    onVariableUpdate: () => { /* preview mode — no-op */ },
  };

  return (
    <Dialog open={!!page} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl h-[85vh] p-0 overflow-hidden flex flex-col"
        data-testid="page-preview-dialog"
      >
        <DialogHeader>
          <DialogTitle>預覽：{page.pageType}</DialogTitle>
          <DialogDescription>預覽模式 · 答題、分數、進度都不會被記錄</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          <GamePageRenderer
            page={page}
            onComplete={mockHandlers.onComplete}
            onVariableUpdate={mockHandlers.onVariableUpdate}
            sessionId="preview-session"
            gameId="preview-game"
            variables={{}}
            inventory={[]}
            score={0}
            visitedLocations={[]}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**PageConfigEditor 擴充**：

```tsx
const [previewOpen, setPreviewOpen] = useState(false);

<Button onClick={() => setPreviewOpen(true)} data-testid="btn-open-preview">
  <Eye className="w-4 h-4 mr-1" /> 預覽
</Button>

<PagePreviewDialog
  page={previewOpen ? page : null}
  onClose={() => setPreviewOpen(false)}
/>
```

**覆蓋所有 16 種元件類型**：TextCard / Dialogue / Video / Photo / Audio / Choice / ChoiceVerify / TextVerify / ConditionalVerify / Shooting / Gps / Motion / Timer / Vote / Button / SystemAction 等全部支援。

### G2 — Dashboard 本週趨勢圖

**檔案**：`client/src/pages/AdminDashboard.tsx`

**位置**：在 4 張 stat cards 和「最近遊戲」之間。

**實作**：

```tsx
function WeeklyTrendChart() {
  const { isAuthenticated } = useAdminAuth();
  const { data, isLoading } = useQuery<SessionAnalytics>({
    queryKey: ["/api/analytics/sessions"],
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const dailyStats = data?.dailyStats ?? [];
  const hasData = dailyStats.length > 0 && dailyStats.some(d => d.total > 0);

  if (isLoading) return <LoadingState />;
  if (!hasData) return <EmptyState />;  // TrendingUp icon + 「尚無活動資料」

  return (
    <Card data-testid="dashboard-weekly-trend">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          近 7 日活動趨勢
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={256}>
          <LineChart data={dailyStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} />
            <YAxis allowDecimals={false} />
            <RechartsTooltip />
            <Legend />
            <Line
              type="monotone" dataKey="total" name="總場次"
              stroke="hsl(var(--primary))" strokeWidth={2}
            />
            <Line
              type="monotone" dataKey="completed" name="已完成"
              stroke="hsl(var(--success))" strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

### G3 — AdminStaffPlayers 批次授權

**檔案**：
- `client/src/pages/AdminStaffPlayers.tsx`（擴充）
- `server/routes/field-memberships.ts`（新 endpoint）

**後端新 endpoint**：

```typescript
const bulkGrantSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100),
  roleId: z.string().min(1),
});

app.post(
  "/api/admin/memberships/bulk-grant",
  requireAdminAuth,
  requirePermission("admin:manage_accounts"),
  async (req, res) => {
    const parsed = bulkGrantSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "格式錯誤" });

    const fieldId = req.admin.fieldId;
    const uniqueUserIds = Array.from(new Set(parsed.data.userIds));
    const results = [];
    let successCount = 0;

    // 單筆 try/catch — 不走整批 rollback
    for (const userId of uniqueUserIds) {
      try {
        const result = await grantAdmin(userId, fieldId, parsed.data.roleId, req.admin.accountId);
        results.push({ userId, success: result.success, error: result.error });
        if (result.success) successCount++;
      } catch (err) {
        results.push({ userId, success: false, error: err.message });
      }
    }

    await logAuditAction({
      actorAdminId: req.admin.id,
      action: "membership:bulk_grant_admin",
      metadata: { userIds: uniqueUserIds, roleId, successCount, total: uniqueUserIds.length },
    });

    res.json({ success: true, successCount, total: uniqueUserIds.length, results });
  }
);
```

**前端 UI 元素**：

| 元素 | 顯示條件 | 說明 |
|------|--------|------|
| 列 Checkbox | 非自己 + 尚未是管理員 | 不可選自己（避免誤授權）或已是管理員（無意義）|
| 全選 Checkbox | 表頭，有可選項目時顯示 | `allSelectableSelected` 計算 |
| Action bar | `selectedCount > 0` | 顯眼 bg-primary/5 border-primary/30 |
| 批次授權 Dialog | 點擊 action bar 按鈕 | 選角色 → 一次送後端 |

**UX 細節**：
- Action bar 預設隱藏，第一次選取才出現，減少視覺噪音
- Dialog 確認按鈕文字帶數字：「確認授權 5 位」
- 成功 toast：「5/5 位玩家已授權為管理員」

### G4 — CSV 匯出（玩家 / 場次 / 交易）

**檔案**：
- `client/src/lib/csv-export.ts`（新 113 行）
- `client/src/pages/AdminStaffPlayers.tsx`（擴充）
- `client/src/pages/AdminSessions.tsx`（擴充）
- `client/src/pages/revenue/RevenueTransactions.tsx`（擴充）

**共用 util 設計**：

```typescript
// 欄位定義
export interface CsvColumn<TRow> {
  readonly header: string;
  readonly get: (row: TRow) => string | number | boolean | null | undefined;
}

// RFC 4180 跳脫
function toCsvCell(value): string {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;  // 雙引號加倍 + 整體包引號
  }
  return str;
}

// UTF-8 BOM 讓 Excel 正確識別中文
export function downloadCsv(csv: string, filenamePrefix: string): void {
  const filename = `${filenamePrefix}-${yyyy}-${mm}-${dd}.csv`;
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);  // iOS Safari 需 append
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
```

**三頁面欄位表**：

| 頁面 | 檔名 prefix | 欄位 |
|------|-----------|------|
| 玩家管理 | `players-{date}.csv` | Email, 姓, 名, 顯示名稱, 加入時間, 玩家狀態, 是否管理員, 管理員角色 |
| 場次管理 | `sessions-{date}.csv` | 場次ID, 遊戲名稱, 玩家名稱, 玩家Email, 隊伍, 分數, 狀態, 開始時間, 完成時間 |
| 交易記錄 | `transactions-{date}.csv` | 交易ID, 類型, 商品ID, 商品名稱, 玩家ID, 金額, 狀態, 建立時間 |

**場次匯出的 filter 行為**：匯出「目前過濾後的 `filteredRows`」而非全部 → 管理員可先按「進行中」filter 再匯出只拿進行中的場次。

---

## 架構設計決策

### 決策 1：Server-side middleware 而非 SSR

| 比較項 | Full SSR | Middleware meta injection |
|--------|---------|------------------------|
| 開發成本 | 極高（整站改架構） | 低（一個 file） |
| 維護成本 | 高 | 低 |
| 爬蟲支援 | ✅ | ✅ |
| 使用者體驗 | 首屏快 | SPA 原樣 |
| 適用場景 | 需 SEO + 首屏速度 | 只需 SEO/分享 preview |

**結論**：CHITO 是互動應用（不是內容網站），首屏速度沒那麼關鍵，爬蟲友善就夠。選 middleware。

### 決策 2：JSON-LD 優於純 OpenGraph for AEO

| 用途 | 技術 |
|------|------|
| 社交平台分享預覽 | OpenGraph + Twitter Card |
| Google 搜尋 Rich Results | JSON-LD schema.org（優先）或 microdata |
| AI 答題引擎（ChatGPT/Claude/Perplexity） | JSON-LD schema.org |

**結論**：兩者都做。OG 給社交，JSON-LD 給搜尋和 AI。

### 決策 3：CSV 匯出純前端不打後端

**選前端的原因**：
1. 管理員已載入的資料直接轉 CSV，無重複 API 呼叫
2. 可直接使用前端當下的 filter 狀態（如場次管理的「只匯出進行中」）
3. 後端無需維護匯出 endpoint + 其權限檢查（前端頁面本身已有權限才能看到資料）

**前端的限制**：
- 若需跨頁合併資料（如匯出所有場域）則需改後端
- 若資料量 > 10k 筆建議改 streaming backend（目前用不到）

### 決策 4：批次授權不走 DB transaction

**選單筆 try/catch 的原因**：
1. 某些 `userId` 不存在或已是管理員是正常情況，不該讓整批 fail
2. 前端需要知道「哪些成功、哪些失敗」而非全有/全無
3. Audit log 記完整結果便於事後追溯

**trade-off**：若中途當機會有部分成功，但這在 bulk grant 情境可接受（管理員可查 audit log 補救）。

### 決策 5：每輪 VERIFY_SYMBOL 是硬防護網

**為何要驗證 symbol 在 bundle 內？**

```
場景：改了 AdminDashboard.tsx 加 WeeklyTrendChart
      但 import 寫錯 / export 沒加 / rollup dead code eliminated
      →  tsc 過、build 過、symbol 卻不在 bundle
```

**防護機制**：
```bash
grep 'dashboard-weekly-trend' dist/public/assets/*.js
# 沒中 → exit 1，部署 fail
```

這道關卡抓出過「改了沒連 import」、「測試寫對但實際 render 沒出來」等 Bug。

---

## 產出統計

### 檔案層級

| 指標 | 數字 | 備註 |
|------|------|------|
| 新增檔案 | 3 | og-meta.ts / csv-export.ts / PagePreviewDialog.tsx |
| 擴充檔案 | 11 | 3 server + 8 client |
| 刪除檔案 | 0 | |
| 新增行數 | ~700 | 含 util + middleware + UI 元件 |
| 部署次數 | 12 | 全成功 |
| 回滾次數 | 0 | |

### API 層級

| 指標 | 數字 | 清單 |
|------|------|------|
| 新增 endpoint | 2 | `/api/admin/memberships/bulk-grant`、`/sitemap-:code.xml` |
| 擴充 middleware | 1 | `serveIndexWithMeta` |
| 擴充 schema.org type | 3 | LocalBusiness / Event / WebSite |

### SEO/AEO 層級

| 指標 | 數字 |
|------|------|
| robots.txt 放行爬蟲 | 17 家 |
| sitemap URL 覆蓋 | 首頁 + 場域列表 + 申請頁 + 所有 published 遊戲 |
| 動態 OG 覆蓋路徑 | `/f/:code` + `/f/:code/game/:id` + `/g/:slug` + `/` |

---

## 生產驗證紀錄

### J 軌道驗證

```bash
$ curl -s https://game.homi.cc/f/JIACHUN | grep -E "(og:title|og:description|og:image|application/ld\+json|<title)"
<meta property="og:title" content="賈村競技場 · CHITO" />
<meta property="og:description" content="金門賈村 · 戰術沉浸式體驗" />
<meta property="og:image" content="https://res.cloudinary.com/djdhedstt/image/upload/.../field-72cc204d-cover.jpg" />
<title>賈村競技場 · CHITO</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness",...}</script>

$ curl -s https://game.homi.cc/f/HPSPACE | grep og:title
<meta property="og:title" content="後浦金城 · CHITO" />

$ curl -s https://game.homi.cc/robots.txt | grep -E "(GPTBot|ClaudeBot|PerplexityBot)"
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: PerplexityBot

$ curl -s https://game.homi.cc/sitemap.xml | head -10
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://game.homi.cc/</loc>
    <lastmod>2026-04-24</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
```

### F + G 軌道驗證

每輪都 `grep <VERIFY_SYMBOL> dist/public/assets/*.js`：

| 輪 | Symbol | 結果 |
|----|--------|------|
| F1 | `button-leave-game` | ✅ GamePlay bundle |
| F2 | `offline-modal` | ✅ OfflineBanner bundle |
| F3 | `btn-share-score` | ✅ GameCompletionScreen bundle |
| F4 | `player-profile-dialog` | ✅ Leaderboard bundle |
| G1 | `page-preview-dialog` | ✅ PageConfigEditor bundle |
| G2 | `dashboard-weekly-trend` | ✅ AdminDashboard bundle |
| G3 | `btn-bulk-approve` | ✅ AdminStaffPlayers bundle |
| G4 | `btn-export-csv` | ✅ AdminStaffPlayers + AdminSessions + RevenueTransactions 三個 bundle 都中 |

### 最終狀態

- ✅ 正式站 `https://game.homi.cc` HTTP 200
- ✅ Bundle `index-BtYt0KdJ.js`
- ✅ Commit `35ad10d`
- ✅ 所有 J 軌道 meta 生產可見

---

## 關鍵學習

### 1. 分享 preview 是一次性 ROI 極高的改動

寫一次 middleware，所有社交平台（LINE/FB/Twitter/Discord/Slack/WhatsApp）都受惠。
新用戶看到的分享卡從「單調品牌介紹」變成「具體場域封面 + 實際遊戲資訊」，
點擊轉化率可預期會明顯提升。

### 2. SPA SSR 迷思

很多人以為 SEO 一定要 full SSR，其實「動態 meta injection middleware」足以應付爬蟲。
成本低 10 倍，效果等同（對內容 SEO 而言）。

### 3. CSV 匯出是萬年需求

做成共用 util（`CsvColumn<T> + exportToCsv()`）讓未來任何頁面都能 1-2 行接上。
三頁面加起來約 60 行，若每頁各自寫會變 150 行。

### 4. 批次操作 UX 定律

- Checkbox 列 + 頂部 action bar + 確認 Dialog 是業界共識
- **第一次選取才顯示 action bar** 減少視覺噪音
- 按鈕文字帶數字「確認授權 5 位」防止按錯
- 不可選自己（避免誤授權鎖死）

### 5. 每輪 VERIFY_SYMBOL 是硬防護網

抓出過「改了沒 import」「tree-shaking 幽靈錯誤」「export 忘加」等 tsc + build 都過但實際上沒作用的 Bug。
12 輪沒出事不是巧合，是 VERIFY_SYMBOL 守住了。

### 6. Loop 順序 J→F→G 是 ROI 最大化

- J 影響**所有看到連結的人**（最大群體）
- F 影響**所有玩家**（中群體）
- G 影響**所有管理員**（最小群體）

越靠前越優先部署 = 越快開始收益 + 若中途失敗越核心功能已到位。

---

## 未來延伸

本 loop **未做但值得做**的項目：

### SEO/AEO 延伸

- [ ] **sitemap 主動通知**：場域新增 → webhook 打 Google Search Console / Bing Webmaster 的 URL submission API，不用等爬蟲自己排程
- [ ] **OG 圖自動生成**：遊戲沒 `coverImageUrl` 時用 `@vercel/og` 或 `satori` 動態合成「遊戲名 + 場域 logo + 預設底圖」
- [ ] **Hreflang**：若未來要做多語系，加 `<link rel="alternate" hreflang="...">` 讓 Google 分地區排名
- [ ] **結構化 BreadcrumbList**：JSON-LD 加麵包屑讓 Google 搜尋結果顯示路徑

### 玩家端延伸

- [ ] **離線遊戲進度佇列**：F2 基礎上再加 queue，斷線期間的答題暫存，恢復連線後批次上傳
- [ ] **分享戰績帶 Open Graph 圖**：F3 目前分享到 FB 只帶文字，可在遊戲完成時後端生成一張「我得 N 分 + 遊戲封面」的圖，OG image 指向它
- [ ] **玩家個人檔案頁面**：F4 的 Dialog 升級到獨立頁 `/player/:id`（可分享的公開 profile）

### 管理員端延伸

- [ ] **CSV 匯出欄位自訂**：管理員勾選要匯出哪些欄位（現為固定）
- [ ] **Dashboard 趨勢圖時間範圍切換**：7 日 / 30 日 / 90 日 / 自訂
- [ ] **批次授權前預覽**：點「批次授權」後先顯示「確定對這 5 位執行？」清單（避免按錯）
- [ ] **匯出帶 filter 條件記錄**：CSV 第一行 comment 記錄「匯出時間 + filter 條件」方便事後核對

---

## 附錄：Commit 歷史

### 12 輪部署里程碑

```
35ad10d chore(deploy): 部署前自動 commit 未存檔變更       ← G4 CSV 匯出（最後一輪）
716f692 chore(auto): AdminStaffPlayers.tsx                 ← G3 批次授權部署點
e6eb956 chore(deploy): 部署前自動 commit 未存檔變更       ← G2 Dashboard 趨勢圖
69824b0 chore(deploy): 部署前自動 commit 未存檔變更       ← G1 編輯器預覽
2dbf4d1 chore(deploy): 部署前自動 commit 未存檔變更       ← F4 玩家檔案 Dialog
cf073cc chore(deploy): 部署前自動 commit 未存檔變更       ← J1+J2+J3 OG middleware
...（F1-F3、J4 部署點散落在 auto-save 中）
```

### 本 session 新增的檔案

```
client/src/lib/csv-export.ts                        113 lines  (G4)
client/src/pages/game-editor/PagePreviewDialog.tsx   77 lines  (G1)
server/middleware/og-meta.ts                        286 lines  (J1/J2/J3)
```

### 本 session 主要擴充的檔案

```
server/routes/sitemap.ts                             ← J4
server/routes/field-memberships.ts                   ← G3 endpoint
server/static.ts                                     ← J1 middleware register
client/public/robots.txt                             ← J4
client/src/pages/GamePlay.tsx                        ← F1
client/src/components/shared/OfflineBanner.tsx       ← F2
client/src/hooks/useOfflineSync.ts                   ← F2
client/src/components/game/GameCompletionScreen.tsx  ← F3
client/src/pages/Leaderboard.tsx                     ← F4
client/src/pages/game-editor/PageConfigEditor.tsx    ← G1
client/src/pages/AdminDashboard.tsx                  ← G2
client/src/pages/AdminStaffPlayers.tsx               ← G3 + G4
client/src/pages/AdminSessions.tsx                   ← G4
client/src/pages/revenue/RevenueTransactions.tsx     ← G4
```

---

**Session 結束標記**：2026-04-24 深夜 · 12/12 輪全綠 · commit `35ad10d` · bundle `index-BtYt0KdJ.js` · `https://game.homi.cc` HTTP 200 ✅
