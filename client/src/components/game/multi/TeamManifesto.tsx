import { useState } from "react";
import { Loader2, Send, Eye } from "lucide-react";

export interface ManifestoEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  phrase: string;
}

export interface TeamManifestoConfig extends Record<string, unknown> {
  title: string;
  stem: string;
  placeholder: string;
  maxLength: number;
  maxPerUser: number;
}

export interface TeamManifestoState extends Record<string, unknown> {
  entries: ManifestoEntry[];
  revealed: boolean;
}

interface TeamManifestoProps {
  config: TeamManifestoConfig;
  state: TeamManifestoState;
  userId: string;
  isTeamLead?: boolean;
  isLoaded: boolean;
  onSubmit: (phrase: string) => void;
  onReveal: () => void;
}

export function TeamManifesto({
  config,
  state,
  userId,
  isTeamLead,
  isLoaded,
  onSubmit,
  onReveal,
}: TeamManifestoProps) {
  const [phrase, setPhrase] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    );
  }

  const { title, stem, placeholder, maxLength, maxPerUser } = config;
  const { entries, revealed } = state;

  const myEntries = entries.filter((e) => e.userId === userId);
  const canSubmit = myEntries.length < maxPerUser && phrase.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(phrase.trim());
    setPhrase("");
  }

  const COLORS = [
    "bg-emerald-100 text-emerald-800 border-emerald-300",
    "bg-blue-100 text-blue-800 border-blue-300",
    "bg-purple-100 text-purple-800 border-purple-300",
    "bg-orange-100 text-orange-800 border-orange-300",
    "bg-pink-100 text-pink-800 border-pink-300",
    "bg-yellow-100 text-yellow-800 border-yellow-300",
    "bg-teal-100 text-teal-800 border-teal-300",
    "bg-red-100 text-red-800 border-red-300",
  ];

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="tm-title" className="text-xl font-bold text-center text-emerald-700">
        {title}
      </h2>

      <div
        data-testid="tm-stem"
        className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center text-base font-semibold text-emerald-800"
      >
        {stem}
      </div>

      <p data-testid="tm-count" className="text-sm text-gray-500 text-center">
        已收集 {entries.length} 個關鍵詞
      </p>

      {myEntries.length < maxPerUser && !revealed && (
        <div className="flex gap-2">
          <input
            data-testid="tm-input"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value.slice(0, maxLength))}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={placeholder}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            data-testid="tm-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      )}

      {myEntries.length > 0 && (
        <div data-testid="tm-my-entries" className="flex flex-wrap gap-1">
          {myEntries.map((e) => (
            <span
              key={e.entryId}
              data-testid={`tm-my-${e.entryId}`}
              className="bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full px-3 py-1 text-xs font-medium"
            >
              {e.phrase}
            </span>
          ))}
        </div>
      )}

      {isTeamLead && !revealed && entries.length > 0 && (
        <button
          data-testid="tm-reveal-btn"
          onClick={onReveal}
          className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-white py-2 rounded-xl text-sm font-medium"
        >
          <Eye size={16} />
          公開團隊宣言
        </button>
      )}

      {revealed && (
        <div data-testid="tm-result" className="space-y-3">
          <p className="text-center font-bold text-emerald-700 text-lg">{stem}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {entries.length === 0 && (
              <p data-testid="tm-empty" className="text-gray-400 text-sm">
                還沒有人填寫
              </p>
            )}
            {entries.map((e, i) => (
              <span
                key={e.entryId}
                data-testid={`tm-entry-${e.entryId}`}
                className={`border rounded-full px-4 py-2 text-sm font-semibold ${
                  COLORS[i % COLORS.length]
                }`}
              >
                {e.phrase}
              </span>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400">
            {entries.length} 個詞語，{new Set(entries.map((e) => e.userId)).size} 人貢獻
          </p>
        </div>
      )}
    </div>
  );
}

export default TeamManifesto;
