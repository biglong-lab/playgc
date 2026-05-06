import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface EmotionWheelEntry {
  entryId: string;
  userId: string;
  userName: string;
  emotion: string;
  intensity: string;
  note: string;
}

interface EmotionWheelState extends Record<string, unknown> {
  entries: EmotionWheelEntry[];
  revealed: boolean;
}

interface EmotionWheelConfig {
  title?: string;
  prompt?: string;
}

interface EmotionWheelProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: EmotionWheelConfig;
}

const EMOTIONS = [
  { id: "joy", label: "喜悅", icon: "😊", color: "bg-yellow-100 border-yellow-400 text-yellow-700" },
  { id: "anger", label: "憤怒", icon: "😤", color: "bg-red-100 border-red-400 text-red-700" },
  { id: "sadness", label: "悲傷", icon: "😢", color: "bg-blue-100 border-blue-400 text-blue-700" },
  { id: "fear", label: "恐懼", icon: "😨", color: "bg-purple-100 border-purple-400 text-purple-700" },
  { id: "surprise", label: "驚訝", icon: "😲", color: "bg-orange-100 border-orange-400 text-orange-700" },
  { id: "disgust", label: "厭惡", icon: "😒", color: "bg-green-100 border-green-400 text-green-700" },
];

const INTENSITIES = [
  { id: "mild", label: "微微" },
  { id: "moderate", label: "明顯" },
  { id: "strong", label: "強烈" },
];

const CARD_COLORS = [
  "bg-yellow-50 border-yellow-200",
  "bg-red-50 border-red-200",
  "bg-blue-50 border-blue-200",
  "bg-purple-50 border-purple-200",
  "bg-orange-50 border-orange-200",
  "bg-green-50 border-green-200",
];

export function EmotionWheel({ gameId, sessionId, pageId, isTeamLead, config }: EmotionWheelProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<EmotionWheelState>({
    gameId,
    sessionId,
    pageId,
    type: "emotion_wheel",
    defaultState: { entries: [], revealed: false },
  });

  const [emotion, setEmotion] = useState("joy");
  const [intensity, setIntensity] = useState("mild");
  const [note, setNote] = useState("");

  if (!isLoaded) return <div data-testid="emw-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = note.trim().length >= 3;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: EmotionWheelEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      emotion,
      intensity,
      note: note.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const selectedEmotion = EMOTIONS.find((e) => e.id === emotion)!;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="emw-title" className="text-xl font-bold text-orange-700 text-center">
        {config?.title ?? "情緒之輪"}
      </h2>
      <p data-testid="emw-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "此刻，你的主要情緒是什麼？"}
      </p>
      <p data-testid="emw-count" className="text-xs text-gray-400 text-center">
        已完成：{state.entries.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="emw-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-orange-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊情緒
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="emw-form" className="space-y-3 bg-orange-50 rounded-xl p-4">
          <div data-testid="emw-emotion-grid" className="grid grid-cols-3 gap-2">
            {EMOTIONS.map((e) => (
              <button
                key={e.id}
                data-testid={`emw-emotion-${e.id}`}
                onClick={() => setEmotion(e.id)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  emotion === e.id ? e.color : "bg-white border-gray-200 hover:border-orange-200"
                }`}
              >
                <span className="text-2xl">{e.icon}</span>
                <span className="text-xs font-medium">{e.label}</span>
              </button>
            ))}
          </div>
          <div data-testid="emw-intensity-grid" className="flex gap-2">
            {INTENSITIES.map((it) => (
              <button
                key={it.id}
                data-testid={`emw-intensity-${it.id}`}
                onClick={() => setIntensity(it.id)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  intensity === it.id
                    ? "bg-orange-100 border-orange-400 text-orange-700"
                    : "bg-white border-gray-200 text-gray-500"
                }`}
              >
                {it.label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-orange-700 font-medium mb-1">
              {selectedEmotion.icon} 說說你的{selectedEmotion.label}...
            </label>
            <input
              data-testid="emw-note-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="是什麼讓你有這個感受？"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            data-testid="emw-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            分享情緒
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="emw-my-entry" className="p-4 rounded-xl border-2 bg-orange-50 border-orange-300 space-y-1">
          <p className="text-sm font-medium text-orange-700">
            {EMOTIONS.find((e) => e.id === myEntry.emotion)?.icon}{" "}
            {INTENSITIES.find((it) => it.id === myEntry.intensity)?.label}的{EMOTIONS.find((e) => e.id === myEntry.emotion)?.label}
          </p>
          <p className="text-xs text-gray-600">{myEntry.note}</p>
        </div>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="emw-empty" className="text-center text-gray-400 py-8">還沒有人分享情緒</div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="emw-result" className="space-y-2">
          {state.entries.map((e, i) => {
            const emo = EMOTIONS.find((em) => em.id === e.emotion);
            const itst = INTENSITIES.find((it) => it.id === e.intensity);
            return (
              <div
                key={e.entryId}
                data-testid={`emw-card-${e.entryId}`}
                className={`p-3 rounded-xl border ${CARD_COLORS[i % CARD_COLORS.length]}`}
              >
                <p className="text-xs font-medium text-gray-500 mb-1">{e.userName}</p>
                <p className="text-sm font-medium text-gray-700">{emo?.icon} {itst?.label}的{emo?.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{e.note}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
