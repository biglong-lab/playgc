import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface CrystalEntry {
  entryId: string;
  userId: string;
  userName: string;
  visionType: string;
  prediction: string;
}

interface CrystalBallState extends Record<string, unknown> {
  entries: CrystalEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: CrystalBallState = { entries: [], revealed: false };

const VISION_TYPES = [
  { id: "fortune", label: "大吉", icon: "🔮", desc: "好運連連，一切順心" },
  { id: "caution", label: "警示", icon: "⚠️", desc: "留意前方，謹慎前進" },
  { id: "opportunity", label: "機遇", icon: "✨", desc: "良機降臨，把握當下" },
  { id: "challenge", label: "挑戰", icon: "⚡", desc: "考驗在前，迎難而上" },
  { id: "turning", label: "轉機", icon: "🌀", desc: "峰迴路轉，柳暗花明" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function CrystalBall({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<CrystalBallState>({
    gameId,
    sessionId,
    pageId,
    type: "crystal_ball",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedVision, setSelectedVision] = useState("fortune");
  const [prediction, setPrediction] = useState("");

  if (!isLoaded) return <div data-testid="cbl-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "水晶球預言";
  const prompt = config?.prompt ?? "凝視水晶球，你看見了什麼？";
  const entries = (state.entries ?? []) as CrystalEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = prediction.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: CrystalEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      visionType: selectedVision,
      prediction: prediction.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setPrediction("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="cbl-title" className="text-xl font-bold text-center text-purple-800">{title}</h2>
      <p data-testid="cbl-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="cbl-count" className="text-center text-xs text-gray-400">已預言：{entries.length} 人</p>

      {!myEntry && !revealed && (
        <div data-testid="cbl-form" className="space-y-3">
          <div data-testid="cbl-vision-grid" className="grid grid-cols-1 gap-2">
            {VISION_TYPES.map((v) => (
              <button
                key={v.id}
                data-testid={`cbl-vision-${v.id}`}
                onClick={() => setSelectedVision(v.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedVision === v.id ? "bg-purple-100 border-purple-500" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{v.icon}</span>
                <div>
                  <p className="font-medium text-sm">{v.label}</p>
                  <p className="text-xs text-gray-500">{v.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="cbl-prediction-input"
            value={prediction}
            onChange={(e) => setPrediction(e.target.value)}
            placeholder="說說你的預言內容（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            data-testid="cbl-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-40"
          >
            封存預言
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="cbl-my-entry" className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-sm font-medium text-purple-700">我的預言已封存</p>
          <p className="text-xs text-gray-500 mt-1">{VISION_TYPES.find((v) => v.id === myEntry.visionType)?.label} — {myEntry.prediction}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="cbl-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          開啟水晶球
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="cbl-empty" className="text-center text-gray-400 py-8">水晶球裡一片霧濛濛</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="cbl-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`cbl-card-${e.entryId}`} className="bg-white border border-purple-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{VISION_TYPES.find((v) => v.id === e.visionType)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">{VISION_TYPES.find((v) => v.id === e.visionType)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.prediction}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
