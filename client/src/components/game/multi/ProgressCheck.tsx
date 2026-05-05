import { useState } from "react";

export interface ProgressReport extends Record<string, unknown> {
  reportId: string;
  userId: string;
  userName: string;
  percent: number;
  note: string;
}

export interface ProgressCheckConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  showNotes: boolean;
}

export interface ProgressCheckState extends Record<string, unknown> {
  reports: ProgressReport[];
  revealed: boolean;
}

const DEFAULT_CONFIG: ProgressCheckConfig = {
  title: "進度確認",
  prompt: "這項任務你完成了多少？",
  showNotes: true,
};

const PERCENT_OPTIONS = [0, 25, 50, 75, 100];

interface Props {
  config: ProgressCheckConfig;
  state: ProgressCheckState;
  myUserId: string;
  onSubmit: (percent: number, note: string) => void;
  onReveal: () => void;
}

export default function ProgressCheck({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
}: Props) {
  const [selectedPercent, setSelectedPercent] = useState(50);
  const [note, setNote] = useState("");

  const { title, prompt, showNotes } = config || DEFAULT_CONFIG;
  const { reports, revealed } = state;

  const myReport = reports.find((r) => r.userId === myUserId);

  const avgPercent =
    reports.length > 0
      ? Math.round(reports.reduce((s, r) => s + r.percent, 0) / reports.length)
      : null;

  function handleSubmit() {
    onSubmit(selectedPercent, note.trim());
    setNote("");
  }

  function colorForPercent(p: number) {
    if (p >= 75) return "text-green-600 bg-green-100";
    if (p >= 50) return "text-blue-600 bg-blue-100";
    if (p >= 25) return "text-amber-600 bg-amber-100";
    return "text-red-600 bg-red-100";
  }

  function barColorForPercent(p: number) {
    if (p >= 75) return "bg-green-400";
    if (p >= 50) return "bg-blue-400";
    if (p >= 25) return "bg-amber-400";
    return "bg-red-400";
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="pc-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <p data-testid="pc-prompt" className="text-sm text-gray-600 text-center">
        {prompt}
      </p>

      {!revealed && (
        <div className="space-y-3">
          {!myReport ? (
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-1">
                {PERCENT_OPTIONS.map((p) => (
                  <button
                    key={p}
                    data-testid={`pc-pct-${p}`}
                    onClick={() => setSelectedPercent(p)}
                    className={`py-2 rounded-lg text-xs font-bold transition-colors border ${
                      selectedPercent === p
                        ? `${colorForPercent(p)} ring-2 ring-offset-1 ring-current`
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>

              {showNotes && (
                <input
                  data-testid="pc-note-input"
                  type="text"
                  value={note}
                  onChange={(e) => {
                    if (e.target.value.length <= 60) setNote(e.target.value);
                  }}
                  placeholder="補充說明（可選）..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              )}

              <button
                data-testid="pc-submit-btn"
                onClick={handleSubmit}
                className="w-full py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600"
              >
                回報進度
              </button>
            </div>
          ) : (
            <div data-testid="pc-my-report" className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
              <p className="text-xs text-indigo-400 mb-1">✅ 你的回報</p>
              <p className="text-2xl font-bold text-indigo-600">{myReport.percent}%</p>
              {myReport.note && (
                <p className="text-xs text-gray-500 mt-1">{myReport.note}</p>
              )}
            </div>
          )}

          <p className="text-xs text-center text-gray-400">
            已有 <span data-testid="pc-count">{reports.length}</span> 人回報
          </p>

          <div className="text-center">
            <button
              data-testid="pc-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布進度結果
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div data-testid="pc-result" className="space-y-3">
          {reports.length === 0 ? (
            <div data-testid="pc-empty" className="text-center text-gray-400 py-8">
              尚無人回報
            </div>
          ) : (
            <>
              {avgPercent !== null && (
                <div className="text-center">
                  <p data-testid="pc-avg" className="text-3xl font-bold text-indigo-600">
                    {avgPercent}%
                  </p>
                  <p className="text-xs text-gray-400">團隊平均進度</p>
                  <div className="mt-2 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      data-testid="pc-avg-bar"
                      className={`h-3 rounded-full ${barColorForPercent(avgPercent)}`}
                      style={{ width: `${avgPercent}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1 pt-2">
                {reports.map((r) => (
                  <div
                    key={r.reportId}
                    data-testid={`pc-report-${r.reportId}`}
                    className="flex items-center gap-2"
                  >
                    <span className="text-xs text-gray-500 w-16 truncate">{r.userName}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-4 rounded-full ${barColorForPercent(r.percent)}`}
                        style={{ width: `${r.percent}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-8 text-right ${colorForPercent(r.percent).split(" ")[0]}`}>
                      {r.percent}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
