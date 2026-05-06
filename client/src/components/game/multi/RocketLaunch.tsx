import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface RocketEntry {
  entryId: string;
  userId: string;
  userName: string;
  stage: string;
  mission: string;
}

interface RocketLaunchState extends Record<string, unknown> {
  entries: RocketEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: RocketLaunchState = { entries: [], revealed: false };

const LAUNCH_STAGES = [
  { id: "prep", label: "備戰中", icon: "🔧", desc: "打好基礎，做好準備" },
  { id: "countdown", label: "倒數計時", icon: "⏳", desc: "蓄勢待發，即將行動" },
  { id: "ignite", label: "點火啟動", icon: "🔥", desc: "全力啟動，能量爆發" },
  { id: "liftoff", label: "成功升空", icon: "🚀", desc: "突破阻力，自由飛翔" },
  { id: "orbit", label: "進入軌道", icon: "🌍", desc: "找到節奏，穩定運行" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function RocketLaunch({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<RocketLaunchState>({
    gameId,
    sessionId,
    pageId,
    type: "rocket_launch",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedStage, setSelectedStage] = useState("prep");
  const [mission, setMission] = useState("");

  if (!isLoaded) return <div data-testid="rkl-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "火箭發射";
  const prompt = config?.prompt ?? "你的任務目前在哪個發射階段？";
  const entries = (state.entries ?? []) as RocketEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = mission.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: RocketEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      stage: selectedStage,
      mission: mission.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setMission("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="rkl-title" className="text-xl font-bold text-center text-indigo-800">{title}</h2>
      <p data-testid="rkl-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="rkl-count" className="text-center text-xs text-gray-400">已發射：{entries.length} 枚火箭</p>

      {!myEntry && !revealed && (
        <div data-testid="rkl-form" className="space-y-3">
          <div data-testid="rkl-stage-grid" className="grid grid-cols-1 gap-2">
            {LAUNCH_STAGES.map((s) => (
              <button
                key={s.id}
                data-testid={`rkl-stage-${s.id}`}
                onClick={() => setSelectedStage(s.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedStage === s.id ? "bg-indigo-100 border-indigo-500" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{s.icon}</span>
                <div>
                  <p className="font-medium text-sm">{s.label}</p>
                  <p className="text-xs text-gray-500">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="rkl-mission-input"
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            placeholder="說說你的任務是什麼（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            data-testid="rkl-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-40"
          >
            發射火箭
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="rkl-my-entry" className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <p className="text-sm font-medium text-indigo-700">我的火箭已發射</p>
          <p className="text-xs text-gray-500 mt-1">{LAUNCH_STAGES.find((s) => s.id === myEntry.stage)?.label} — {myEntry.mission}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="rkl-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          展示任務報告
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="rkl-empty" className="text-center text-gray-400 py-8">發射台還沒有火箭</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="rkl-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`rkl-card-${e.entryId}`} className="bg-white border border-indigo-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{LAUNCH_STAGES.find((s) => s.id === e.stage)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{LAUNCH_STAGES.find((s) => s.id === e.stage)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.mission}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
