import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface HeatVote extends Record<string, unknown> {
  voteId: string;
  userId: string;
  userName: string;
  row: number;
  col: number;
}

export interface HeatMapConfig extends Record<string, unknown> {
  title: string;
  rowLabels: string[];
  colLabels: string[];
}

export interface HeatMapState extends Record<string, unknown> {
  votes: HeatVote[];
  revealed: boolean;
}

interface HeatMapProps {
  config: HeatMapConfig;
  state: HeatMapState;
  myUserId: string;
  onVote: (row: number, col: number) => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: HeatMapConfig = {
  title: "熱區投票",
  rowLabels: ["高", "低"],
  colLabels: ["快", "慢"],
};

function extractConfig(raw: unknown): HeatMapConfig {
  const r = raw as Record<string, unknown>;
  if (r && "rowLabels" in r && Array.isArray(r.rowLabels)) return r as unknown as HeatMapConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("rowLabels" in c && Array.isArray(c.rowLabels)) return c as unknown as HeatMapConfig;
  }
  return DEFAULT_CONFIG;
}

export default function HeatMap({ config: rawConfig, state, myUserId, onVote, onReveal }: HeatMapProps) {
  const config = extractConfig(rawConfig as unknown);
  const { rowLabels, colLabels } = config;
  const [pending, setPending] = useState<{ row: number; col: number } | null>(null);

  const myVote = state.votes.find((v) => v.userId === myUserId);

  function handleVote(row: number, col: number) {
    if (myVote) return;
    setPending({ row, col });
    onVote(row, col);
  }

  function cellCount(row: number, col: number) {
    return state.votes.filter((v) => v.row === row && v.col === col).length;
  }

  const maxCount = Math.max(1, ...rowLabels.flatMap((_, r) => colLabels.map((_, c) => cellCount(r, c))));

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="hm-result">
        <h2 className="text-xl font-bold" data-testid="hm-title">{config.title}</h2>
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-sm">
            <thead>
              <tr>
                <th className="p-2" />
                {colLabels.map((c, ci) => (
                  <th key={ci} className="p-2 text-center" data-testid={`hm-col-${ci}`}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowLabels.map((r, ri) => (
                <tr key={ri}>
                  <td className="p-2 font-medium" data-testid={`hm-row-${ri}`}>{r}</td>
                  {colLabels.map((_, ci) => {
                    const count = cellCount(ri, ci);
                    const heat = Math.round((count / maxCount) * 100);
                    return (
                      <td
                        key={ci}
                        className="p-2 text-center border"
                        style={{ backgroundColor: `rgba(239,68,68,${heat / 100})` }}
                        data-testid={`hm-cell-${ri}-${ci}`}
                      >
                        {count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="hm-total">共 {state.votes.length} 票</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="hm-title">{config.title}</h2>
      <p className="text-sm text-muted-foreground" data-testid="hm-count">已投票：{state.votes.length} 人</p>

      {myVote ? (
        <div className="p-3 rounded bg-muted text-sm" data-testid="hm-my-vote">
          你選了：{rowLabels[myVote.row]} × {colLabels[myVote.col]}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-sm">
            <thead>
              <tr>
                <th className="p-2" />
                {colLabels.map((c, ci) => (
                  <th key={ci} className="p-2 text-center">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowLabels.map((r, ri) => (
                <tr key={ri}>
                  <td className="p-2 font-medium">{r}</td>
                  {colLabels.map((_, ci) => {
                    const sel = pending?.row === ri && pending?.col === ci;
                    return (
                      <td key={ci} className="p-1">
                        <button
                          className={`w-12 h-12 border rounded hover:bg-primary/10 ${sel ? "bg-primary/20 font-bold" : ""}`}
                          onClick={() => handleVote(ri, ci)}
                          data-testid={`hm-btn-${ri}-${ci}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="hm-reveal-btn">
        公布結果
      </Button>
    </div>
  );
}
