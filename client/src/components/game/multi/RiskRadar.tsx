import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

type RiskLevel = "high" | "medium" | "low";

interface RiskEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  level: RiskLevel;
}

interface RiskRadarState extends Record<string, unknown> {
  risks: RiskEntry[];
  revealed: boolean;
}

interface RiskRadarConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): RiskRadarConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "風險雷達",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "你認為這個專案/計畫最大的風險是什麼？",
  };
}

const LEVEL_CONFIG: Record<RiskLevel, { label: string; bg: string; border: string; text: string; badge: string; emoji: string }> = {
  high: { label: "高", bg: "bg-red-50", border: "border-red-300", text: "text-red-700", badge: "bg-red-500", emoji: "🔴" },
  medium: { label: "中", bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", badge: "bg-amber-500", emoji: "🟡" },
  low: { label: "低", bg: "bg-green-50", border: "border-green-300", text: "text-green-700", badge: "bg-green-500", emoji: "🟢" },
};

export interface RiskRadarProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function RiskRadar({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: RiskRadarProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<RiskRadarState>({
    gameId,
    sessionId,
    pageId,
    type: "risk_radar",
    defaultState: { risks: [], revealed: false },
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<RiskLevel>("medium");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="rr-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myRisk = state.risks.find((r) => r.userId === userId);

  function handleSubmit() {
    if (!title.trim() || myRisk) return;
    const entry: RiskEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      title: title.trim(),
      description: description.trim(),
      level,
    };
    updateState({ ...state, risks: [...state.risks, entry] });
    setTitle("");
    setDescription("");
    setLevel("medium");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const highRisks = state.risks.filter((r) => r.level === "high");
  const mediumRisks = state.risks.filter((r) => r.level === "medium");
  const lowRisks = state.risks.filter((r) => r.level === "low");

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <AlertTriangle className="w-6 h-6 text-amber-500" />
        <h2 className="text-xl font-bold" data-testid="rr-title">
          {cfg.title ?? "風險雷達"}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="rr-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="rr-count">
        已回報：{state.risks.length} 個風險
      </p>

      {!myRisk && !state.revealed && (
        <div className="flex flex-col gap-3">
          <Input
            placeholder="風險名稱"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            data-testid="rr-title-input"
          />
          <Textarea
            placeholder="風險說明（選填）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={150}
            data-testid="rr-desc-input"
          />
          <div className="flex gap-2" data-testid="rr-level-group">
            {(["high", "medium", "low"] as RiskLevel[]).map((lv) => {
              const c = LEVEL_CONFIG[lv];
              return (
                <button
                  key={lv}
                  onClick={() => setLevel(lv)}
                  data-testid={`rr-level-${lv}`}
                  className={`flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition-all ${
                    level === lv
                      ? `${c.border} ${c.bg} ${c.text} scale-105`
                      : "border-muted bg-background text-muted-foreground"
                  }`}
                >
                  {c.emoji} {c.label}風險
                </button>
              );
            })}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="w-full"
            data-testid="rr-submit-btn"
          >
            回報風險
          </Button>
        </div>
      )}

      {myRisk && (
        <div className={`p-3 rounded-xl border text-sm ${LEVEL_CONFIG[myRisk.level].bg} ${LEVEL_CONFIG[myRisk.level].border}`} data-testid="rr-my-risk">
          <p className={`font-semibold ${LEVEL_CONFIG[myRisk.level].text}`}>
            {LEVEL_CONFIG[myRisk.level].emoji} {myRisk.title}
          </p>
          {myRisk.description && <p className="text-muted-foreground mt-1 text-xs">{myRisk.description}</p>}
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-4" data-testid="rr-result">
          {([
            ["high", highRisks],
            ["medium", mediumRisks],
            ["low", lowRisks],
          ] as [RiskLevel, RiskEntry[]][]).map(([lv, risks]) => {
            const c = LEVEL_CONFIG[lv];
            return (
              <div key={lv} data-testid={`rr-section-${lv}`} className={`rounded-xl border ${c.border} ${c.bg} p-3`}>
                <p className={`text-sm font-bold mb-2 ${c.text}`}>
                  {c.emoji} {c.label}風險（{risks.length} 個）
                </p>
                {risks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">無</p>
                ) : (
                  risks.map((r) => (
                    <div key={r.entryId} data-testid={`rr-risk-${r.entryId}`} className="text-xs p-2 bg-white rounded border mb-1">
                      <p className="font-medium text-muted-foreground">{r.userName}</p>
                      <p className="font-semibold">{r.title}</p>
                      {r.description && <p className="text-muted-foreground">{r.description}</p>}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="rr-reveal-btn">
            展示風險雷達
          </Button>
        )
      )}
    </div>
  );
}

export default RiskRadar;
