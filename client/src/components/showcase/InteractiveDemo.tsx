// 🎮 InteractiveDemo — 互動式 demo（2026-06-16）
//
// 左右並排「大螢幕(host) + 手機(player)」，在手機端操作 → 大螢幕即時反應。
// 用本地共用 state 模擬 WS（player onPulse → aggregate → setState → host 重繪），
// 不需建場、不需 WS，純前端讓使用者「玩看看、感受互動」。
//
// 複用各元件的真實聚合邏輯（與 *Page 容器的 handlePulse 一致）。

import { useState, useCallback } from "react";
import EmojiReact from "@/components/game/host/EmojiReact";
import WaveResponse from "@/components/game/host/WaveResponse";
import PollLive from "@/components/game/host/PollLive";
import CrowdGather from "@/components/game/host/CrowdGather";
import WordCloud from "@/components/game/host/WordCloud";
import PolaroidCollage from "@/components/game/host/PolaroidCollage";
import GuestbookDigital from "@/components/game/host/GuestbookDigital";

type Aggregate = (state: unknown, pulseType: string, payload: unknown) => unknown;

const DEMO_AUTHOR = "現場觀眾";
const rid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_EMOJIS = ["❤️", "👍", "🎉", "🔥", "😍", "👏", "😂", "🙌"];

// ── 各 demo 的設定 + 初始 state + 聚合邏輯（對齊 *Page 容器）──
const DEMOS: Record<
  string,
  {
    title: string;
    config: Record<string, unknown>;
    initial: unknown;
    aggregate: Aggregate;
    Host: (p: { config: unknown; state: unknown }) => JSX.Element;
    Player: (p: { config: unknown; state: unknown; onPulse: (t: string, pl: unknown) => void }) => JSX.Element;
  }
> = {
  emoji: {
    title: "情緒池應援",
    config: { title: "情緒池應援", subtitle: "點 emoji 為現場加溫", emojis: DEFAULT_EMOJIS },
    initial: { counts: Object.fromEntries(DEFAULT_EMOJIS.map((e) => [e, 0])), totalReacts: 0, recentFlying: [] },
    aggregate: (state, pulseType, payload) => {
      if (pulseType !== "react") return null;
      const emoji = (payload as { emoji?: string })?.emoji;
      if (!emoji || !DEFAULT_EMOJIS.includes(emoji)) return null;
      const s = state as { counts: Record<string, number>; totalReacts: number; recentFlying: unknown[] };
      const flying = [
        ...s.recentFlying,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, emoji, x: Math.floor(Math.random() * 90), startedAt: Date.now() },
      ].slice(-30);
      return { counts: { ...s.counts, [emoji]: (s.counts[emoji] ?? 0) + 1 }, totalReacts: s.totalReacts + 1, recentFlying: flying };
    },
    Host: ({ config, state }) => <EmojiReact config={config as never} hostMode state={state as never} />,
    Player: ({ config, state, onPulse }) => <EmojiReact config={config as never} hostMode={false} state={state as never} onPulse={onPulse} />,
  },
  wave: {
    title: "全場應援",
    config: { title: "全場應援", subtitle: "一起按出聲量！", buttonLabel: "GO!" },
    initial: { totalTaps: 0, bucketBySec: {} },
    aggregate: (state, pulseType) => {
      if (pulseType !== "tap") return null;
      const s = state as { totalTaps: number; bucketBySec: Record<string, number> };
      const sec = String(Math.floor(Date.now() / 1000));
      return { totalTaps: s.totalTaps + 1, bucketBySec: { ...s.bucketBySec, [sec]: (s.bucketBySec[sec] ?? 0) + 1 } };
    },
    Host: ({ config, state }) => <WaveResponse config={config as never} hostMode state={state as never} />,
    Player: ({ config, state, onPulse }) => <WaveResponse config={config as never} hostMode={false} state={state as never} onPulse={onPulse} />,
  },
  poll: {
    title: "即時投票",
    config: {
      title: "即時投票",
      question: "你最想先玩哪個？",
      options: [
        { id: "a", label: "搶答秀" },
        { id: "b", label: "情緒池" },
        { id: "c", label: "尋寶" },
      ],
    },
    initial: {
      question: "你最想先玩哪個？",
      options: [{ id: "a", label: "搶答秀" }, { id: "b", label: "情緒池" }, { id: "c", label: "尋寶" }],
      votes: { a: 0, b: 0, c: 0 },
      totalVotes: 0,
      status: "open",
      revealResults: false,
    },
    aggregate: (state, pulseType, payload) => {
      if (pulseType !== "vote") return null;
      const optionId = (payload as { optionId?: string })?.optionId;
      if (!optionId) return null;
      const s = state as { status: string; votes: Record<string, number>; totalVotes: number; options: { id: string }[] };
      if (s.status !== "open" || !s.options.find((o) => o.id === optionId)) return s;
      return { ...s, votes: { ...s.votes, [optionId]: (s.votes[optionId] ?? 0) + 1 }, totalVotes: s.totalVotes + 1 };
    },
    Host: ({ config, state }) => <PollLive config={config as never} hostMode state={state as never} />,
    Player: ({ config, state, onPulse }) => <PollLive config={config as never} hostMode={false} state={state as never} onPulse={onPulse} />,
  },
};

export const INTERACTIVE_DEMOS = Object.keys(DEMOS);

export default function InteractiveDemo({ demo }: { demo: string }) {
  const def = DEMOS[demo];
  const [state, setState] = useState<unknown>(def?.initial ?? null);
  const onPulse = useCallback(
    (pulseType: string, payload: unknown) => {
      setState((cur: unknown) => {
        const next = def.aggregate(cur, pulseType, payload);
        return next === null ? cur : next;
      });
    },
    [def],
  );
  if (!def) return null;
  const { Host, Player, config } = def;
  return (
    <div className="flex flex-col md:flex-row gap-3 p-3 bg-zinc-950">
      {/* 大螢幕 */}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white/60 mb-1 px-1">📺 大螢幕（即時反應）</div>
        <div className="rounded-lg overflow-hidden border border-white/10 bg-black h-[300px] md:h-[420px] overflow-y-auto">
          <Host config={config} state={state} />
        </div>
      </div>
      {/* 手機 */}
      <div className="w-full md:w-[280px] shrink-0">
        <div className="text-xs text-white/60 mb-1 px-1">📱 手機（點點看 →）</div>
        <div className="rounded-lg overflow-hidden border border-emerald-500/30 bg-background h-[300px] md:h-[420px] overflow-y-auto">
          <Player config={config} state={state} onPulse={onPulse} />
        </div>
      </div>
    </div>
  );
}
