import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface PlanetEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  planet: string;
  reason: string;
}

interface PlanetTypeState extends Record<string, unknown> {
  entries: PlanetEntry[];
  revealed: boolean;
}

interface PlanetTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): PlanetTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const PLANETS = [
  { id: "mercury", label: "水星", emoji: "🪨", desc: "快速多變反應靈敏" },
  { id: "venus", label: "金星", emoji: "✨", desc: "優雅美麗重視關係" },
  { id: "earth", label: "地球", emoji: "🌍", desc: "包容踏實生生不息" },
  { id: "mars", label: "火星", emoji: "🔴", desc: "勇猛衝勁充滿鬥志" },
  { id: "jupiter", label: "木星", emoji: "🟠", desc: "寬廣慷慨無所不包" },
  { id: "saturn", label: "土星", emoji: "🪐", desc: "自律規律重視秩序" },
  { id: "uranus", label: "天王星", emoji: "🔵", desc: "革新創意突破傳統" },
  { id: "neptune", label: "海王星", emoji: "🌊", desc: "夢幻直覺神秘深邃" },
  { id: "pluto", label: "冥王星", emoji: "⚫", desc: "轉化深層重生蛻變" },
];

const CARD_COLORS = [
  "border-l-indigo-400 bg-indigo-50",
  "border-l-violet-400 bg-violet-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-sky-400 bg-sky-50",
  "border-l-purple-400 bg-purple-50",
  "border-l-fuchsia-400 bg-fuchsia-50",
  "border-l-cyan-400 bg-cyan-50",
  "border-l-slate-400 bg-slate-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function PlanetType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<PlanetTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "planet_type",
    defaultState: { entries: [], revealed: false },
  });

  const [planet, setPlanet] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="pln-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as PlanetEntry[]).find((e) => e.userId === userId);
  const canSubmit = planet !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: PlanetEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      planet,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as PlanetEntry[]), entry] });
    setPlanet("");
    setReason("");
  };

  const entries = state.entries as PlanetEntry[];
  const revealed = state.revealed as boolean;

  const planetCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.planet] = (acc[e.planet] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="pln-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪顆星球"}
      </div>
      <div data-testid="pln-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是太陽系的一顆星球，你最像哪一顆？說說你的星球特質！"}
      </div>
      <div data-testid="pln-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="pln-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {PLANETS.map((p) => (
              <button
                key={p.id}
                data-testid={`pln-planet-${p.id}`}
                onClick={() => setPlanet(p.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${planet === p.id ? "border-indigo-500 bg-indigo-50 font-semibold" : "hover:border-indigo-400"}`}
              >
                <span className="text-2xl">{p.emoji}</span>
                <div className="font-medium text-center">{p.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{p.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="pln-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這顆星球最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="pln-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            升空！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="pln-my-entry" className="bg-indigo-50 rounded-xl p-3 border border-indigo-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{PLANETS.find((p) => p.id === myEntry.planet)?.emoji}</span>
            <span className="text-sm font-semibold">{PLANETS.find((p) => p.id === myEntry.planet)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已進入軌道</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="pln-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊太陽系
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="pln-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇星球
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="pln-result" className="flex flex-col gap-3">
          <div data-testid="pln-planet-summary" className="flex flex-wrap gap-2">
            {PLANETS.filter((p) => planetCounts[p.id] > 0).map((p) => (
              <div
                key={p.id}
                data-testid={`pln-badge-${p.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold"
              >
                {p.emoji} {p.label}
                <span className="ml-1 bg-indigo-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {planetCounts[p.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="pln-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const p = PLANETS.find((x) => x.id === e.planet);
              return (
                <div
                  key={e.entryId}
                  data-testid={`pln-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{p?.emoji}</span>
                    <span className="text-sm font-semibold">{p?.label}</span>
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
