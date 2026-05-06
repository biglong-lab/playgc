import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface VehicleEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  vehicle: string;
  reason: string;
}

interface VehicleTypeState extends Record<string, unknown> {
  entries: VehicleEntry[];
  revealed: boolean;
}

interface VehicleTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): VehicleTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const VEHICLES = [
  { id: "bicycle", label: "腳踏車", emoji: "🚲", desc: "自由悠閒享受過程" },
  { id: "motorcycle", label: "摩托車", emoji: "🏍️", desc: "靈活機動隨機應變" },
  { id: "suv", label: "SUV", emoji: "🚙", desc: "穩重踏實全能應對" },
  { id: "sportscar", label: "跑車", emoji: "🏎️", desc: "熱情速度追求卓越" },
  { id: "train", label: "火車", emoji: "🚂", desc: "按部就班守時穩定" },
  { id: "airplane", label: "飛機", emoji: "✈️", desc: "大格局視野宏遠" },
  { id: "sailboat", label: "帆船", emoji: "⛵", desc: "順勢而為乘風破浪" },
  { id: "hotairballoon", label: "熱氣球", emoji: "🎈", desc: "浪漫理想悠然自在" },
  { id: "submarine", label: "潛水艇", emoji: "🤿", desc: "深邃內斂靜水流深" },
];

const CARD_COLORS = [
  "border-l-blue-400 bg-blue-50",
  "border-l-sky-400 bg-sky-50",
  "border-l-cyan-400 bg-cyan-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-emerald-400 bg-emerald-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-purple-400 bg-purple-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function VehicleType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<VehicleTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "vehicle_type",
    defaultState: { entries: [], revealed: false },
  });

  const [vehicle, setVehicle] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="veh-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as VehicleEntry[]).find((e) => e.userId === userId);
  const canSubmit = vehicle !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: VehicleEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      vehicle,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as VehicleEntry[]), entry] });
    setVehicle("");
    setReason("");
  };

  const entries = state.entries as VehicleEntry[];
  const revealed = state.revealed as boolean;

  const vehicleCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.vehicle] = (acc[e.vehicle] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="veh-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種交通工具"}
      </div>
      <div data-testid="veh-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種交通工具，你最像哪一種？說說你的移動風格！"}
      </div>
      <div data-testid="veh-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="veh-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {VEHICLES.map((v) => (
              <button
                key={v.id}
                data-testid={`veh-vehicle-${v.id}`}
                onClick={() => setVehicle(v.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${vehicle === v.id ? "border-blue-500 bg-blue-50 font-semibold" : "hover:border-blue-400"}`}
              >
                <span className="text-2xl">{v.emoji}</span>
                <div className="font-medium text-center">{v.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{v.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="veh-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種交通工具最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="veh-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            出發！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="veh-my-entry" className="bg-blue-50 rounded-xl p-3 border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{VEHICLES.find((v) => v.id === myEntry.vehicle)?.emoji}</span>
            <span className="text-sm font-semibold">{VEHICLES.find((v) => v.id === myEntry.vehicle)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已在路上</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="veh-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-blue-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊車庫
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="veh-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇交通工具
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="veh-result" className="flex flex-col gap-3">
          <div data-testid="veh-vehicle-summary" className="flex flex-wrap gap-2">
            {VEHICLES.filter((v) => vehicleCounts[v.id] > 0).map((v) => (
              <div
                key={v.id}
                data-testid={`veh-badge-${v.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold"
              >
                {v.emoji} {v.label}
                <span className="ml-1 bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {vehicleCounts[v.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="veh-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const v = VEHICLES.find((x) => x.id === e.vehicle);
              return (
                <div
                  key={e.entryId}
                  data-testid={`veh-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{v?.emoji}</span>
                    <span className="text-sm font-semibold">{v?.label}</span>
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
