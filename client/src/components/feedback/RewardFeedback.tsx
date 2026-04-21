// 🎉 通用獎勵反饋元件
//
// 用途：玩家完成任務/頁面後，統一呈現「發生了什麼」
//   - 加了多少分（點數飛入 + 總分躍動）
//   - 獲得什麼道具（道具卡片彈入）
//   - 解鎖什麼成就（徽章從下方上升）
//
// 不綁定任何頁面，任何元件 onComplete 時可呼叫 useRewardFeedback() 觸發。
// 使用 Zustand-like singleton pattern（簡單 store）讓多處共用。

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy, Package, Star, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

// ============================================================================
// Reward 事件 Store（簡易全域）
// ============================================================================

export interface RewardEvent {
  id: string;
  points?: number;
  items?: Array<{ name: string; iconUrl?: string }>;
  achievements?: Array<{ name: string; iconUrl?: string; rarity?: string }>;
  /** 自訂文案（若需覆寫預設） */
  title?: string;
  subtitle?: string;
}

type Listener = (event: RewardEvent) => void;
const listeners = new Set<Listener>();

/**
 * 觸發一次獎勵反饋（可在任何地方呼叫）
 */
export function fireReward(event: Omit<RewardEvent, "id">) {
  const full: RewardEvent = { ...event, id: `reward-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
  listeners.forEach((l) => l(full));
}

/**
 * 訂閱獎勵事件（給 RewardFeedbackOverlay 用）
 */
function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ============================================================================
// RewardFeedbackOverlay — 掛在 Layout 頂層，一次訂閱處理所有 reward 事件
// ============================================================================

export function RewardFeedbackOverlay() {
  const [current, setCurrent] = useState<RewardEvent | null>(null);
  const [queue, setQueue] = useState<RewardEvent[]>([]);

  useEffect(() => {
    return subscribe((event) => {
      setQueue((q) => [...q, event]);
    });
  }, []);

  // 有等待中且目前沒顯示 → 推下一個
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [current, queue]);

  const handleDismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  // 3 秒後自動收起
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(handleDismiss, 2800);
    return () => clearTimeout(t);
  }, [current, handleDismiss]);

  return (
    <AnimatePresence mode="wait">
      {current && <RewardCard key={current.id} event={current} onDismiss={handleDismiss} />}
    </AnimatePresence>
  );
}

// ============================================================================
// RewardCard — 單次事件卡片
// ============================================================================

function RewardCard({ event, onDismiss }: { event: RewardEvent; onDismiss: () => void }) {
  const hasPoints = event.points && event.points > 0;
  const hasItems = event.items && event.items.length > 0;
  const hasAchievements = event.achievements && event.achievements.length > 0;

  // 根據「最主要」獎勵決定主題色
  const theme = hasAchievements ? "amber" : hasItems ? "emerald" : "sky";
  const themeClasses = {
    amber: "from-amber-500/90 to-orange-500/90 border-amber-300",
    emerald: "from-emerald-500/90 to-teal-500/90 border-emerald-300",
    sky: "from-sky-500/90 to-indigo-500/90 border-sky-300",
  }[theme];

  return (
    <motion.div
      // 覆蓋層：中央偏上，不完全擋住畫面
      className="fixed inset-x-0 top-20 z-[100] pointer-events-none flex justify-center px-4"
      initial={{ opacity: 0, y: -30, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      onClick={onDismiss}
    >
      <motion.div
        className={`pointer-events-auto rounded-2xl bg-gradient-to-br ${themeClasses} text-white shadow-2xl border-2 px-5 py-4 max-w-md w-full backdrop-blur-sm`}
        whileHover={{ scale: 1.02 }}
      >
        {/* 標題 */}
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ rotate: -30, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.1, type: "spring" }}
          >
            <IconForEvent event={event} />
          </motion.div>
          <div className="flex-1">
            <div className="font-bold text-lg">
              {event.title || defaultTitle(event)}
            </div>
            {event.subtitle && (
              <div className="text-sm opacity-90">{event.subtitle}</div>
            )}
          </div>
        </div>

        {/* 點數 */}
        {hasPoints && (
          <motion.div
            className="mt-3 flex items-center gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Star className="w-5 h-5 fill-yellow-300 text-yellow-300" />
            <span className="text-2xl font-black tabular-nums">
              +{event.points}
            </span>
            <span className="text-sm opacity-80">點</span>
          </motion.div>
        )}

        {/* 道具 */}
        {hasItems && (
          <motion.div
            className="mt-3 flex flex-wrap gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {event.items!.map((item, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-1.5 bg-white/20 rounded-lg px-2.5 py-1 text-sm"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 + i * 0.08 }}
              >
                <Package className="w-4 h-4" />
                <span>{item.name}</span>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* 成就 */}
        {hasAchievements && (
          <motion.div
            className="mt-3 space-y-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {event.achievements!.map((ach, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-2 bg-white/25 rounded-lg px-3 py-1.5 text-sm font-medium"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 + i * 0.1 }}
              >
                <Trophy className="w-4 h-4 text-yellow-300" />
                <span>🏆 解鎖成就：</span>
                <span className="font-bold">{ach.name}</span>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* 閃爍裝飾 */}
        <Sparkle position="top-right" />
        <Sparkle position="bottom-left" delay={0.3} />
      </motion.div>
    </motion.div>
  );
}

function IconForEvent({ event }: { event: RewardEvent }): ReactNode {
  if (event.achievements && event.achievements.length > 0) {
    return <Trophy className="w-8 h-8 text-yellow-300" />;
  }
  if (event.items && event.items.length > 0) {
    return <Package className="w-8 h-8" />;
  }
  return <Star className="w-8 h-8 fill-yellow-300 text-yellow-300" />;
}

function defaultTitle(event: RewardEvent): string {
  if (event.achievements && event.achievements.length > 0) return "成就解鎖！";
  if (event.items && event.items.length > 0) return "獲得道具！";
  if (event.points && event.points > 0) return "獲得點數！";
  return "完成！";
}

function Sparkle({
  position,
  delay = 0,
}: {
  position: "top-right" | "bottom-left";
  delay?: number;
}) {
  const posClass =
    position === "top-right"
      ? "top-1 right-2"
      : "bottom-1 left-2";
  return (
    <motion.div
      className={`absolute ${posClass} text-white/70`}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0, 1.2, 0],
        rotate: [0, 180, 360],
      }}
      transition={{ duration: 1.5, delay, repeat: Infinity, repeatDelay: 1 }}
    >
      <Sparkles className="w-5 h-5" />
    </motion.div>
  );
}
