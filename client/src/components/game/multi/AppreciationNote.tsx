import { useState, useEffect } from "react";
import { Heart, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface NoteEntry {
  entryId: string;
  fromUserId: string;
  fromUserName: string;
  toUserName: string;
  note: string;
}

interface AppreciationNoteState extends Record<string, unknown> {
  entries: NoteEntry[];
  participants: string[];
  revealed: boolean;
}

interface AppreciationNoteConfig {
  title: string;
  prompt: string;
  placeholder: string;
}

function extractConfig(raw: Record<string, unknown>): AppreciationNoteConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "感謝便條",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "寫一張感謝便條給一位隊友，說說他/她讓你印象深刻的地方：",
    placeholder:
      typeof raw.placeholder === "string"
        ? raw.placeholder
        : "謝謝你的...",
  };
}

const NOTE_COLORS = [
  "bg-rose-50 border-rose-200",
  "bg-violet-50 border-violet-200",
  "bg-sky-50 border-sky-200",
  "bg-amber-50 border-amber-200",
  "bg-emerald-50 border-emerald-200",
  "bg-pink-50 border-pink-200",
];

const DEFAULT_STATE: AppreciationNoteState = {
  entries: [],
  participants: [],
  revealed: false,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function AppreciationNote({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<AppreciationNoteState>({
    gameId,
    sessionId,
    pageId,
    type: "appreciation_note",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [toName, setToName] = useState("");
  const [note, setNote] = useState("");
  const [customTo, setCustomTo] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="an-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.fromUserId === userId);
  const canSubmit = (toName.trim().length > 0 || customTo.trim().length > 0) && note.trim().length >= 3;

  function registerParticipant() {
    if (state.participants.includes(userName)) return;
    updateState({
      ...state,
      participants: [...state.participants, userName],
    });
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const recipient = toName.trim() || customTo.trim();
    const entry: NoteEntry = {
      entryId: `${userId}-${Date.now()}`,
      fromUserId: userId,
      fromUserName: userName,
      toUserName: recipient,
      note: note.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  useEffect(() => {
    if (isLoaded && !state.participants.includes(userName)) {
      registerParticipant();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const participants = state.participants.filter((p) => p !== userName);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Heart className="w-5 h-5 text-rose-500" />
        <h2 className="text-xl font-bold" data-testid="an-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="an-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="an-count">
        已送出：{state.entries.length} 張
      </p>

      {!myEntry ? (
        <div className="space-y-3">
          {participants.length > 0 && (
            <div data-testid="an-participants" className="space-y-1">
              <p className="text-xs text-gray-500">選擇隊友：</p>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <button
                    key={p}
                    data-testid={`an-pick-${p}`}
                    onClick={() => { setToName(p); setCustomTo(""); }}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                      toName === p
                        ? "bg-rose-500 text-white border-rose-500"
                        : "bg-white text-gray-600 border-gray-200 hover:border-rose-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <input
              data-testid="an-to-input"
              className="flex-1 border rounded p-2 text-sm"
              placeholder="或輸入隊友名字..."
              maxLength={20}
              value={customTo}
              onChange={(e) => { setCustomTo(e.target.value); setToName(""); }}
            />
          </div>
          <textarea
            data-testid="an-note-input"
            className="w-full border border-rose-200 rounded p-2 text-sm resize-none h-20"
            placeholder={cfg.placeholder}
            maxLength={120}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            data-testid="an-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-rose-500 text-white rounded disabled:opacity-40 text-sm"
          >
            送出感謝 💌
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-rose-50 rounded border border-rose-200 text-sm space-y-1"
          data-testid="an-my-entry"
        >
          <p className="text-xs text-gray-500">
            給 <span className="font-semibold text-rose-600">{myEntry.toUserName}</span>
          </p>
          <p className="text-gray-700 italic">「{myEntry.note}」</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="an-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊感謝
        </button>
      )}

      {state.revealed && (
        <div data-testid="an-result" className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">💌 感謝便條牆</p>
          {state.entries.length === 0 ? (
            <p data-testid="an-empty" className="text-gray-400 text-sm">
              尚無感謝便條
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {state.entries.map((entry, i) => (
                <div
                  key={entry.entryId}
                  data-testid={`an-card-${entry.entryId}`}
                  className={`rounded-lg border p-3 text-sm space-y-1 ${NOTE_COLORS[i % NOTE_COLORS.length]}`}
                >
                  <p className="text-xs text-gray-500">
                    {entry.fromUserName} → <span className="font-semibold">{entry.toUserName}</span>
                  </p>
                  <p className="text-gray-700 text-xs italic">「{entry.note}」</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AppreciationNote;
