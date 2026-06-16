// 🤝 CoopDemo — 多人協作元件互動 demo（2026-06-16）
//
// multi 軸線元件（拼圖/尋寶/連鎖/合作衝分/角色分派）不是「大螢幕+手機」模型，
// 而是「全隊共享一份進度」的協作模型。所以 demo 用「並排兩個玩家(A/B)共享同一份
// 本地 state」來呈現：玩家A 操作 → 共享 state 更新 → 玩家B 立刻看到。
//
// 各元件的 state 更新邏輯對齊 *Page.tsx 容器（useTeamPagePersistence.updateState）。

import { useState, useCallback } from "react";
import JigsawPuzzle from "@/components/game/multi/JigsawPuzzle";
import TreasureHunt from "@/components/game/multi/TreasureHunt";
import GpsCascade from "@/components/game/multi/GpsCascade";
import CollectiveScore from "@/components/game/multi/CollectiveScore";
import RoleAssign from "@/components/game/multi/RoleAssign";

type Identity = { userId: string; userName: string };
const A: Identity = { userId: "demo-a", userName: "玩家A" };
const B: Identity = { userId: "demo-b", userName: "玩家B" };

interface CoopDef {
  title: string;
  hint: string;
  config: Record<string, unknown>;
  initial: unknown;
  // 用 identity + 當前 state + setState 綁出該玩家的元件實例
  render: (id: Identity, state: unknown, setState: (fn: (cur: unknown) => unknown) => void) => JSX.Element;
}

const COOP: Record<string, CoopDef> = {
  "jigsaw": {
    title: "隊伍拼圖協作",
    hint: "每位玩家負責一格 — A 填一格，B 立刻看到，拼滿即完成",
    config: { title: "一起拼出大圖", rows: 2, cols: 2, prompts: ["左上：團隊名", "右上：口號", "左下：吉祥物", "右下：目標"] },
    initial: {
      slots: ["r0c0", "r0c1", "r1c0", "r1c1"].map((id, i) => ({
        id, row: Math.floor(i / 2), col: i % 2, prompt: ["左上：團隊名", "右上：口號", "左下：吉祥物", "右下：目標"][i],
      })),
      isComplete: false,
    },
    render: (id, state, setState) => {
      const s = state as { slots: { id: string; filledBy?: string }[]; isComplete: boolean };
      const onFillSlot = (slotId: string, text: string, color: string) =>
        setState((cur) => {
          const c = cur as { slots: { id: string }[] };
          const slots = c.slots.map((sl) => (sl.id === slotId ? { ...sl, filledBy: id.userName, text, color } : sl));
          return { slots, isComplete: slots.every((x) => !!(x as { filledBy?: string }).filledBy) };
        });
      return <JigsawPuzzle config={COOP.jigsaw.config as never} state={{ slots: s.slots, isComplete: s.isComplete } as never} myUserId={id.userId} myUserName={id.userName} onFillSlot={onFillSlot} />;
    },
  },
  "treasure": {
    title: "藏寶解謎協作",
    hint: "任一玩家解開線索 → 全隊同步解鎖，集滿揭曉寶藏",
    config: {
      title: "金門尋寶", subtitle: "答對解鎖下一條線索",
      clues: [
        { id: "c1", prompt: "金門最有名的酒？（兩字）", answer: "高粱", reward: "解鎖：往莒光樓" },
        { id: "c2", prompt: "金門的舊稱？（兩字）", answer: "浯洲", reward: "解鎖：往翟山坑道" },
      ],
      finalReward: "🏆 寶藏：金門高粱一瓶",
    },
    initial: { unlockedClueIds: [] },
    render: (_id, _state, setState) => {
      const onUnlockClue = (clueId: string) =>
        setState((cur) => {
          const c = cur as { unlockedClueIds: string[] };
          return c.unlockedClueIds.includes(clueId) ? c : { unlockedClueIds: [...c.unlockedClueIds, clueId] };
        });
      return <TreasureHunt config={COOP.treasure.config as never} state={_state as never} onUnlockClue={onUnlockClue} />;
    },
  },
  "gps-cascade": {
    title: "連鎖探索",
    hint: "依序抵達各站 — 一人到達，全隊解鎖下一站提示",
    config: {
      title: "金門動線探索",
      points: [
        { id: "p1", name: "模範街", hint: "找紅磚拱廊老街" },
        { id: "p2", name: "莒光樓", hint: "三層古典城樓" },
        { id: "p3", name: "翟山坑道", hint: "花崗岩水道奇景" },
      ],
    },
    initial: { reachedPointIds: [] },
    render: (_id, _state, setState) => {
      const onReachPoint = (pointId: string) =>
        setState((cur) => {
          const c = cur as { reachedPointIds: string[] };
          return c.reachedPointIds.includes(pointId) ? c : { reachedPointIds: [...c.reachedPointIds, pointId] };
        });
      return <GpsCascade config={COOP["gps-cascade"].config as never} state={_state as never} onReachPoint={onReachPoint} />;
    },
  },
  "collective": {
    title: "全隊合作衝分",
    hint: "A、B 各自加分 → 全隊總分一起累積到目標",
    config: { title: "全隊衝分挑戰", subtitle: "一起達標", targetScore: 300, addOptions: [{ label: "+10", delta: 10 }, { label: "+50", delta: 50 }] },
    initial: { totalScore: 0, contributors: [], isReached: false },
    render: (id, _state, setState) => {
      const onContribute = (delta: number) =>
        setState((cur) => {
          const c = cur as { totalScore: number; contributors: { userId: string; name: string; total: number }[]; isReached: boolean };
          if (c.isReached) return c;
          const newTotal = c.totalScore + delta;
          const existing = c.contributors.find((x) => x.userId === id.userId);
          const contributors = c.contributors.map((x) => (x.userId === id.userId ? { ...x, total: x.total + delta } : x));
          if (!existing) contributors.push({ userId: id.userId, name: id.userName, total: delta });
          return { totalScore: newTotal, contributors, isReached: newTotal >= 300 };
        });
      const c = _state as { totalScore: number; contributors: { name: string; total: number }[]; isReached: boolean };
      return <CollectiveScore config={COOP.collective.config as never} state={{ totalScore: c.totalScore, contributors: c.contributors.map((x) => ({ name: x.name, total: x.total })), isReached: c.isReached } as never} myUserName={id.userName} onContribute={onContribute} />;
    },
  },
  "role-assign": {
    title: "角色分派",
    hint: "兩位玩家進場自動分派不同角色，可重抽",
    config: {
      title: "劇本殺角色分派", allowReroll: true,
      roles: [
        { id: "r1", name: "隊長", emoji: "👑", description: "帶領全隊決策" },
        { id: "r2", name: "偵察", emoji: "🔍", description: "搜尋線索" },
        { id: "r3", name: "記錄", emoji: "📝", description: "整理進度" },
      ],
    },
    initial: { assignments: {} },
    render: (id, _state, setState) => {
      const onAssign = (userName: string, roleId: string) =>
        setState((cur) => {
          const c = cur as { assignments: Record<string, string> };
          return c.assignments[userName] ? c : { assignments: { ...c.assignments, [userName]: roleId } };
        });
      const onReroll = () =>
        setState((cur) => {
          const c = cur as { assignments: Record<string, string> };
          const next = { ...c.assignments };
          delete next[id.userName];
          return { assignments: next };
        });
      return <RoleAssign config={COOP["role-assign"].config as never} state={_state as never} myUserName={id.userName} onAssign={onAssign} onReroll={onReroll} />;
    },
  },
};

export const COOP_DEMOS = Object.keys(COOP);

export default function CoopDemo({ demo }: { demo: string }) {
  const def = COOP[demo];
  const [state, setState] = useState<unknown>(def?.initial ?? null);
  const update = useCallback((fn: (cur: unknown) => unknown) => setState((cur: unknown) => fn(cur)), []);
  if (!def) return null;
  return (
    <div className="flex flex-col gap-2 p-3 bg-zinc-950">
      <div className="text-xs text-amber-300 bg-amber-500/10 rounded px-2 py-1.5">🤝 {def.hint}</div>
      <div className="flex flex-col md:flex-row gap-3">
        {[A, B].map((id, i) => (
          <div key={id.userId} className="flex-1 min-w-0">
            <div className={`text-xs mb-1 px-1 ${i === 0 ? "text-sky-300" : "text-emerald-300"}`}>👤 {id.userName}</div>
            <div className={`rounded-lg overflow-hidden border bg-background h-[320px] md:h-[440px] overflow-y-auto ${i === 0 ? "border-sky-500/30" : "border-emerald-500/30"}`}>
              {def.render(id, state, update)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
