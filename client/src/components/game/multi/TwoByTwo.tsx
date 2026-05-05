import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface TwoByTwoPlacement extends Record<string, unknown> {
  placementId: string;
  userId: string;
  userName: string;
  label: string;
  x: number;
  y: number;
}

export interface TwoByTwoConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  xLowLabel: string;
  xHighLabel: string;
  yLowLabel: string;
  yHighLabel: string;
  itemLabel: string;
}

export interface TwoByTwoState extends Record<string, unknown> {
  placements: TwoByTwoPlacement[];
  revealed: boolean;
}

function extractConfig(raw: Record<string, unknown>): TwoByTwoConfig {
  return {
    title: (raw.title as string) || "2×2 優先矩陣",
    prompt: (raw.prompt as string) || "將你的想法放在最合適的位置",
    xLowLabel: (raw.xLowLabel as string) || "難以執行",
    xHighLabel: (raw.xHighLabel as string) || "容易執行",
    yLowLabel: (raw.yLowLabel as string) || "低影響",
    yHighLabel: (raw.yHighLabel as string) || "高影響",
    itemLabel: (raw.itemLabel as string) || "想法 / 計畫",
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TwoByTwo({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: TwoByTwoState = { placements: [], revealed: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<TwoByTwoState>({
    gameId,
    sessionId,
    pageId,
    type: "two_by_two",
    defaultState,
  });

  const [label, setLabel] = useState("");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="tb2-loading" />
      </div>
    );
  }

  const myPlacements = state.placements.filter((p) => p.userId === userId);

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((1 - (e.clientY - rect.top) / rect.height) * 100));
    setPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }

  function handleSubmit() {
    if (!label.trim() || !pos) return;
    const placementId = `${userId}-${Date.now()}`;
    const newPlacement: TwoByTwoPlacement = {
      placementId,
      userId,
      userName,
      label: label.trim(),
      x: pos.x,
      y: pos.y,
    };
    updateState({ ...state, placements: [...state.placements, newPlacement] });
    setLabel("");
    setPos(null);
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="tb2-title">{cfg.title}</h2>
      <p className="text-gray-600" data-testid="tb2-prompt">{cfg.prompt}</p>
      <p className="text-sm text-gray-500" data-testid="tb2-count">
        已放置：{state.placements.length} 個
      </p>

      {!state.revealed && (
        <div className="space-y-2">
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            placeholder={cfg.itemLabel}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            data-testid="tb2-label-input"
            maxLength={40}
          />
          {pos && (
            <p className="text-xs text-blue-600" data-testid="tb2-pos-hint">
              位置：X {pos.x}%, Y {pos.y}%（點擊矩陣調整）
            </p>
          )}
          <div
            ref={gridRef}
            className="relative w-full aspect-square border-2 border-gray-300 rounded cursor-crosshair bg-white"
            onClick={handleGridClick}
            data-testid="tb2-grid"
          >
            <div className="absolute inset-0 border-r border-b border-gray-200"
              style={{ width: "50%", height: "50%", top: "50%", left: "50%", borderTop: "1px solid #e5e7eb", borderLeft: "1px solid #e5e7eb" }} />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-300" />
            <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-gray-300" />
            <span className="absolute top-1 left-1 text-xs text-gray-400">{cfg.yHighLabel}</span>
            <span className="absolute bottom-1 left-1 text-xs text-gray-400">{cfg.yLowLabel}</span>
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-gray-400">{cfg.xLowLabel}</span>
            <span className="absolute bottom-1 right-1 text-xs text-gray-400">{cfg.xHighLabel}</span>
            {pos && (
              <div
                className="absolute w-3 h-3 bg-blue-500 rounded-full -translate-x-1/2 translate-y-1/2 pointer-events-none"
                style={{ left: `${pos.x}%`, bottom: `${pos.y}%` }}
                data-testid="tb2-cursor"
              />
            )}
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={!label.trim() || !pos}
            onClick={handleSubmit}
            data-testid="tb2-submit-btn"
          >
            放置
          </button>
        </div>
      )}

      {myPlacements.length > 0 && (
        <div data-testid="tb2-my-placements">
          <p className="text-sm font-semibold">我的放置：</p>
          {myPlacements.map((p) => (
            <span
              key={p.placementId}
              className="inline-block mr-2 text-xs bg-blue-100 rounded px-2 py-1 mt-1"
              data-testid={`tb2-my-${p.placementId}`}
            >
              {p.label}（{p.x},{p.y}）
            </span>
          ))}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={handleReveal}
          data-testid="tb2-reveal-btn"
        >
          公開結果
        </button>
      )}

      {state.revealed && (
        <div data-testid="tb2-result">
          <h3 className="font-semibold mb-2">矩陣結果</h3>
          <div className="relative w-full aspect-square border-2 border-gray-300 rounded bg-white">
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-300" />
            <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-gray-300" />
            <span className="absolute top-1 left-1 text-xs text-gray-400">{cfg.yHighLabel}</span>
            <span className="absolute bottom-1 right-1 text-xs text-gray-400">{cfg.xHighLabel}</span>
            {state.placements.map((p) => (
              <div
                key={p.placementId}
                className="absolute -translate-x-1/2 translate-y-1/2 cursor-default"
                style={{ left: `${p.x}%`, bottom: `${p.y}%` }}
                data-testid={`tb2-dot-${p.placementId}`}
              >
                <div className="w-3 h-3 bg-purple-500 rounded-full" title={`${p.label} (${p.userName})`} />
                <span className="absolute left-4 top-0 text-xs whitespace-nowrap bg-white border rounded px-1">
                  {p.label}
                </span>
              </div>
            ))}
          </div>
          {state.placements.length === 0 && (
            <p className="text-gray-400 text-center py-4" data-testid="tb2-empty">尚無放置</p>
          )}
        </div>
      )}
    </div>
  );
}

export default TwoByTwo;
