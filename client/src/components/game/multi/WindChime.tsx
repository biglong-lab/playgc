import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface WindChimeEntry {
  entryId: string;
  userId: string;
  userName: string;
  chimeNote: string;
  message: string;
}

interface WindChimeState extends Record<string, unknown> {
  entries: WindChimeEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: WindChimeState = { entries: [], revealed: false };

const CHIME_NOTES = [
  { id: "joy", label: "歡悅", icon: "🎵", desc: "心中流淌的快樂旋律" },
  { id: "peace", label: "平和", icon: "🎶", desc: "寧靜美好的內心境界" },
  { id: "longing", label: "思念", icon: "🎸", desc: "輕輕搖曳的懷念之情" },
  { id: "gratitude", label: "感恩", icon: "🎼", desc: "隨風傳遞的感謝之音" },
  { id: "hope", label: "希望", icon: "🎹", desc: "迎風而起的未來期許" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function WindChime({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<WindChimeState>({
    gameId,
    sessionId,
    pageId,
    type: "wind_chime",
    defaultState: DEFAULT_STATE,
  });

  const [selectedNote, setSelectedNote] = useState("joy");
  const [message, setMessage] = useState("");

  if (!isLoaded) return <div data-testid="wnc-loading">載入中...</div>;

  const title = config?.title ?? "風鈴";
  const prompt = config?.prompt ?? "讓心中的聲音隨風鈴飄揚，寫下此刻想傳遞的話語";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = message.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: WindChimeEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      chimeNote: selectedNote,
      message: message.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setMessage("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="wnc-title" className="text-2xl font-bold text-sky-600">
        {title}
      </h2>
      <p data-testid="wnc-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="wnc-count" className="text-sm text-gray-500">
        已掛上 {state.entries.length} 個風鈴
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="wnc-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {CHIME_NOTES.map((cn) => (
              <button
                key={cn.id}
                data-testid={`wnc-note-${cn.id}`}
                onClick={() => setSelectedNote(cn.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedNote === cn.id
                    ? "border-sky-500 bg-sky-50 text-sky-700"
                    : "border-gray-200 hover:border-sky-300"
                }`}
              >
                <div className="text-xl">{cn.icon}</div>
                <div className="text-xs font-medium">{cn.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{cn.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="wnc-message-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="寫下隨風傳遞的話語..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-sky-400 focus:outline-none"
          />
          <button
            data-testid="wnc-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-sky-500 text-white font-semibold disabled:opacity-40"
          >
            掛上風鈴 🎐
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="wnc-my-entry" className="p-4 bg-sky-50 rounded-xl border border-sky-200 space-y-1">
          <p className="text-sm text-sky-600 font-medium">
            {CHIME_NOTES.find((c) => c.id === myEntry.chimeNote)?.icon}{" "}
            {CHIME_NOTES.find((c) => c.id === myEntry.chimeNote)?.label}
          </p>
          <p className="text-gray-700">{myEntry.message}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="wnc-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-indigo-500 text-white font-semibold"
        >
          揭曉所有風鈴 🎐
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="wnc-empty" className="text-center text-gray-400 py-8">
          風鈴尚未響起
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="wnc-result" className="space-y-3">
          <h3 className="font-semibold text-sky-600">所有風鈴已響起</h3>
          {state.entries.map((entry) => {
            const cn = CHIME_NOTES.find((c) => c.id === entry.chimeNote);
            return (
              <div
                key={entry.entryId}
                data-testid={`wnc-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-sky-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{cn?.icon}</span>
                  <span className="font-medium text-sky-600">{cn?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
