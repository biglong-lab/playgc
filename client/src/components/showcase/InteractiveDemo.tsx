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
import PolaroidCollage from "@/components/game/host/PolaroidCollage";
import GuestbookDigital from "@/components/game/host/GuestbookDigital";
import KnowledgeMap from "@/components/game/host/KnowledgeMap";
import ScoreboardAnnouncement from "@/components/game/host/ScoreboardAnnouncement";
import TriviaShowdown from "@/components/game/host/TriviaShowdown";
import BingoBoard, { computeLines } from "@/components/game/host/BingoBoard";
import BlessingWall from "@/components/game/host/BlessingWall";

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
    Host: (p: { config: unknown; state: unknown; broadcast: (s: unknown) => void }) => JSX.Element;
    Player: (p: { config: unknown; state: unknown; onPulse: (t: string, pl: unknown) => void }) => JSX.Element;
    // host 端有控制鈕時的提示文字（trivia/scoreboard）
    hostHint?: string;
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
  crowd: {
    title: "聚眾達標",
    config: { title: "一起簽到打卡", targetCount: 8 },
    initial: { registered: [], totalCount: 0, isReached: false },
    aggregate: (state, pulseType, payload) => {
      if (pulseType !== "checkin") return null;
      const name = ((payload as { name?: string })?.name ?? "匿名").slice(0, 20);
      const s = state as { registered: { name: string; ts: number }[]; totalCount: number; isReached: boolean };
      if (s.isReached) return s;
      const total = s.totalCount + 1;
      return { registered: [...s.registered, { name, ts: Date.now() }].slice(-100), totalCount: total, isReached: total >= 8 };
    },
    Host: ({ config, state }) => <CrowdGather config={config as never} hostMode state={state as never} />,
    Player: ({ config, state, onPulse }) => <CrowdGather config={config as never} hostMode={false} state={state as never} onPulse={onPulse} />,
  },
  polaroid: {
    title: "祝福紀念牆",
    config: { title: "📸 留下祝福" },
    initial: { polaroids: [] },
    aggregate: (state, pulseType, payload) => {
      if (pulseType !== "polaroid") return null;
      const p = payload as { emoji?: string; message?: string; color?: string };
      if (!p?.emoji || !p?.message) return null;
      const s = state as { polaroids: unknown[] };
      const np = { id: rid(), emoji: p.emoji, message: p.message.slice(0, 100), author: DEMO_AUTHOR, color: p.color ?? "#fef3c7", ts: Date.now() };
      return { polaroids: [...s.polaroids, np].slice(-50) };
    },
    Host: ({ config, state }) => <PolaroidCollage config={config as never} hostMode state={state as never} myUserName={DEMO_AUTHOR} />,
    Player: ({ config, state, onPulse }) => <PolaroidCollage config={config as never} hostMode={false} state={state as never} myUserName={DEMO_AUTHOR} onPulse={onPulse} />,
  },
  guestbook: {
    title: "數位簽名簿",
    config: { title: "📖 留言簿" },
    initial: { entries: [] },
    aggregate: (state, pulseType, payload) => {
      if (pulseType !== "sign") return null;
      const p = payload as { name?: string; message?: string };
      if (!p?.name || !p?.message) return null;
      const s = state as { entries: unknown[] };
      const ne = { id: rid(), name: p.name.slice(0, 30), message: p.message.slice(0, 200), ts: Date.now() };
      return { entries: [...s.entries, ne].slice(-100) };
    },
    Host: ({ config, state }) => <GuestbookDigital config={config as never} hostMode state={state as never} myUserName={DEMO_AUTHOR} />,
    Player: ({ config, state, onPulse }) => <GuestbookDigital config={config as never} hostMode={false} state={state as never} myUserName={DEMO_AUTHOR} onPulse={onPulse} />,
  },
  knowledgemap: {
    title: "場域全景地圖",
    config: { title: "街區打卡地圖", allowMessage: true },
    initial: { visits: [] },
    aggregate: (state, pulseType, payload) => {
      if (pulseType !== "visit") return null;
      const p = payload as { pointId?: string; name?: string; message?: string };
      if (!p?.pointId || !p?.name) return null;
      const s = state as { visits: unknown[] };
      return { visits: [...s.visits, { id: rid(), pointId: p.pointId, name: p.name, message: p.message, ts: Date.now() }].slice(-200) };
    },
    Host: ({ config, state }) => <KnowledgeMap config={config as never} hostMode state={state as never} myUserName={DEMO_AUTHOR} />,
    Player: ({ config, state, onPulse }) => <KnowledgeMap config={config as never} hostMode={false} state={state as never} myUserName={DEMO_AUTHOR} onPulse={onPulse} />,
  },
  scoreboard: {
    title: "跑馬燈宣告",
    hostHint: "👈 大螢幕端輸入文字+類型→播報，手機端跑馬燈即時顯示",
    config: { title: "賽事即時播報" },
    initial: { announcements: [] },
    aggregate: () => null, // 無 player pulse（host 端主控）
    Host: ({ config, state, broadcast }) => (
      <ScoreboardAnnouncement config={config as never} hostMode state={state as never} onBroadcastState={broadcast as never} />
    ),
    Player: ({ config, state }) => <ScoreboardAnnouncement config={config as never} hostMode={false} state={state as never} />,
  },
  trivia: {
    title: "搶答秀",
    hostHint: "👈 大螢幕端按「開始/揭曉/下一題」控場，手機端搶答",
    config: {
      title: "金門知識搶答",
      questions: [
        { id: "q1", prompt: "金門高粱酒主要原料是？", options: ["高粱", "小米", "稻米", "玉米"], correctIdx: 0, timeLimitSec: 15 },
        { id: "q2", prompt: "金門舊稱為？", options: ["浯洲", "東寧", "瀛洲", "蓬萊"], correctIdx: 0, timeLimitSec: 15 },
      ],
    },
    initial: { currentQuestionIdx: 0, status: "intro", answered: {}, scores: {} },
    aggregate: (state, pulseType, payload) => {
      if (pulseType !== "answer") return null;
      const choice = (payload as { choice?: number })?.choice;
      if (choice === undefined) return null;
      const s = state as { answered: Record<string, unknown>; [k: string]: unknown };
      return { ...s, answered: { ...s.answered, [DEMO_AUTHOR]: { choice, ts: Date.now() } } };
    },
    Host: ({ config, state, broadcast }) => (
      <TriviaShowdown config={config as never} hostMode state={state as never} onBroadcastState={broadcast as never} myUserName={DEMO_AUTHOR} />
    ),
    Player: ({ config, state, onPulse }) => (
      <TriviaShowdown config={config as never} hostMode={false} state={state as never} onPulse={onPulse} myUserName={DEMO_AUTHOR} />
    ),
  },
  bingo: {
    title: "Bingo 集章板",
    hostHint: "👉 手機端點任務格→完成，大螢幕對應格亮起、連線即時判定",
    config: {
      title: "🎯 集章 Bingo",
      subtitle: "完成任務、連線換獎",
      rows: 3,
      cols: 3,
      tasks: [
        { id: "b1", label: "找穿紅衣的人", emoji: "👗" }, { id: "b2", label: "合照一張", emoji: "📸" }, { id: "b3", label: "舉杯敬酒", emoji: "🥂" },
        { id: "b4", label: "找小朋友", emoji: "👶" }, { id: "b5", label: "拍蛋糕", emoji: "🎂" }, { id: "b6", label: "找司儀", emoji: "🎤" },
        { id: "b7", label: "錄祝福", emoji: "🎥" }, { id: "b8", label: "找台北來的", emoji: "🚄" }, { id: "b9", label: "拍捧花", emoji: "💐" },
      ],
    },
    initial: { completed: {}, claimedLines: [], totalParticipants: 0 },
    aggregate: (state, pulseType, payload) => {
      if (pulseType !== "task_complete") return null;
      const taskId = (payload as { taskId?: string })?.taskId;
      if (!taskId) return null;
      const s = state as { completed: Record<string, number>; claimedLines: string[]; totalParticipants: number };
      const newCount = (s.completed[taskId] ?? 0) + 1;
      const completed = { ...s.completed, [taskId]: newCount };
      // 重算連線（對齊 BingoBoardPage）
      const tasks = (DEMOS.bingo.config.tasks as { id: string; requiredCount?: number }[]);
      const rows = 3, cols = 3;
      const done = new Set<number>();
      for (let i = 0; i < rows * cols; i++) {
        const t = tasks[i];
        if (t && (completed[t.id] ?? 0) >= (t.requiredCount ?? 1)) done.add(i);
      }
      const claimedLines = computeLines(rows, cols).filter((ln) => ln.cells.every((c) => done.has(c))).map((ln) => ln.id);
      return { completed, claimedLines, totalParticipants: s.totalParticipants + (newCount === 1 ? 1 : 0) };
    },
    Host: ({ config, state }) => <BingoBoard config={config as never} hostMode state={state as never} />,
    Player: ({ config, state, onPulse }) => <BingoBoard config={config as never} hostMode={false} state={state as never} onPulse={onPulse} />,
  },
  blessing: {
    title: "祝福瀑布牆",
    config: { title: "💝 給新人的祝福", subtitle: "留言飛上大螢幕", theme: "wedding" },
    initial: { blessings: [], recentFlying: [] },
    aggregate: (state, pulseType, payload) => {
      if (pulseType !== "blessing") return null;
      const p = payload as { name?: string; message?: string; emoji?: string };
      if (!p?.name || !p?.message) return null;
      const s = state as { blessings: unknown[]; recentFlying: unknown[] };
      const id = rid();
      const item = { id, name: p.name.slice(0, 20), message: p.message.slice(0, 100), emoji: p.emoji, addedAt: Date.now() };
      const flying = { ...item, x: 10 + Math.floor(Math.random() * 80), startedAt: Date.now() };
      return { blessings: [...s.blessings, item].slice(-100), recentFlying: [...s.recentFlying, flying].slice(-30) };
    },
    Host: ({ config, state }) => <BlessingWall config={config as never} hostMode state={state as never} />,
    Player: ({ config, state, onPulse }) => <BlessingWall config={config as never} hostMode={false} state={state as never} onPulse={onPulse} />,
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
  const { Host, Player, config, hostHint } = def;
  return (
    <div className="flex flex-col gap-2 p-3 bg-zinc-950">
      {hostHint && (
        <div className="text-xs text-amber-300 bg-amber-500/10 rounded px-2 py-1.5">{hostHint}</div>
      )}
      <div className="flex flex-col md:flex-row gap-3">
        {/* 大螢幕 */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-white/60 mb-1 px-1">📺 大螢幕（即時反應）</div>
          <div className="rounded-lg overflow-hidden border border-white/10 bg-black h-[300px] md:h-[420px] overflow-y-auto">
            <Host config={config} state={state} broadcast={setState} />
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
    </div>
  );
}
