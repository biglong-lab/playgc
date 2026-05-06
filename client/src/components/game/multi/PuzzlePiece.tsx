import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface PuzzleEntry {
  entryId: string;
  userId: string;
  userName: string;
  pieceType: string;
  contribution: string;
}

interface PuzzlePieceState extends Record<string, unknown> {
  entries: PuzzleEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: PuzzlePieceState = { entries: [], revealed: false };

const PIECE_TYPES = [
  { id: "corner", label: "角落塊", icon: "🔲", desc: "穩定的根基與基礎" },
  { id: "edge", label: "邊緣塊", icon: "📐", desc: "連接不同群體的橋梁" },
  { id: "center", label: "核心塊", icon: "💎", desc: "推動整體的核心力量" },
  { id: "detail", label: "細節塊", icon: "🔍", desc: "精準執行每個細節" },
  { id: "bridge", label: "橋接塊", icon: "🌉", desc: "跨域整合的連結者" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function PuzzlePiece({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<PuzzlePieceState>({
    gameId,
    sessionId,
    pageId,
    type: "puzzle_piece",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedPiece, setSelectedPiece] = useState("corner");
  const [contribution, setContribution] = useState("");

  if (!isLoaded) return <div data-testid="pzp-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "我是哪塊拼圖";
  const prompt = config?.prompt ?? "在團隊這幅大圖裡，你是哪一塊拼圖？";
  const entries = (state.entries ?? []) as PuzzleEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = contribution.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: PuzzleEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      pieceType: selectedPiece,
      contribution: contribution.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setContribution("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="pzp-title" className="text-xl font-bold text-center text-cyan-700">{title}</h2>
      <p data-testid="pzp-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="pzp-count" className="text-center text-xs text-gray-400">已拼入：{entries.length} 塊</p>

      {!myEntry && !revealed && (
        <div data-testid="pzp-form" className="space-y-3">
          <div data-testid="pzp-piece-grid" className="grid grid-cols-1 gap-2">
            {PIECE_TYPES.map((p) => (
              <button
                key={p.id}
                data-testid={`pzp-piece-${p.id}`}
                onClick={() => setSelectedPiece(p.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedPiece === p.id ? "bg-cyan-100 border-cyan-400" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{p.icon}</span>
                <div>
                  <p className="font-medium text-sm">{p.label}</p>
                  <p className="text-xs text-gray-500">{p.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="pzp-contribution-input"
            value={contribution}
            onChange={(e) => setContribution(e.target.value)}
            placeholder="說說你為這幅拼圖帶來什麼（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <button
            data-testid="pzp-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-cyan-600 text-white font-medium disabled:opacity-40"
          >
            拼入圖中
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="pzp-my-entry" className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
          <p className="text-sm font-medium text-cyan-700">我的拼圖塊已放入</p>
          <p className="text-xs text-gray-500 mt-1">{PIECE_TYPES.find((p) => p.id === myEntry.pieceType)?.label} — {myEntry.contribution}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="pzp-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          完成拼圖
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="pzp-empty" className="text-center text-gray-400 py-8">拼圖還是空白的</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="pzp-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`pzp-card-${e.entryId}`} className="bg-white border border-cyan-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{PIECE_TYPES.find((p) => p.id === e.pieceType)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full">{PIECE_TYPES.find((p) => p.id === e.pieceType)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.contribution}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
