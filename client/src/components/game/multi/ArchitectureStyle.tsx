import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ArchEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  arch: string;
  reason: string;
}

interface ArchitectureStyleState extends Record<string, unknown> {
  entries: ArchEntry[];
  revealed: boolean;
}

interface ArchitectureStyleConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): ArchitectureStyleConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const ARCH_STYLES = [
  { id: "modern", label: "現代主義", emoji: "🏢", desc: "功能至上簡潔俐落" },
  { id: "baroque", label: "巴洛克", emoji: "🏛️", desc: "華麗繁複充滿戲劇" },
  { id: "minimalist", label: "極簡主義", emoji: "⬜", desc: "留白有力靜謐深遠" },
  { id: "brutalist", label: "野獸派", emoji: "🧱", desc: "原始粗獷真實有力" },
  { id: "art_deco", label: "裝飾藝術", emoji: "✨", desc: "幾何奢華黃金年代" },
  { id: "gothic", label: "哥德式", emoji: "🗼", desc: "高聳神秘仰望天際" },
  { id: "japandi", label: "日北歐", emoji: "🌿", desc: "自然溫暖禪意靜好" },
  { id: "industrial", label: "工業風", emoji: "⚙️", desc: "裸露坦率不加修飾" },
  { id: "mediterranean", label: "地中海", emoji: "🌊", desc: "陽光開朗自由呼吸" },
];

const CARD_COLORS = [
  "border-l-stone-500 bg-stone-50",
  "border-l-amber-600 bg-amber-50",
  "border-l-slate-500 bg-slate-50",
  "border-l-zinc-500 bg-zinc-50",
  "border-l-yellow-600 bg-yellow-50",
  "border-l-stone-600 bg-stone-50",
  "border-l-amber-500 bg-amber-50",
  "border-l-slate-600 bg-slate-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ArchitectureStyle({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ArchitectureStyleState>({
    gameId,
    sessionId,
    pageId,
    type: "architecture_style",
    defaultState: { entries: [], revealed: false },
  });

  const [arch, setArch] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="arc-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as ArchEntry[]).find((e) => e.userId === userId);
  const canSubmit = arch !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: ArchEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      arch,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as ArchEntry[]), entry] });
    setArch("");
    setReason("");
  };

  const entries = state.entries as ArchEntry[];
  const revealed = state.revealed as boolean;

  const archCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.arch] = (acc[e.arch] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="arc-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種建築風格"}
      </div>
      <div data-testid="arc-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種建築風格，你最像哪種？說說你的建築個性！"}
      </div>
      <div data-testid="arc-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="arc-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {ARCH_STYLES.map((a) => (
              <button
                key={a.id}
                data-testid={`arc-arch-${a.id}`}
                onClick={() => setArch(a.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${arch === a.id ? "border-stone-500 bg-stone-50 font-semibold" : "hover:border-stone-400"}`}
              >
                <span className="text-2xl">{a.emoji}</span>
                <div className="font-medium text-center">{a.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{a.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="arc-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種建築風格最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="arc-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-stone-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            建造！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="arc-my-entry" className="bg-stone-50 rounded-xl p-3 border border-stone-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{ARCH_STYLES.find((a) => a.id === myEntry.arch)?.emoji}</span>
            <span className="text-sm font-semibold">{ARCH_STYLES.find((a) => a.id === myEntry.arch)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已落成</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="arc-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-stone-700 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊建築展
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="arc-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇建築風格
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="arc-result" className="flex flex-col gap-3">
          <div data-testid="arc-arch-summary" className="flex flex-wrap gap-2">
            {ARCH_STYLES.filter((a) => archCounts[a.id] > 0).map((a) => (
              <div
                key={a.id}
                data-testid={`arc-badge-${a.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-stone-100 text-stone-700 text-xs font-semibold"
              >
                {a.emoji} {a.label}
                <span className="ml-1 bg-stone-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {archCounts[a.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="arc-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const a = ARCH_STYLES.find((x) => x.id === e.arch);
              return (
                <div
                  key={e.entryId}
                  data-testid={`arc-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{a?.emoji}</span>
                    <span className="text-sm font-semibold">{a?.label}</span>
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
