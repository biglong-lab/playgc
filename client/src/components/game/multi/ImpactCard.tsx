import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface ImpactCardEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  achievement: string;
  skill: string;
}

interface ImpactCardState extends Record<string, unknown> {
  entries: ImpactCardEntry[];
  revealed: boolean;
}

interface ImpactCardConfig {
  title?: string;
  prompt?: string;
  achievementLabel?: string;
  skillLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): ImpactCardConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "影響力卡片",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "你為這個團隊/活動帶來什麼？",
    achievementLabel: typeof raw.achievementLabel === "string" ? raw.achievementLabel : "🏅 你的一個成就",
    skillLabel: typeof raw.skillLabel === "string" ? raw.skillLabel : "💪 你帶來的技能/特質",
  };
}

const CARD_GRADIENTS = [
  "from-violet-100 to-blue-100 border-violet-300",
  "from-sky-100 to-cyan-100 border-sky-300",
  "from-emerald-100 to-teal-100 border-emerald-300",
  "from-amber-100 to-orange-100 border-amber-300",
  "from-rose-100 to-pink-100 border-rose-300",
];

export interface ImpactCardProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ImpactCard({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: ImpactCardProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<ImpactCardState>({
    gameId,
    sessionId,
    pageId,
    type: "impact_card",
    defaultState: { entries: [], revealed: false },
  });

  const [achievement, setAchievement] = useState("");
  const [skill, setSkill] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="ic-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = achievement.trim() && skill.trim();

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: ImpactCardEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      achievement: achievement.trim(),
      skill: skill.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setAchievement("");
    setSkill("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <Star className="w-6 h-6 text-violet-500" />
        <h2 className="text-xl font-bold" data-testid="ic-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="ic-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="ic-count">
        已提交：{state.entries.length} 張卡片
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{cfg.achievementLabel}</p>
            <Input
              placeholder="例：帶領團隊完成第一個里程碑"
              value={achievement}
              onChange={(e) => setAchievement(e.target.value)}
              maxLength={60}
              data-testid="ic-achievement-input"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{cfg.skillLabel}</p>
            <Input
              placeholder="例：解決問題的能力"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              maxLength={40}
              data-testid="ic-skill-input"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            data-testid="ic-submit-btn"
          >
            建立影響力卡片
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl border border-violet-200 bg-violet-50" data-testid="ic-my-card">
          <p className="font-bold text-violet-700 text-sm">{myEntry.userName}</p>
          <p className="text-sm mt-1">🏅 {myEntry.achievement}</p>
          <p className="text-sm text-muted-foreground">💪 {myEntry.skill}</p>
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-3" data-testid="ic-result">
          {state.entries.length === 0 ? (
            <p className="text-center text-muted-foreground" data-testid="ic-empty">尚無卡片</p>
          ) : (
            state.entries.map((entry, idx) => (
              <div
                key={entry.entryId}
                data-testid={`ic-card-${entry.entryId}`}
                className={`rounded-xl border p-4 bg-gradient-to-br ${CARD_GRADIENTS[idx % CARD_GRADIENTS.length]}`}
              >
                <p className="font-bold text-sm mb-2">{entry.userName}</p>
                <p className="text-sm">🏅 {entry.achievement}</p>
                <p className="text-sm text-muted-foreground mt-1">💪 {entry.skill}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="ic-reveal-btn">
            展示所有影響力卡片
          </Button>
        )
      )}
    </div>
  );
}

export default ImpactCard;
