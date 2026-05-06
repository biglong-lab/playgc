import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface HeroEntry {
  entryId: string;
  userId: string;
  userName: string;
  stage: string;
  reflection: string;
}

interface HeroJourneyState extends Record<string, unknown> {
  entries: HeroEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: HeroJourneyState = { entries: [], revealed: false };

const STAGES = [
  { id: "ordinary", label: "日常世界", icon: "🏡", desc: "現在的狀態" },
  { id: "call", label: "冒險召喚", icon: "📯", desc: "感受到的改變訊號" },
  { id: "refusal", label: "猶豫抗拒", icon: "🤔", desc: "面對不確定" },
  { id: "departure", label: "踏上旅途", icon: "🚀", desc: "決定出發了" },
  { id: "challenge", label: "考驗磨練", icon: "⚔️", desc: "正在克服挑戰" },
  { id: "return", label: "帶回智慧", icon: "🌟", desc: "整合所學回歸" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function HeroJourney({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<HeroJourneyState>({
    gameId,
    sessionId,
    pageId,
    type: "hero_journey",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedStage, setSelectedStage] = useState("ordinary");
  const [reflection, setReflection] = useState("");

  if (!isLoaded) return <div data-testid="hjr-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "英雄旅程卡";
  const prompt = config?.prompt ?? "你現在正站在英雄旅程的哪個階段？";
  const entries = (state.entries ?? []) as HeroEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = reflection.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: HeroEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      stage: selectedStage,
      reflection: reflection.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setReflection("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="hjr-title" className="text-xl font-bold text-center text-purple-700">{title}</h2>
      <p data-testid="hjr-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="hjr-count" className="text-center text-xs text-gray-400">已分享：{entries.length} 人</p>

      {!myEntry && !revealed && (
        <div data-testid="hjr-form" className="space-y-3">
          <div data-testid="hjr-stage-grid" className="grid grid-cols-2 gap-2">
            {STAGES.map((s) => (
              <button
                key={s.id}
                data-testid={`hjr-stage-${s.id}`}
                onClick={() => setSelectedStage(s.id)}
                className={`p-2 rounded-lg border text-left transition-colors ${selectedStage === s.id ? "bg-purple-100 border-purple-400" : "bg-white border-gray-200"}`}
              >
                <span className="text-lg">{s.icon}</span>
                <span className="ml-1 text-sm font-medium">{s.label}</span>
                <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
              </button>
            ))}
          </div>
          <textarea
            data-testid="hjr-reflection-input"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="分享你在這個階段的感受或洞察（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            data-testid="hjr-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-purple-500 text-white font-medium disabled:opacity-40"
          >
            分享我的旅程
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="hjr-my-entry" className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-sm font-medium text-purple-700">我的旅程已分享</p>
          <p className="text-xs text-gray-500 mt-1">{STAGES.find((s) => s.id === myEntry.stage)?.label} — {myEntry.reflection}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="hjr-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          揭曉所有旅程
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="hjr-empty" className="text-center text-gray-400 py-8">還沒有人分享旅程</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="hjr-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`hjr-card-${e.entryId}`} className="bg-white border border-purple-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{STAGES.find((s) => s.id === e.stage)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">{STAGES.find((s) => s.id === e.stage)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.reflection}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
