// 🗺️ KnowledgeMap — 場域全景地圖元件（W5 D5，M 級）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// pageType: host_knowledge_map
//
// 玩法：
//   - 大螢幕呈現一張場域全景圖（POI 點散布）
//   - 玩家從手機選擇地圖上的 POI 進行打卡 + 留言
//   - 大螢幕熱力化：每個 POI 依造訪人數變色（冷 → 熱）
//   - 大螢幕底部跑最近 N 則打卡留言
//   - 適用：街區商圈、景點串聯、空間活化、企業園區導覽
//
// state 結構：
//   {
//     visits: { id, pointId, name, message?, ts }[];
//   }
//
// pulse: { type: "visit", payload: { pointId, name, message? } }
//
// HostScreen 軸線收尾元件（10/10）

import { useMemo, useState } from "react";

interface KnowledgePoint {
  id: string;
  name: string;
  /** 0-100 百分比座標 */
  x: number;
  y: number;
  emoji?: string;
  description?: string;
}

interface VisitEntry {
  id: string;
  pointId: string;
  name: string;
  message?: string;
  ts: number;
}

export interface KnowledgeMapConfig {
  title?: string;
  subtitle?: string;
  /** 場域全景背景圖（URL）— 可選，未提供則用漸層底 */
  backgroundUrl?: string;
  points?: KnowledgePoint[];
  /** 玩家是否可以留訊息（預設 true）*/
  allowMessage?: boolean;
  /** 大螢幕底部跑馬燈顯示筆數（預設 8）*/
  marqueeLimit?: number;
  /** state.visits 保留上限（預設 200）*/
  maxVisits?: number;
}

interface KnowledgeMapState {
  visits: VisitEntry[];
}

export interface KnowledgeMapProps {
  config: KnowledgeMapConfig;
  hostMode: boolean;
  myUserName?: string;
  state?: KnowledgeMapState | null;
  onPulse?: (
    pulseType: string,
    payload: { pointId: string; name: string; message?: string },
  ) => void;
}

const DEFAULT_POINTS: KnowledgePoint[] = [
  { id: "p1", name: "後浦老街", x: 25, y: 35, emoji: "🏛️", description: "歷史巷弄" },
  { id: "p2", name: "莒光樓", x: 60, y: 25, emoji: "🏯", description: "戰地地標" },
  { id: "p3", name: "翟山坑道", x: 75, y: 60, emoji: "🪖", description: "地下軍事" },
  { id: "p4", name: "金門酒廠", x: 40, y: 70, emoji: "🍶", description: "高粱故鄉" },
  { id: "p5", name: "水頭聚落", x: 15, y: 75, emoji: "🏘️", description: "古厝群" },
];

function buildInitialState(): KnowledgeMapState {
  return { visits: [] };
}

/** 依造訪人數對應顏色（0 → 冷、≥10 → 熱）*/
function getHeatStyle(count: number): { bg: string; ring: string; scale: number } {
  if (count === 0) return { bg: "bg-zinc-600", ring: "ring-zinc-500/60", scale: 1 };
  if (count < 3) return { bg: "bg-blue-500", ring: "ring-blue-400/70", scale: 1.05 };
  if (count < 6) return { bg: "bg-emerald-500", ring: "ring-emerald-400/70", scale: 1.1 };
  if (count < 10) return { bg: "bg-amber-500", ring: "ring-amber-400/70", scale: 1.15 };
  return { bg: "bg-red-500", ring: "ring-red-400/80", scale: 1.2 };
}

export default function KnowledgeMap({
  config,
  hostMode,
  myUserName,
  state,
  onPulse,
}: KnowledgeMapProps) {
  const effectiveState = state ?? buildInitialState();
  const visits = effectiveState.visits;
  const points = config.points && config.points.length > 0 ? config.points : DEFAULT_POINTS;
  const allowMessage = config.allowMessage ?? true;
  const marqueeLimit = config.marqueeLimit ?? 8;

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of visits) {
      map.set(v.pointId, (map.get(v.pointId) ?? 0) + 1);
    }
    return map;
  }, [visits]);

  const totalVisits = visits.length;
  const totalUniquePlayers = useMemo(
    () => new Set(visits.map((v) => v.name)).size,
    [visits],
  );

  // ─── 大螢幕版型 ───
  if (hostMode) {
    const recentVisits = [...visits].slice(-marqueeLimit).reverse();

    return (
      <div className="w-full h-full min-h-screen bg-gradient-to-b from-emerald-950 via-zinc-900 to-black text-white flex flex-col">
        {/* 頂部標題 + 統計 */}
        <div className="border-b border-zinc-800 bg-zinc-950/60 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold">
              {config.title ?? "🗺️ 場域全景地圖"}
            </h1>
            {config.subtitle && (
              <p className="text-sm text-zinc-400 mt-1">{config.subtitle}</p>
            )}
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <div className="text-3xl font-bold text-emerald-400" data-testid="text-total-visits">
                {totalVisits}
              </div>
              <div className="text-xs text-zinc-500">總打卡</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-amber-400">
                {totalUniquePlayers}
              </div>
              <div className="text-xs text-zinc-500">參與者</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-cyan-400">{points.length}</div>
              <div className="text-xs text-zinc-500">地標</div>
            </div>
          </div>
        </div>

        {/* 中間地圖 */}
        <div className="flex-1 relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={
              config.backgroundUrl
                ? {
                    backgroundImage: `url(${config.backgroundUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: "brightness(0.55)",
                  }
                : {
                    background:
                      "radial-gradient(ellipse at 50% 40%, rgba(16, 185, 129, 0.15), transparent 70%), radial-gradient(ellipse at 80% 80%, rgba(59, 130, 246, 0.15), transparent 70%)",
                  }
            }
          />

          {/* 網格輔助線 */}
          <svg className="absolute inset-0 w-full h-full opacity-10" aria-hidden="true">
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* POI markers */}
          {points.map((p) => {
            const count = counts.get(p.id) ?? 0;
            const heat = getHeatStyle(count);
            return (
              <div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                data-testid={`map-point-${p.id}`}
              >
                {/* 漣漪 — 有人造訪時 */}
                {count > 0 && (
                  <span
                    className={`absolute inset-0 rounded-full ${heat.bg} opacity-30 animate-ping`}
                    style={{ width: 56, height: 56, marginLeft: -28, marginTop: -28 }}
                  />
                )}
                {/* marker 主體 */}
                <div
                  className={`relative rounded-full ${heat.bg} ${heat.ring} ring-4 shadow-2xl flex items-center justify-center transition-all`}
                  style={{
                    width: 56 * heat.scale,
                    height: 56 * heat.scale,
                  }}
                >
                  <span className="text-2xl">{p.emoji ?? "📍"}</span>
                  {count > 0 && (
                    <span className="absolute -top-2 -right-2 bg-white text-zinc-900 text-xs font-bold rounded-full min-w-6 h-6 px-1.5 flex items-center justify-center shadow">
                      {count}
                    </span>
                  )}
                </div>
                {/* 名稱 */}
                <div className="text-center mt-2 text-xs md:text-sm font-medium whitespace-nowrap drop-shadow-lg">
                  {p.name}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部跑馬燈：最近打卡 */}
        <div className="border-t border-zinc-800 bg-zinc-950/80 px-6 py-3">
          {recentVisits.length === 0 ? (
            <p className="text-center text-sm text-zinc-500">
              等待第一位玩家打卡...
            </p>
          ) : (
            <div className="flex gap-6 overflow-hidden">
              {recentVisits.map((v) => {
                const point = points.find((p) => p.id === v.pointId);
                return (
                  <div
                    key={v.id}
                    className="flex-shrink-0 inline-flex items-center gap-2 text-sm"
                    data-testid={`recent-visit-${v.id}`}
                  >
                    <span className="text-lg">{point?.emoji ?? "📍"}</span>
                    <span className="font-medium text-emerald-300">{v.name}</span>
                    <span className="text-zinc-500">@</span>
                    <span className="text-zinc-300">{point?.name ?? "未知"}</span>
                    {v.message && (
                      <span className="text-zinc-400 italic">「{v.message}」</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── 玩家版型 ───
  return (
    <PlayerView
      config={config}
      points={points}
      counts={counts}
      visits={visits}
      myUserName={myUserName}
      allowMessage={allowMessage}
      onPulse={onPulse}
    />
  );
}

interface PlayerViewProps {
  config: KnowledgeMapConfig;
  points: KnowledgePoint[];
  counts: Map<string, number>;
  visits: VisitEntry[];
  myUserName?: string;
  allowMessage: boolean;
  onPulse?: KnowledgeMapProps["onPulse"];
}

function PlayerView({
  config,
  points,
  counts,
  visits,
  myUserName,
  allowMessage,
  onPulse,
}: PlayerViewProps) {
  const [name, setName] = useState(myUserName ?? "");
  const [message, setMessage] = useState("");
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [submittedIds, setSubmittedIds] = useState<string[]>([]);

  const handleSubmit = (pointId: string) => {
    if (!onPulse) return;
    const trimmedName = name.trim().slice(0, 20);
    if (!trimmedName) return;
    onPulse("visit", {
      pointId,
      name: trimmedName,
      message: message.trim().slice(0, 80) || undefined,
    });
    setSubmittedIds([...submittedIds, pointId]);
    setSelectedPointId(null);
    setMessage("");
  };

  const myVisitCount = visits.filter((v) => v.name === (myUserName ?? name).trim()).length;

  return (
    <div className="w-full p-4 max-w-md mx-auto space-y-4">
      {/* 標頭 */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">{config.title ?? "🗺️ 場域地圖打卡"}</h2>
        {config.subtitle && (
          <p className="text-xs text-muted-foreground">{config.subtitle}</p>
        )}
        <p className="text-xs text-muted-foreground">
          已打卡 {myVisitCount} / {points.length} 個地標
        </p>
      </div>

      {/* 名字 input */}
      {!myUserName && (
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 20))}
          placeholder="你的名字（20 字內）"
          className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
          data-testid="input-knowledge-map-name"
        />
      )}

      {/* 地標列表 */}
      <div className="space-y-2">
        {points.map((p) => {
          const count = counts.get(p.id) ?? 0;
          const submitted = submittedIds.includes(p.id);
          const isSelected = selectedPointId === p.id;
          return (
            <div
              key={p.id}
              className={`rounded-lg border bg-card overflow-hidden transition-all ${
                isSelected ? "border-primary shadow-md" : ""
              } ${submitted ? "opacity-70" : ""}`}
              data-testid={`player-point-${p.id}`}
            >
              <button
                type="button"
                onClick={() =>
                  setSelectedPointId(isSelected ? null : p.id)
                }
                disabled={submitted}
                className="w-full flex items-center gap-3 p-3 text-left disabled:cursor-not-allowed"
              >
                <span className="text-2xl">{p.emoji ?? "📍"}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {p.description}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {submitted ? (
                    <span className="text-xs font-medium text-emerald-600">
                      ✅ 已打卡
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {count} 人到過
                    </span>
                  )}
                </div>
              </button>

              {/* 展開：留言 + 送出 */}
              {isSelected && !submitted && (
                <div className="border-t bg-muted/30 p-3 space-y-2">
                  {allowMessage && (
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 80))}
                      placeholder="留下一句話（可選，80 字內）"
                      className="w-full px-2 py-1.5 rounded border bg-background text-sm"
                      data-testid={`input-knowledge-map-message-${p.id}`}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleSubmit(p.id)}
                    disabled={!name.trim()}
                    className="w-full py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50"
                    data-testid={`btn-knowledge-map-checkin-${p.id}`}
                  >
                    📍 打卡
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        在大螢幕看見大家的足跡 ✨
      </p>
    </div>
  );
}

