import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MaterialEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  material: string;
  reason: string;
}

interface MaterialTypeState extends Record<string, unknown> {
  entries: MaterialEntry[];
  revealed: boolean;
}

interface MaterialTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): MaterialTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const MATERIALS = [
  { id: "wood", label: "木材", emoji: "🪵", desc: "溫暖自然歲月有痕" },
  { id: "metal", label: "金屬", emoji: "⚙️", desc: "堅硬精準耐久可靠" },
  { id: "glass", label: "玻璃", emoji: "🪟", desc: "透明清澈折射萬象" },
  { id: "ceramic", label: "陶瓷", emoji: "🏺", desc: "雕琢細緻溫潤典雅" },
  { id: "fabric", label: "布料", emoji: "🧵", desc: "柔軟包容貼近人心" },
  { id: "stone", label: "石材", emoji: "🪨", desc: "永恆沉穩歷史見證" },
  { id: "concrete", label: "混凝土", emoji: "🏗️", desc: "樸實有力現代基礎" },
  { id: "leather", label: "皮革", emoji: "👜", desc: "成熟質感越用越美" },
  { id: "bamboo", label: "竹材", emoji: "🎋", desc: "靈活堅韌節節高升" },
];

const CARD_COLORS = [
  "border-l-stone-500 bg-stone-50",
  "border-l-slate-500 bg-slate-50",
  "border-l-zinc-500 bg-zinc-50",
  "border-l-neutral-500 bg-neutral-50",
  "border-l-stone-600 bg-stone-50",
  "border-l-slate-600 bg-slate-50",
  "border-l-zinc-600 bg-zinc-50",
  "border-l-neutral-600 bg-neutral-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MaterialType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<MaterialTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "material_type",
    defaultState: { entries: [], revealed: false },
  });

  const [material, setMaterial] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="mat-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as MaterialEntry[]).find((e) => e.userId === userId);
  const canSubmit = material !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: MaterialEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      material,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as MaterialEntry[]), entry] });
    setMaterial("");
    setReason("");
  };

  const entries = state.entries as MaterialEntry[];
  const revealed = state.revealed as boolean;

  const materialCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.material] = (acc[e.material] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="mat-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種材質"}
      </div>
      <div data-testid="mat-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種材質，你最像哪種？說說你的材質個性！"}
      </div>
      <div data-testid="mat-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="mat-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {MATERIALS.map((m) => (
              <button
                key={m.id}
                data-testid={`mat-material-${m.id}`}
                onClick={() => setMaterial(m.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${material === m.id ? "border-stone-500 bg-stone-50 font-semibold" : "hover:border-stone-400"}`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <div className="font-medium text-center">{m.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{m.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="mat-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種材質最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="mat-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-stone-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            塑形！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="mat-my-entry" className="bg-stone-50 rounded-xl p-3 border border-stone-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{MATERIALS.find((m) => m.id === myEntry.material)?.emoji}</span>
            <span className="text-sm font-semibold">{MATERIALS.find((m) => m.id === myEntry.material)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已成型</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="mat-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-stone-700 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊材料庫
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="mat-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇材質
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="mat-result" className="flex flex-col gap-3">
          <div data-testid="mat-material-summary" className="flex flex-wrap gap-2">
            {MATERIALS.filter((m) => materialCounts[m.id] > 0).map((m) => (
              <div
                key={m.id}
                data-testid={`mat-badge-${m.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-stone-100 text-stone-700 text-xs font-semibold"
              >
                {m.emoji} {m.label}
                <span className="ml-1 bg-stone-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {materialCounts[m.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="mat-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const m = MATERIALS.find((x) => x.id === e.material);
              return (
                <div
                  key={e.entryId}
                  data-testid={`mat-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{m?.emoji}</span>
                    <span className="text-sm font-semibold">{m?.label}</span>
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
