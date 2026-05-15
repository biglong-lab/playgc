// 📊 MiniTimeline — 迷你連線時間軸（P1-8、從 AdminMultiSessions 抽出 / 2026-05-16）
//
// 抽檔原因：降低 AdminMultiSessions.tsx 主檔行數、純展示元件
// 對應計畫：docs/changes/2026-05-14-platform-optimization-comprehensive.md (C)

export interface TimelineEvent {
  userId: string | null;
  eventType: string;
  timestamp: string | null;
}

export function MiniTimeline({
  events,
  windowMinutes,
}: {
  events: TimelineEvent[];
  windowMinutes: number;
}) {
  if (events.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground/60 italic">
        過去 {windowMinutes} 分鐘無連線事件
      </div>
    );
  }

  // 30 格、每格代表 windowMinutes/30 分鐘
  const BUCKETS = 30;
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const bucketMs = windowMs / BUCKETS;

  // 計算每格事件
  const buckets: Array<{ connect: number; close: number; grace: number; error: number }> = [];
  for (let i = 0; i < BUCKETS; i++) {
    buckets.push({ connect: 0, close: 0, grace: 0, error: 0 });
  }
  for (const e of events) {
    if (!e.timestamp) continue;
    const t = new Date(e.timestamp).getTime();
    const ago = now - t;
    if (ago > windowMs || ago < 0) continue;
    const bucketIdx = Math.min(BUCKETS - 1, Math.floor((windowMs - ago) / bucketMs));
    if (e.eventType === "connect" || e.eventType === "reconnect") buckets[bucketIdx].connect += 1;
    else if (e.eventType === "close" || e.eventType === "auto_leave" || e.eventType === "kick") buckets[bucketIdx].close += 1;
    else if (e.eventType === "grace_start" || e.eventType === "grace_expired") buckets[bucketIdx].grace += 1;
    else if (e.eventType === "error") buckets[bucketIdx].error += 1;
  }

  return (
    <div>
      <div className="text-[10px] text-muted-foreground mb-1">
        過去 {windowMinutes} 分鐘連線事件（{events.length} 筆）
      </div>
      <div className="flex gap-px h-6 items-end">
        {buckets.map((b, i) => {
          const total = b.connect + b.close + b.grace + b.error;
          if (total === 0) {
            return (
              <div
                key={i}
                className="flex-1 bg-muted/30 rounded-sm"
                style={{ minHeight: "4px" }}
              />
            );
          }
          // 主導事件決定顏色
          const dominant = b.error > 0
            ? "bg-red-500"
            : b.close > 0
            ? "bg-orange-500"
            : b.grace > 0
            ? "bg-amber-400"
            : "bg-emerald-500";
          const height = Math.min(24, 4 + total * 2);
          return (
            <div
              key={i}
              className={`flex-1 ${dominant} rounded-sm`}
              style={{ height: `${height}px` }}
              title={`${i * (windowMinutes * 60 / BUCKETS)}s 前: connect=${b.connect}, close=${b.close}, grace=${b.grace}, error=${b.error}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-[9px] text-muted-foreground/70 mt-1">
        <span>{windowMinutes} 分前</span>
        <div className="flex-1" />
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-emerald-500 rounded-sm" />
          connect
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-amber-400 rounded-sm" />
          grace
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-orange-500 rounded-sm" />
          close
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-sm" />
          error
        </span>
        <div className="flex-1" />
        <span>現在</span>
      </div>
    </div>
  );
}
