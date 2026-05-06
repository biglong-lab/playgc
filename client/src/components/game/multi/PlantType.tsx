import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface PlantEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  plant: string;
  reason: string;
}

interface PlantTypeState extends Record<string, unknown> {
  entries: PlantEntry[];
  revealed: boolean;
}

interface PlantTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): PlantTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const PLANTS = [
  { id: "sunflower", label: "向日葵", emoji: "🌻", desc: "樂觀積極充滿陽光" },
  { id: "cactus", label: "仙人掌", emoji: "🌵", desc: "獨立堅韌不依賴他人" },
  { id: "bamboo", label: "竹子", emoji: "🎋", desc: "柔韌有節節節高升" },
  { id: "orchid", label: "蘭花", emoji: "🌸", desc: "優雅細膩要求品質" },
  { id: "fern", label: "蕨類", emoji: "🌿", desc: "喜歡靜謐陰涼角落" },
  { id: "lotus", label: "蓮花", emoji: "🪷", desc: "出淤泥不染心境平靜" },
  { id: "vine", label: "爬藤", emoji: "🍃", desc: "善於連結攀附成長" },
  { id: "oak", label: "橡樹", emoji: "🌳", desc: "穩如磐石長遠眼光" },
  { id: "moss", label: "苔蘚", emoji: "🌱", desc: "低調默默滋潤一切" },
  { id: "cherryblossom", label: "櫻花", emoji: "🌺", desc: "珍惜當下絢爛短暫" },
];

const CARD_COLORS = [
  "border-l-green-400 bg-green-50",
  "border-l-emerald-400 bg-emerald-50",
  "border-l-lime-400 bg-lime-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-pink-400 bg-pink-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-yellow-400 bg-yellow-50",
  "border-l-amber-400 bg-amber-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function PlantType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<PlantTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "plant_type",
    defaultState: { entries: [], revealed: false },
  });

  const [plant, setPlant] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="plt-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as PlantEntry[]).find((e) => e.userId === userId);
  const canSubmit = plant !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: PlantEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      plant,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as PlantEntry[]), entry] });
    setPlant("");
    setReason("");
  };

  const entries = state.entries as PlantEntry[];
  const revealed = state.revealed as boolean;

  const plantCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.plant] = (acc[e.plant] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="plt-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種植物"}
      </div>
      <div data-testid="plt-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種植物，你最像哪一種？說說你的個性原因！"}
      </div>
      <div data-testid="plt-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="plt-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-2">
            {PLANTS.map((p) => (
              <button
                key={p.id}
                data-testid={`plt-plant-${p.id}`}
                onClick={() => setPlant(p.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${plant === p.id ? "border-green-500 bg-green-50 font-semibold" : "hover:border-green-400"}`}
              >
                <span className="text-xl shrink-0">{p.emoji}</span>
                <div className="text-left">
                  <div className="font-medium">{p.label}</div>
                  <div className="text-muted-foreground text-[10px]">{p.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="plt-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種植物最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="plt-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-green-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            種下去！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="plt-my-entry" className="bg-green-50 rounded-xl p-3 border border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{PLANTS.find((p) => p.id === myEntry.plant)?.emoji}</span>
            <span className="text-sm font-semibold">{PLANTS.find((p) => p.id === myEntry.plant)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已種下</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="plt-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-green-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊植物花園
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="plt-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人種下植物
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="plt-result" className="flex flex-col gap-3">
          <div data-testid="plt-plant-summary" className="flex flex-wrap gap-2">
            {PLANTS.filter((p) => plantCounts[p.id] > 0).map((p) => (
              <div
                key={p.id}
                data-testid={`plt-badge-${p.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold"
              >
                {p.emoji} {p.label}
                <span className="ml-1 bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {plantCounts[p.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="plt-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const p = PLANTS.find((x) => x.id === e.plant);
              return (
                <div
                  key={e.entryId}
                  data-testid={`plt-card-${e.entryId}`}
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
