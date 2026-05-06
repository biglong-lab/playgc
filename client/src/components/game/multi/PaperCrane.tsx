import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface PaperCraneEntry {
  entryId: string;
  userId: string;
  userName: string;
  craneType: string;
  wish: string;
}

interface PaperCraneState extends Record<string, unknown> {
  entries: PaperCraneEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: PaperCraneState = { entries: [], revealed: false };

const CRANE_TYPES = [
  { id: "thousand_cranes", label: "千羽鶴", icon: "🕊️", desc: "千隻折成，願望必達" },
  { id: "peace_crane", label: "和平之鶴", icon: "☮️", desc: "展翅飛翔，傳遞和平" },
  { id: "love_crane", label: "愛戀之鶴", icon: "💚", desc: "寄託深情，傳遞愛意" },
  { id: "wish_crane", label: "願望之鶴", icon: "✨", desc: "承載心願，飛向天際" },
  { id: "gratitude_crane", label: "感謝之鶴", icon: "🙏", desc: "摺疊感恩，以鶴相贈" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function PaperCrane({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<PaperCraneState>({
    gameId,
    sessionId,
    pageId,
    type: "paper_crane",
    defaultState: DEFAULT_STATE,
  });

  const [selectedCrane, setSelectedCrane] = useState("thousand_cranes");
  const [wish, setWish] = useState("");

  if (!isLoaded) return <div data-testid="prc-loading">載入中...</div>;

  const title = config?.title ?? "千羽鶴心願";
  const prompt = config?.prompt ?? "折一隻紙鶴，讓它帶走你心中最深的願望";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = wish.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: PaperCraneEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      craneType: selectedCrane,
      wish: wish.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setWish("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="prc-title" className="text-2xl font-bold text-emerald-700">
        {title}
      </h2>
      <p data-testid="prc-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="prc-count" className="text-sm text-gray-500">
        已折 {state.entries.length} 隻紙鶴
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="prc-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {CRANE_TYPES.map((ct) => (
              <button
                key={ct.id}
                data-testid={`prc-crane-${ct.id}`}
                onClick={() => setSelectedCrane(ct.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedCrane === ct.id
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 hover:border-emerald-300"
                }`}
              >
                <div className="text-xl">{ct.icon}</div>
                <div className="text-xs font-medium">{ct.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{ct.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="prc-wish-input"
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            placeholder="寫下你折入紙鶴的心願..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-emerald-400 focus:outline-none"
          />
          <button
            data-testid="prc-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-emerald-500 text-white font-semibold disabled:opacity-40"
          >
            放飛紙鶴 🕊️
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="prc-my-entry" className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
          <p className="text-sm text-emerald-600 font-medium">
            {CRANE_TYPES.find((c) => c.id === myEntry.craneType)?.icon}{" "}
            {CRANE_TYPES.find((c) => c.id === myEntry.craneType)?.label}
          </p>
          <p className="text-gray-700">{myEntry.wish}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="prc-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-teal-600 text-white font-semibold"
        >
          揭曉所有心願 🕊️
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="prc-empty" className="text-center text-gray-400 py-8">
          尚無紙鶴飛起
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="prc-result" className="space-y-3">
          <h3 className="font-semibold text-emerald-700">所有心願已揭曉</h3>
          {state.entries.map((entry) => {
            const ct = CRANE_TYPES.find((c) => c.id === entry.craneType);
            return (
              <div
                key={entry.entryId}
                data-testid={`prc-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-emerald-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{ct?.icon}</span>
                  <span className="font-medium text-emerald-700">{ct?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.wish}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
