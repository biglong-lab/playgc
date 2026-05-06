import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface OceanEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  creature: string;
  reason: string;
}

interface OceanCreatureState extends Record<string, unknown> {
  entries: OceanEntry[];
  revealed: boolean;
}

interface OceanCreatureConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): OceanCreatureConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const CREATURES = [
  { id: "dolphin", label: "海豚", emoji: "🐬", desc: "聰明活潑樂於互動" },
  { id: "shark", label: "鯊魚", emoji: "🦈", desc: "果敢直接行動力強" },
  { id: "whale", label: "鯨魚", emoji: "🐋", desc: "寬廣深邃包容萬物" },
  { id: "octopus", label: "章魚", emoji: "🐙", desc: "多才多藝靈活應變" },
  { id: "seahorse", label: "海馬", emoji: "🐴", desc: "獨特優雅隨波而行" },
  { id: "jellyfish", label: "水母", emoji: "🪼", desc: "透明純粹順勢飄流" },
  { id: "turtle", label: "海龜", emoji: "🐢", desc: "穩健長遠耐力十足" },
  { id: "starfish", label: "海星", emoji: "⭐", desc: "再生重生永不放棄" },
  { id: "manta_ray", label: "魟魚", emoji: "🌊", desc: "優雅自在遨遊深海" },
];

const CARD_COLORS = [
  "border-l-blue-500 bg-blue-50",
  "border-l-cyan-500 bg-cyan-50",
  "border-l-teal-500 bg-teal-50",
  "border-l-sky-500 bg-sky-50",
  "border-l-indigo-400 bg-indigo-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-cyan-400 bg-cyan-50",
  "border-l-teal-400 bg-teal-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function OceanCreature({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<OceanCreatureState>({
    gameId,
    sessionId,
    pageId,
    type: "ocean_creature",
    defaultState: { entries: [], revealed: false },
  });

  const [creature, setCreature] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="oc-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as OceanEntry[]).find((e) => e.userId === userId);
  const canSubmit = creature !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: OceanEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      creature,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as OceanEntry[]), entry] });
    setCreature("");
    setReason("");
  };

  const entries = state.entries as OceanEntry[];
  const revealed = state.revealed as boolean;

  const creatureCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.creature] = (acc[e.creature] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="oc-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種海洋生物"}
      </div>
      <div data-testid="oc-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種海洋生物，你最像哪種？說說你的海洋個性！"}
      </div>
      <div data-testid="oc-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="oc-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {CREATURES.map((c) => (
              <button
                key={c.id}
                data-testid={`oc-creature-${c.id}`}
                onClick={() => setCreature(c.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${creature === c.id ? "border-blue-500 bg-blue-50 font-semibold" : "hover:border-blue-400"}`}
              >
                <span className="text-2xl">{c.emoji}</span>
                <div className="font-medium text-center">{c.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{c.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="oc-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種海洋生物最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="oc-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            潛入！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="oc-my-entry" className="bg-blue-50 rounded-xl p-3 border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{CREATURES.find((c) => c.id === myEntry.creature)?.emoji}</span>
            <span className="text-sm font-semibold">{CREATURES.find((c) => c.id === myEntry.creature)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已入海</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="oc-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-blue-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊海洋圖鑑
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="oc-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇海洋生物
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="oc-result" className="flex flex-col gap-3">
          <div data-testid="oc-creature-summary" className="flex flex-wrap gap-2">
            {CREATURES.filter((c) => creatureCounts[c.id] > 0).map((c) => (
              <div
                key={c.id}
                data-testid={`oc-badge-${c.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold"
              >
                {c.emoji} {c.label}
                <span className="ml-1 bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {creatureCounts[c.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="oc-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const c = CREATURES.find((x) => x.id === e.creature);
              return (
                <div
                  key={e.entryId}
                  data-testid={`oc-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{c?.emoji}</span>
                    <span className="text-sm font-semibold">{c?.label}</span>
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
