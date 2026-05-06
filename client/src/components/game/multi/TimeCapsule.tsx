import { useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface CapsuleEntry {
  entryId: string;
  userId: string;
  userName: string;
  hope: string;
  commitment: string;
  openDate: string;
}

interface TimeCapsuleState extends Record<string, unknown> {
  entries: CapsuleEntry[];
  revealed: boolean;
}

interface TimeCapsuleConfig {
  title: string;
  prompt: string;
  openLabel: string;
}

function extractConfig(raw: Record<string, unknown>): TimeCapsuleConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "時光膠囊",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "寫一封信給未來的自己和團隊——你的期望與承諾",
    openLabel:
      typeof raw.openLabel === "string" ? raw.openLabel : "3 個月後開封",
  };
}

const DEFAULT_STATE: TimeCapsuleState = { entries: [], revealed: false };

const OPEN_DATE_OPTIONS = [
  "1 個月後",
  "3 個月後",
  "6 個月後",
  "1 年後",
  "這個專案結束時",
  "下次聚會時",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TimeCapsule({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<TimeCapsuleState>({
    gameId,
    sessionId,
    pageId,
    type: "time_capsule",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [hope, setHope] = useState("");
  const [commitment, setCommitment] = useState("");
  const [openDate, setOpenDate] = useState(OPEN_DATE_OPTIONS[1]);

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="tc-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = hope.trim().length >= 5 && commitment.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: CapsuleEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      hope: hope.trim(),
      commitment: commitment.trim(),
      openDate,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Archive className="w-5 h-5 text-amber-600" />
        <h2 className="text-xl font-bold" data-testid="tc-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="tc-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="tc-count">
        已封存：{state.entries.length} 份
      </p>

      {!myEntry ? (
        <div className="space-y-3" data-testid="tc-form">
          <div>
            <label className="text-xs font-medium text-amber-700 block mb-1">
              💛 對未來的期望（≥5字）
            </label>
            <textarea
              data-testid="tc-hope-input"
              className="w-full border rounded p-2 text-sm resize-none"
              rows={3}
              placeholder="我希望那時候，我們能夠…"
              maxLength={120}
              value={hope}
              onChange={(e) => setHope(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-teal-700 block mb-1">
              🤝 對自己的承諾（≥5字）
            </label>
            <textarea
              data-testid="tc-commitment-input"
              className="w-full border rounded p-2 text-sm resize-none"
              rows={3}
              placeholder="在那之前，我承諾自己會…"
              maxLength={120}
              value={commitment}
              onChange={(e) => setCommitment(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              📅 開封時間
            </label>
            <div data-testid="tc-opendate-picker" className="flex flex-wrap gap-2">
              {OPEN_DATE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  data-testid={`tc-date-${opt}`}
                  onClick={() => setOpenDate(opt)}
                  className={`px-2 py-1 text-xs rounded border transition-all ${
                    openDate === opt
                      ? "border-amber-500 bg-amber-50 text-amber-700 font-medium"
                      : "border-gray-200 text-gray-500 hover:border-amber-300"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <button
            data-testid="tc-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-amber-500 text-white rounded disabled:opacity-40 text-sm"
          >
            封存進膠囊
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-amber-50 rounded border border-amber-200 text-sm"
          data-testid="tc-my-entry"
        >
          <p className="text-xs text-amber-700 font-medium mb-2">
            你的膠囊（{myEntry.openDate}開封）
          </p>
          <p className="text-xs text-gray-600">💛 {myEntry.hope}</p>
          <p className="text-xs text-gray-600 mt-1">🤝 {myEntry.commitment}</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="tc-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示時光膠囊
        </button>
      )}

      {state.revealed && (
        <div data-testid="tc-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">⏳ 全隊時光膠囊</p>
          {state.entries.length === 0 ? (
            <p data-testid="tc-empty" className="text-gray-400 text-sm">尚無封存</p>
          ) : (
            state.entries.map((entry) => (
              <div
                key={entry.entryId}
                data-testid={`tc-card-${entry.entryId}`}
                className="p-3 bg-amber-50 border border-amber-200 rounded"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-amber-800">
                    {entry.userName}
                  </p>
                  <span className="text-xs text-gray-400">{entry.openDate}</span>
                </div>
                <p className="text-xs text-gray-600">💛 {entry.hope}</p>
                <p className="text-xs text-gray-600 mt-1">🤝 {entry.commitment}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default TimeCapsule;
