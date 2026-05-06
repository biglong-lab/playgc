import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface InsectEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  insect: string;
  reason: string;
}

interface InsectTypeState extends Record<string, unknown> {
  entries: InsectEntry[];
  revealed: boolean;
}

interface InsectTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): InsectTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const INSECTS = [
  { id: "butterfly", label: "蝴蝶", emoji: "🦋", desc: "優雅蛻變翩翩起舞" },
  { id: "bee", label: "蜜蜂", emoji: "🐝", desc: "勤勞合作甘甜奉獻" },
  { id: "dragonfly", label: "蜻蜓", emoji: "🌀", desc: "靈活敏捷自由飛翔" },
  { id: "ladybug", label: "瓢蟲", emoji: "🐞", desc: "可愛帶來好運氣息" },
  { id: "firefly", label: "螢火蟲", emoji: "🌟", desc: "黑暗中散發溫柔光" },
  { id: "beetle", label: "甲蟲", emoji: "🪲", desc: "堅硬外殼保護自我" },
  { id: "grasshopper", label: "蚱蜢", emoji: "🦗", desc: "彈跳自如節奏律動" },
  { id: "mantis", label: "螳螂", emoji: "🌿", desc: "沉著等待精準出擊" },
  { id: "ant", label: "螞蟻", emoji: "🐜", desc: "團結協作力量無限" },
];

const CARD_COLORS = [
  "border-l-green-500 bg-green-50",
  "border-l-lime-500 bg-lime-50",
  "border-l-emerald-500 bg-emerald-50",
  "border-l-teal-500 bg-teal-50",
  "border-l-yellow-500 bg-yellow-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-cyan-400 bg-cyan-50",
  "border-l-green-400 bg-green-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function InsectType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<InsectTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "insect_type",
    defaultState: { entries: [], revealed: false },
  });

  const [insect, setInsect] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="ins-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as InsectEntry[]).find((e) => e.userId === userId);
  const canSubmit = insect !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: InsectEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      insect,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as InsectEntry[]), entry] });
    setInsect("");
    setReason("");
  };

  const entries = state.entries as InsectEntry[];
  const revealed = state.revealed as boolean;

  const insectCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.insect] = (acc[e.insect] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="ins-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種昆蟲"}
      </div>
      <div data-testid="ins-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種昆蟲，你最像哪種？說說你的昆蟲個性！"}
      </div>
      <div data-testid="ins-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="ins-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {INSECTS.map((i) => (
              <button
                key={i.id}
                data-testid={`ins-insect-${i.id}`}
                onClick={() => setInsect(i.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${insect === i.id ? "border-green-500 bg-green-50 font-semibold" : "hover:border-green-400"}`}
              >
                <span className="text-2xl">{i.emoji}</span>
                <div className="font-medium text-center">{i.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{i.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="ins-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種昆蟲最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="ins-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-green-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            破繭！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="ins-my-entry" className="bg-green-50 rounded-xl p-3 border border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{INSECTS.find((i) => i.id === myEntry.insect)?.emoji}</span>
            <span className="text-sm font-semibold">{INSECTS.find((i) => i.id === myEntry.insect)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已羽化</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="ins-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-green-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊昆蟲園
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="ins-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇昆蟲
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="ins-result" className="flex flex-col gap-3">
          <div data-testid="ins-insect-summary" className="flex flex-wrap gap-2">
            {INSECTS.filter((i) => insectCounts[i.id] > 0).map((i) => (
              <div
                key={i.id}
                data-testid={`ins-badge-${i.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold"
              >
                {i.emoji} {i.label}
                <span className="ml-1 bg-green-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {insectCounts[i.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="ins-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const i = INSECTS.find((x) => x.id === e.insect);
              return (
                <div
                  key={e.entryId}
                  data-testid={`ins-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{i?.emoji}</span>
                    <span className="text-sm font-semibold">{i?.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{e.reason}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
