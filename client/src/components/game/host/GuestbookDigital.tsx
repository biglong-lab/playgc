// 📺 GuestbookDigital — 數位簽名簿元件（Phase 2 W5 D2，紀念類）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// pageType: host_guestbook_digital
//
// 玩法：
//   - 玩家：簽名 + 寫祝福語 + 自動簽日期
//   - 大螢幕：書頁瀏覽所有簽名（手寫風 + 水彩底紙）
//   - 適用：婚禮、開幕、退休歡送、企業里程碑
//
// 跟 PolaroidCollage 差異：
//   - GuestbookDigital 強調「文字 + 簽名」（正式紀念）
//   - PolaroidCollage 強調「視覺 + emoji」（活潑紀念）

import { useState, useCallback, useMemo } from "react";

interface GuestbookEntry {
  id: string;
  name: string;
  message: string;
  ts: number;
}

export interface GuestbookDigitalConfig {
  title?: string;
  subtitle?: string;
  /** 大螢幕保留筆數上限（預設 200）*/
  maxEntries?: number;
}

interface GuestbookDigitalState {
  entries: GuestbookEntry[];
}

export interface GuestbookDigitalProps {
  config: GuestbookDigitalConfig;
  hostMode: boolean;
  state?: GuestbookDigitalState | null;
  myUserName?: string;
  onPulse?: (pulseType: string, payload: { name: string; message: string }) => void;
  onBroadcastState?: (state: GuestbookDigitalState) => void;
}

const PAGE_BG_COLORS = [
  "#fffbf0", // 米白
  "#f0f9ff", // 淡藍
  "#fdf4ff", // 淡紫
  "#f0fdf4", // 淡綠
  "#fef2f2", // 淡紅
];

function buildInitialState(): GuestbookDigitalState {
  return { entries: [] };
}

function bgForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PAGE_BG_COLORS[Math.abs(h) % PAGE_BG_COLORS.length];
}

export default function GuestbookDigital({ config, hostMode, state, myUserName, onPulse }: GuestbookDigitalProps) {
  const effectiveState = state ?? buildInitialState();
  const entries = effectiveState.entries;

  const [name, setName] = useState(myUserName ?? "");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // hostMode：分頁瀏覽
  const [currentPage, setCurrentPage] = useState(0);
  const ENTRIES_PER_PAGE = 6;
  const totalPages = Math.max(1, Math.ceil(entries.length / ENTRIES_PER_PAGE));
  const sortedEntries = useMemo(() => [...entries].reverse(), [entries]);
  const visibleEntries = sortedEntries.slice(
    currentPage * ENTRIES_PER_PAGE,
    (currentPage + 1) * ENTRIES_PER_PAGE,
  );

  const handleSubmit = useCallback(() => {
    if (!name.trim() || !message.trim()) return;
    onPulse?.("sign", {
      name: name.trim().slice(0, 30),
      message: message.trim().slice(0, 200),
    });
    setSubmitted(true);
  }, [name, message, onPulse]);

  // ─── 大螢幕版型 ───
  if (hostMode) {
    return (
      <div className="w-full h-full min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 dark:from-zinc-900 dark:to-black p-6 md:p-10">
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold mb-2 text-zinc-900 dark:text-white">
            {config.title ?? "📖 簽名簿"}
          </h1>
          {config.subtitle && (
            <p className="text-base md:text-xl text-zinc-600 dark:text-zinc-400">{config.subtitle}</p>
          )}
          <p className="text-sm text-zinc-500 mt-2">
            <span className="font-bold text-primary text-2xl">{entries.length}</span> 位來賓留言
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-20 text-zinc-500 text-xl dark:text-zinc-400">
            等待第一位來賓...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
              {visibleEntries.map((e) => (
                <div
                  key={e.id}
                  className="rounded-lg p-4 shadow-md border border-amber-200 dark:border-zinc-700"
                  style={{ backgroundColor: bgForId(e.id) }}
                >
                  <p className="text-base md:text-lg leading-relaxed text-zinc-800 italic min-h-[60px] whitespace-pre-line line-clamp-4">
                    「{e.message}」
                  </p>
                  <div className="mt-3 pt-3 border-t border-amber-200/50 flex items-center justify-between text-sm">
                    <span className="font-bold text-zinc-700">— {e.name}</span>
                    <span className="text-xs text-zinc-500">
                      {new Date(e.ts).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 分頁 */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 mt-8 text-zinc-700 dark:text-zinc-300">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="px-4 py-2 rounded-lg bg-white/60 dark:bg-zinc-800 disabled:opacity-30"
                >
                  ←
                </button>
                <span className="text-sm">
                  第 {currentPage + 1} / {totalPages} 頁
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="px-4 py-2 rounded-lg bg-white/60 dark:bg-zinc-800 disabled:opacity-30"
                >
                  →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ─── 玩家版型 ───
  if (submitted) {
    return (
      <div className="w-full p-4 max-w-md mx-auto space-y-4">
        <div className="text-center space-y-3 py-8">
          <div className="text-7xl">📖</div>
          <h2 className="text-2xl font-bold">已留下祝福</h2>
          <p className="text-sm text-muted-foreground">
            你的簽名已經印在簽名簿上 💕
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setMessage("");
          }}
          className="w-full py-3 rounded-lg border font-medium hover:bg-muted text-sm"
          data-testid="btn-sign-another"
        >
          再簽一頁
        </button>
      </div>
    );
  }

  return (
    <div className="w-full p-4 max-w-md mx-auto space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">{config.title ?? "📖 留言簿"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium">你的名字 *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 30))}
          placeholder="請輸入名字"
          className="w-full mt-1 px-3 py-2 rounded-lg border bg-background"
          maxLength={30}
          data-testid="input-guestbook-name"
        />
      </div>

      <div>
        <label className="text-sm font-medium">祝福語 / 留言 *</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 200))}
          placeholder="留下你的祝福（最多 200 字）"
          rows={5}
          className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
          maxLength={200}
          data-testid="input-guestbook-message"
        />
        <p className="text-xs text-right text-muted-foreground mt-1">
          {message.length}/200
        </p>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!name.trim() || !message.trim()}
        className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:bg-primary/90 active:scale-95 transition-all"
        data-testid="btn-submit-guestbook"
      >
        ✍️ 簽上你的祝福
      </button>
    </div>
  );
}
