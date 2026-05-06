import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SnowGlobeEntry {
  entryId: string;
  userId: string;
  userName: string;
  snowScene: string;
  story: string;
}

interface SnowGlobeState extends Record<string, unknown> {
  entries: SnowGlobeEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: SnowGlobeState = { entries: [], revealed: false };

const SNOW_SCENES = [
  { id: "winter_forest", label: "冬日森林", icon: "🌲", desc: "白雪覆蓋的靜謐林間" },
  { id: "northern_lights", label: "極光夜空", icon: "🌌", desc: "漫天飛舞的絢麗光彩" },
  { id: "cozy_cabin", label: "溫暖小屋", icon: "🏠", desc: "壁爐旁的舒適時光" },
  { id: "snow_mountain", label: "雪山頂端", icon: "🏔️", desc: "俯瞰世界的壯闊視野" },
  { id: "frozen_lake", label: "冰封湖面", icon: "❄️", desc: "晶瑩透澈的靜止之美" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function SnowGlobe({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SnowGlobeState>({
    gameId,
    sessionId,
    pageId,
    type: "snow_globe",
    defaultState: DEFAULT_STATE,
  });

  const [selectedScene, setSelectedScene] = useState("winter_forest");
  const [story, setStory] = useState("");

  if (!isLoaded) return <div data-testid="snw-loading">載入中...</div>;

  const title = config?.title ?? "水晶雪球";
  const prompt = config?.prompt ?? "搖晃你的水晶球，哪個雪景場景最像你此刻的心境？";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = story.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: SnowGlobeEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      snowScene: selectedScene,
      story: story.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setStory("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="snw-title" className="text-2xl font-bold text-blue-700">
        {title}
      </h2>
      <p data-testid="snw-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="snw-count" className="text-sm text-gray-500">
        已搖晃 {state.entries.length} 個雪球
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="snw-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {SNOW_SCENES.map((ss) => (
              <button
                key={ss.id}
                data-testid={`snw-scene-${ss.id}`}
                onClick={() => setSelectedScene(ss.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedScene === ss.id
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-blue-300"
                }`}
              >
                <div className="text-xl">{ss.icon}</div>
                <div className="text-xs font-medium">{ss.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{ss.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="snw-story-input"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="這個雪景讓你想到什麼？"
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-blue-400 focus:outline-none"
          />
          <button
            data-testid="snw-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-blue-500 text-white font-semibold disabled:opacity-40"
          >
            封存雪景 ❄️
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="snw-my-entry" className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-1">
          <p className="text-sm text-blue-600 font-medium">
            {SNOW_SCENES.find((s) => s.id === myEntry.snowScene)?.icon}{" "}
            {SNOW_SCENES.find((s) => s.id === myEntry.snowScene)?.label}
          </p>
          <p className="text-gray-700">{myEntry.story}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="snw-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-cyan-600 text-white font-semibold"
        >
          揭曉所有雪景 ⛄
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="snw-empty" className="text-center text-gray-400 py-8">
          雪球尚未有人搖晃
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="snw-result" className="space-y-3">
          <h3 className="font-semibold text-blue-700">所有雪景已揭曉</h3>
          {state.entries.map((entry) => {
            const ss = SNOW_SCENES.find((s) => s.id === entry.snowScene);
            return (
              <div
                key={entry.entryId}
                data-testid={`snw-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-blue-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{ss?.icon}</span>
                  <span className="font-medium text-blue-700">{ss?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.story}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
