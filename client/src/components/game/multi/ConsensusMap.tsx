import { useState } from "react";
import { Map, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── 型別 ──────────────────────────────────────────────
export interface ConsensusMapEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  topic: string;
  feasibility: number;
  importance: number;
}

export interface ConsensusMapConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  topics: string[];
  xLabel: string;
  yLabel: string;
  axisMin: number;
  axisMax: number;
}

export interface ConsensusMapState extends Record<string, unknown> {
  entries: ConsensusMapEntry[];
  revealed: boolean;
}

interface Props {
  config: ConsensusMapConfig;
  state: ConsensusMapState;
  userId: string;
  isTeamLead?: boolean;
  onSubmit: (topic: string, feasibility: number, importance: number) => void;
  onReveal: () => void;
}

const QUADRANT_LABELS: Record<string, string> = {
  "high-high": "🌟 優先執行",
  "low-high": "📋 需要規劃",
  "high-low": "⚡ 快速行動",
  "low-low": "🗃 暫時擱置",
};

function quadrant(feasibility: number, importance: number, mid: number): string {
  const f = feasibility >= mid ? "high" : "low";
  const i = importance >= mid ? "high" : "low";
  return `${f}-${i}`;
}

// ── 元件 ──────────────────────────────────────────────
export function ConsensusMap({
  config,
  state,
  userId,
  isTeamLead,
  onSubmit,
  onReveal,
}: Props) {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [feasibility, setFeasibility] = useState<number>(3);
  const [importance, setImportance] = useState<number>(3);

  const myEntry = state.entries.find((e) => e.userId === userId);
  const hasSubmitted = !!myEntry;

  const mid = Math.ceil((config.axisMin + config.axisMax) / 2);
  const steps = Array.from(
    { length: config.axisMax - config.axisMin + 1 },
    (_, i) => config.axisMin + i,
  );

  function handleSubmit() {
    if (!selectedTopic) return;
    onSubmit(selectedTopic, feasibility, importance);
  }

  const grouped = state.entries.reduce<Record<string, ConsensusMapEntry[]>>(
    (acc, e) => {
      const q = quadrant(e.feasibility, e.importance, mid);
      if (!acc[q]) acc[q] = [];
      acc[q].push(e);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Map className="h-5 w-5 text-blue-500" />
        <h3 className="font-bold text-lg" data-testid="cm-title">
          {config.title}
        </h3>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="cm-prompt">
        {config.prompt}
      </p>

      <Badge variant="outline" data-testid="cm-count">
        {state.entries.length} 人已填寫
      </Badge>

      {!hasSubmitted && (
        <div className="space-y-4 border rounded-lg p-4">
          {/* 選主題 */}
          <div>
            <p className="text-sm font-medium mb-2">選擇評估主題</p>
            <div className="flex flex-wrap gap-2">
              {config.topics.map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={selectedTopic === t ? "default" : "outline"}
                  onClick={() => setSelectedTopic(t)}
                  data-testid={`cm-topic-${t}`}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>

          {/* 可行性 X */}
          <div>
            <p className="text-sm font-medium mb-1">
              {config.xLabel}（{feasibility}）
            </p>
            <div className="flex gap-1">
              {steps.map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={feasibility === v ? "default" : "outline"}
                  onClick={() => setFeasibility(v)}
                  data-testid={`cm-feasibility-${v}`}
                  className="flex-1"
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>

          {/* 重要性 Y */}
          <div>
            <p className="text-sm font-medium mb-1">
              {config.yLabel}（{importance}）
            </p>
            <div className="flex gap-1">
              {steps.map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={importance === v ? "default" : "outline"}
                  onClick={() => setImportance(v)}
                  data-testid={`cm-importance-${v}`}
                  className="flex-1"
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!selectedTopic}
            className="w-full"
            data-testid="cm-submit-btn"
          >
            提交評估
          </Button>
        </div>
      )}

      {hasSubmitted && (
        <div
          className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20"
          data-testid="cm-my-entry"
        >
          <p className="text-xs text-muted-foreground mb-1">我的評估</p>
          <p className="font-medium">{myEntry!.topic}</p>
          <p className="text-sm">
            {config.xLabel}: <strong>{myEntry!.feasibility}</strong> ／{" "}
            {config.yLabel}: <strong>{myEntry!.importance}</strong>
          </p>
        </div>
      )}

      {!state.revealed && state.entries.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4" data-testid="cm-empty">
          還沒有人填寫評估
        </p>
      )}

      {state.revealed && (
        <div className="space-y-3" data-testid="cm-result">
          <p className="text-sm font-semibold flex items-center gap-1">
            <Target className="h-4 w-4 text-blue-500" />
            共識地圖
          </p>
          {state.entries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="cm-empty">
              沒有評估資料
            </p>
          )}
          {(["high-high", "low-high", "high-low", "low-low"] as const).map((q) => {
            const items = grouped[q] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={q} className="border rounded-lg p-3" data-testid={`cm-quadrant-${q}`}>
                <p className="text-sm font-medium mb-2">{QUADRANT_LABELS[q]}</p>
                {items.map((e) => (
                  <div
                    key={e.entryId}
                    className="flex items-center gap-2 text-sm"
                    data-testid={`cm-entry-${e.entryId}`}
                  >
                    <span className="font-medium">{e.topic}</span>
                    <span className="text-muted-foreground">
                      — {e.userName} (可行:{e.feasibility} 重要:{e.importance})
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {isTeamLead && !state.revealed && state.entries.length > 0 && (
        <Button
          onClick={onReveal}
          className="w-full"
          data-testid="cm-reveal-btn"
        >
          揭曉共識地圖
        </Button>
      )}
    </div>
  );
}

export default ConsensusMap;
