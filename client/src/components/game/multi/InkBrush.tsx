import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface InkBrushEntry {
  entryId: string;
  userId: string;
  userName: string;
  brushStyle: string;
  expression: string;
}

interface InkBrushState extends Record<string, unknown> {
  entries: InkBrushEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: InkBrushState = { entries: [], revealed: false };

const BRUSH_STYLES = [
  { id: "bold_stroke", label: "濃墨重彩", icon: "🖌️", desc: "大膽奔放，力透紙背" },
  { id: "light_wash", label: "淡墨渲染", icon: "🎨", desc: "輕描淡寫，意境深遠" },
  { id: "fine_line", label: "細線勾描", icon: "✒️", desc: "精緻細膩，一絲不苟" },
  { id: "splatter", label: "潑墨揮灑", icon: "💦", desc: "隨性灑脫，渾然天成" },
  { id: "calligraphy", label: "書法正楷", icon: "📜", desc: "端正規整，氣度非凡" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function InkBrush({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<InkBrushState>({
    gameId,
    sessionId,
    pageId,
    type: "ink_brush",
    defaultState: DEFAULT_STATE,
  });

  const [selectedStyle, setSelectedStyle] = useState("bold_stroke");
  const [expression, setExpression] = useState("");

  if (!isLoaded) return <div data-testid="ikb-loading">載入中...</div>;

  const title = config?.title ?? "水墨揮毫";
  const prompt = config?.prompt ?? "拿起水墨筆，用你的筆法寫下此刻的心情";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = expression.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: InkBrushEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      brushStyle: selectedStyle,
      expression: expression.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setExpression("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="ikb-title" className="text-2xl font-bold text-slate-700">
        {title}
      </h2>
      <p data-testid="ikb-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="ikb-count" className="text-sm text-gray-500">
        已揮毫 {state.entries.length} 筆
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="ikb-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {BRUSH_STYLES.map((bs) => (
              <button
                key={bs.id}
                data-testid={`ikb-style-${bs.id}`}
                onClick={() => setSelectedStyle(bs.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedStyle === bs.id
                    ? "border-slate-500 bg-slate-50 text-slate-700"
                    : "border-gray-200 hover:border-slate-300"
                }`}
              >
                <div className="text-xl">{bs.icon}</div>
                <div className="text-xs font-medium">{bs.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{bs.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="ikb-expression-input"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="用文字揮灑你的心情..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-slate-400 focus:outline-none"
          />
          <button
            data-testid="ikb-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-slate-600 text-white font-semibold disabled:opacity-40"
          >
            落筆成墨 🖌️
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="ikb-my-entry" className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
          <p className="text-sm text-slate-600 font-medium">
            {BRUSH_STYLES.find((b) => b.id === myEntry.brushStyle)?.icon}{" "}
            {BRUSH_STYLES.find((b) => b.id === myEntry.brushStyle)?.label}
          </p>
          <p className="text-gray-700">{myEntry.expression}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ikb-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-semibold"
        >
          揭曉所有墨跡 🖌️
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="ikb-empty" className="text-center text-gray-400 py-8">
          宣紙上尚無墨跡
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="ikb-result" className="space-y-3">
          <h3 className="font-semibold text-slate-700">所有墨跡已揭曉</h3>
          {state.entries.map((entry) => {
            const bs = BRUSH_STYLES.find((b) => b.id === entry.brushStyle);
            return (
              <div
                key={entry.entryId}
                data-testid={`ikb-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-slate-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{bs?.icon}</span>
                  <span className="font-medium text-slate-700">{bs?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.expression}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
