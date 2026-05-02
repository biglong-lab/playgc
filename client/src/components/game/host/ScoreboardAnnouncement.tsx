// 📺 ScoreboardAnnouncement — 跑馬燈宣告元件（W5 D4，S 級）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// pageType: host_scoreboard_announcement
//
// 玩法：
//   - admin 從大螢幕端送公告（type: score/info/celebrate）
//   - 大螢幕：頂部跑馬燈（最近 5 則）+ 中間大字（最新一則）
//   - 玩家：唯讀列表（最近 N 則）
//   - 適用：比賽插播得分、活動通知、現場廣播
//
// state 結構：
//   {
//     announcements: { id, text, type, ts }[];
//   }
//
// pulse: { type: "announce", payload: { text, type } }（玩家送也可，admin 設定 acceptPlayerPulse）
// host 端可主動 broadcastState（從元件內表單）

import { useState, useEffect, useCallback, useMemo } from "react";

type AnnounceType = "score" | "info" | "celebrate";

interface AnnouncementEntry {
  id: string;
  text: string;
  type: AnnounceType;
  ts: number;
}

export interface ScoreboardAnnouncementConfig {
  title?: string;
  subtitle?: string;
  /** 大螢幕保留筆數上限（預設 50）*/
  maxEntries?: number;
  /** 大螢幕當前 announcement 顯示時長（毫秒，預設 8000）*/
  displayDurationMs?: number;
}

interface ScoreboardAnnouncementState {
  announcements: AnnouncementEntry[];
}

export interface ScoreboardAnnouncementProps {
  config: ScoreboardAnnouncementConfig;
  hostMode: boolean;
  state?: ScoreboardAnnouncementState | null;
  onPulse?: (pulseType: string, payload: { text: string; type: AnnounceType }) => void;
  onBroadcastState?: (state: ScoreboardAnnouncementState) => void;
}

const TYPE_STYLES: Record<AnnounceType, { bg: string; emoji: string; label: string }> = {
  score: { bg: "from-blue-500 to-cyan-500", emoji: "🏆", label: "得分" },
  info: { bg: "from-zinc-600 to-zinc-500", emoji: "📣", label: "通知" },
  celebrate: { bg: "from-yellow-500 to-orange-500", emoji: "🎉", label: "慶祝" },
};

function buildInitialState(): ScoreboardAnnouncementState {
  return { announcements: [] };
}

export default function ScoreboardAnnouncement({ config, hostMode, state, onBroadcastState }: ScoreboardAnnouncementProps) {
  const effectiveState = state ?? buildInitialState();
  const announcements = effectiveState.announcements;
  const displayDurationMs = config.displayDurationMs ?? 8000;

  // 大螢幕當前顯示哪個 announcement（最新一則、自動消失）
  const [currentIdx, setCurrentIdx] = useState(0);
  const latest = useMemo(() => [...announcements].reverse()[0], [announcements]);

  useEffect(() => {
    if (!hostMode || !latest) return;
    setCurrentIdx(0);
    const id = setTimeout(() => setCurrentIdx(-1), displayDurationMs);
    return () => clearTimeout(id);
  }, [hostMode, latest?.id, displayDurationMs, latest]);

  // hostMode admin 表單 state
  const [text, setText] = useState("");
  const [type, setType] = useState<AnnounceType>("info");

  const handleAdd = useCallback(() => {
    if (!text.trim() || !onBroadcastState) return;
    const newEntry: AnnouncementEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: text.trim().slice(0, 100),
      type,
      ts: Date.now(),
    };
    const newAnnouncements = [...announcements, newEntry].slice(-(config.maxEntries ?? 50));
    onBroadcastState({ announcements: newAnnouncements });
    setText("");
  }, [text, type, announcements, config.maxEntries, onBroadcastState]);

  // ─── 大螢幕版型 ───
  if (hostMode) {
    const recent = [...announcements].slice(-5).reverse();
    const showLatest = currentIdx === 0 && latest;

    return (
      <div className="w-full h-full min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white flex flex-col">
        {/* 頂部跑馬燈 */}
        <div className="bg-zinc-900/80 border-b border-zinc-800 py-3 overflow-hidden">
          {recent.length === 0 ? (
            <p className="text-center text-zinc-500 text-sm">等待第一則宣告...</p>
          ) : (
            <div className="flex gap-8 animate-marquee whitespace-nowrap">
              {[...recent, ...recent].map((a, i) => {
                const style = TYPE_STYLES[a.type];
                return (
                  <span key={`${a.id}-${i}`} className="inline-flex items-center gap-2 text-lg">
                    <span>{style.emoji}</span>
                    <span>{a.text}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* 中間：當前 announcement 大字 */}
        <div className="flex-1 flex items-center justify-center p-8">
          {showLatest ? (
            <div
              className={`max-w-4xl w-full p-12 rounded-3xl bg-gradient-to-br ${TYPE_STYLES[latest.type].bg} text-white text-center shadow-2xl animate-in zoom-in fade-in duration-500`}
            >
              <div className="text-8xl mb-4">{TYPE_STYLES[latest.type].emoji}</div>
              <p className="text-3xl md:text-5xl lg:text-6xl font-display font-bold leading-tight whitespace-pre-line">
                {latest.text}
              </p>
            </div>
          ) : (
            <div className="text-center text-zinc-500 max-w-md">
              <h1 className="text-3xl md:text-5xl font-display font-bold mb-2">
                {config.title ?? "📣 活動公告"}
              </h1>
              {config.subtitle && <p className="text-base md:text-xl text-zinc-400">{config.subtitle}</p>}
            </div>
          )}
        </div>

        {/* 主控表單（admin 在大螢幕邊操作 — 簡化版可看見、正式版隱藏在 admin panel）*/}
        <div className="bg-zinc-900/80 border-t border-zinc-800 p-4">
          <div className="max-w-3xl mx-auto flex gap-2 items-center">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AnnounceType)}
              className="px-2 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm"
              data-testid="select-announce-type"
            >
              <option value="info">📣 通知</option>
              <option value="score">🏆 得分</option>
              <option value="celebrate">🎉 慶祝</option>
            </select>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 100))}
              placeholder="輸入要播報的訊息（100 字內）"
              className="flex-1 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm"
              maxLength={100}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              data-testid="input-announce-text"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!text.trim()}
              className="px-4 py-2 rounded bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50"
              data-testid="btn-add-announce"
            >
              播報
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── 玩家版型 ───
  const recent = [...announcements].slice(-20).reverse();
  return (
    <div className="w-full p-4 max-w-md mx-auto space-y-3">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">{config.title ?? "📣 活動公告"}</h2>
        {config.subtitle && <p className="text-sm text-muted-foreground">{config.subtitle}</p>}
      </div>

      {recent.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          等待主辦方公告...
        </div>
      ) : (
        <div className="space-y-2">
          {recent.map((a) => {
            const style = TYPE_STYLES[a.type];
            return (
              <div
                key={a.id}
                className="rounded-lg border p-3 bg-card"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{style.emoji}</span>
                  <span className="text-xs text-muted-foreground">
                    {style.label} · {new Date(a.ts).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm mt-1 whitespace-pre-line">{a.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
