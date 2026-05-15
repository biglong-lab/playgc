// 💎 TreasureHunt — 藏寶圖協作元件（W4 D2，S 級）
//
// 玩法：
//   - admin 設定 N 個線索（每個有題目 + 答案）
//   - 玩家看得到全部線索題目
//   - 答對線索 → 該線索 unlocked，顯示對應字（拼出最終密碼）
//   - 全部線索 unlocked → 大寶藏揭曉
//
// pageType: treasure_hunt（multi 軸線）
// 適用：景點探秘、團隊解謎、企業內訓尋寶

import { useState, useMemo } from "react";
import { motion } from "framer-motion";

export interface TreasureClue {
  id: string;
  prompt: string;       // 線索題目
  answer: string;       // 正確答案（不分大小寫、忽略空白）
  reward?: string;      // 解開後給玩家看的字（拼最終密碼用）
  hint?: string;        // 額外提示
}

export interface TreasureHuntConfig {
  title?: string;
  subtitle?: string;
  clues?: TreasureClue[];
  /** 全解開後顯示的最終訊息 */
  finalReward?: string;
}

interface TreasureState {
  unlockedClueIds: string[];  // 已解鎖的線索 id
}

export interface TreasureHuntProps {
  config: TreasureHuntConfig;
  state: TreasureState | null;
  onUnlockClue: (clueId: string) => void;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

export default function TreasureHunt({ config, state, onUnlockClue }: TreasureHuntProps) {
  const clues = config.clues ?? [];
  const unlocked = state?.unlockedClueIds ?? [];

  const [activeClueId, setActiveClueId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAllUnlocked = useMemo(() => {
    return clues.length > 0 && clues.every((c) => unlocked.includes(c.id));
  }, [clues, unlocked]);

  const activeClue = clues.find((c) => c.id === activeClueId);

  const handleSubmit = () => {
    if (!activeClue) return;
    if (normalize(input) === normalize(activeClue.answer)) {
      onUnlockClue(activeClue.id);
      setActiveClueId(null);
      setInput("");
      setError(null);
    } else {
      setError("再想想看 🤔");
    }
  };

  // 全部解鎖 → 揭曉
  if (isAllUnlocked) {
    return (
      <div className="w-full max-w-xl mx-auto p-4 space-y-4">
        <div className="text-center space-y-3 py-8">
          <div className="text-7xl">🎉</div>
          <h2 className="text-3xl font-display font-bold">寶藏揭曉！</h2>
          <p className="text-sm text-muted-foreground">全隊解開了 {clues.length} 個線索</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/40 dark:to-orange-950/40 rounded-xl p-6 text-center border-2 border-yellow-300 dark:border-yellow-700">
          <p className="text-xl md:text-2xl font-bold whitespace-pre-line">
            {config.finalReward ?? "🏆 恭喜全隊完成尋寶！"}
          </p>
        </div>
        <div className="space-y-2 mt-4">
          <p className="text-xs text-muted-foreground text-center">解開的字</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {clues.map((c) => (
              <span
                key={c.id}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-full text-sm"
              >
                {c.reward ?? c.answer}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 點線索進入答題模式
  if (activeClue) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-md mx-auto p-4 space-y-4"
        role="region"
        aria-label="多人尋寶任務"
      >
        <div className="text-center space-y-2">
          <h2 className="text-lg font-bold">📝 線索：{activeClue.prompt}</h2>
          {activeClue.hint && (
            <p className="text-xs text-muted-foreground">💡 {activeClue.hint}</p>
          )}
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          placeholder="輸入答案"
          className="w-full px-3 py-3 rounded-lg border bg-background text-center text-lg"
          autoFocus
          data-testid="input-treasure-answer"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveClueId(null);
              setInput("");
              setError(null);
            }}
            className="flex-1 py-3 rounded-lg border font-medium hover:bg-muted"
            data-testid="btn-cancel-clue"
          >
            返回
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
            data-testid="btn-submit-answer"
          >
            提交
          </button>
        </div>
      </div>
    );
  }

  // 主視圖：線索列表
  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-display font-bold">{config.title ?? "💎 藏寶尋找"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
        <div className="text-xs text-muted-foreground">
          進度：<span className="font-bold text-primary">{unlocked.length}</span> / {clues.length}
        </div>
      </div>

      <div className="space-y-2">
        {clues.map((c, i) => {
          const isUnlocked = unlocked.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                if (!isUnlocked) setActiveClueId(c.id);
              }}
              disabled={isUnlocked}
              className={`w-full p-4 rounded-xl border text-left transition-all ${
                isUnlocked
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 cursor-default"
                  : "border-border hover:border-primary/40 active:scale-[0.98]"
              }`}
              data-testid={`btn-clue-${c.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">線索 {i + 1}</p>
                  <p className="font-medium">{c.prompt}</p>
                  {isUnlocked && (
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                      ✅ 已解開：{c.reward ?? c.answer}
                    </p>
                  )}
                </div>
                <div className="text-2xl shrink-0">{isUnlocked ? "🔓" : "🔒"}</div>
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
