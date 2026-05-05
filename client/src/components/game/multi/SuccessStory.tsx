import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface SuccessEntry extends Record<string, unknown> {
  storyId: string;
  userId: string;
  userName: string;
  achievement: string;
  detail: string;
}

export interface SuccessStoryConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  achievementLabel: string;
  detailLabel: string;
  maxLength: number;
}

export interface SuccessStoryState extends Record<string, unknown> {
  stories: SuccessEntry[];
  revealed: boolean;
}

interface SuccessStoryProps {
  config: SuccessStoryConfig;
  state: SuccessStoryState;
  userId: string;
  onSubmit: (achievement: string, detail: string) => void;
  onReveal: () => void;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: SuccessStoryConfig = {
  title: "🏆 成功故事牆",
  prompt: "分享最近一個讓你感到驕傲的小成就",
  achievementLabel: "成就名稱",
  detailLabel: "故事細節（可選）",
  maxLength: 150,
};

function extractConfig(raw: unknown): SuccessStoryConfig {
  const r = raw as Record<string, unknown>;
  if (r && "achievementLabel" in r) return r as unknown as SuccessStoryConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("achievementLabel" in c) return c as unknown as SuccessStoryConfig;
  }
  return DEFAULT_CONFIG;
}

export function SuccessStory({ config: rawConfig, state, userId, onSubmit, onReveal, isTeamLead }: SuccessStoryProps) {
  const config = extractConfig(rawConfig as unknown);
  const [achievement, setAchievement] = useState("");
  const [detail, setDetail] = useState("");

  const myStory = state.stories.find((s) => s.userId === userId);
  const canSubmit = achievement.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(achievement.trim(), detail.trim());
  }

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="ss-result">
        <h2 className="text-xl font-bold" data-testid="ss-title">{config.title}</h2>
        <p className="text-sm text-muted-foreground" data-testid="ss-count">共 {state.stories.length} 個成就</p>
        {state.stories.length === 0 ? (
          <p className="text-muted-foreground" data-testid="ss-empty">還沒有人分享成就</p>
        ) : (
          <div className="space-y-3">
            {state.stories.map((story) => (
              <div key={story.storyId} className="p-4 border rounded-lg bg-yellow-50/40" data-testid={`ss-story-${story.storyId}`}>
                <div className="flex items-start justify-between mb-1">
                  <p className="font-semibold text-sm">🏆 {story.achievement}</p>
                  <span className="text-xs text-muted-foreground">{story.userName}</span>
                </div>
                {story.detail && <p className="text-xs text-muted-foreground">{story.detail}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="ss-title">{config.title}</h2>
      <p className="text-sm text-muted-foreground" data-testid="ss-prompt">{config.prompt}</p>
      <p className="text-xs text-muted-foreground" data-testid="ss-count">已分享：{state.stories.length} 人</p>
      {state.stories.length === 0 && (
        <p className="text-xs text-muted-foreground italic" data-testid="ss-empty">還沒有人分享成就，快來第一個！</p>
      )}

      {myStory ? (
        <div className="p-3 border rounded bg-yellow-50/30" data-testid="ss-my-story">
          <p className="text-sm font-medium mb-1">🏆 你已分享成就</p>
          <p className="text-xs text-muted-foreground">{myStory.achievement}</p>
          {myStory.detail && <p className="text-xs text-muted-foreground">{myStory.detail}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">{config.achievementLabel}</p>
            <Input
              placeholder={config.achievementLabel}
              value={achievement}
              onChange={(e) => setAchievement(e.target.value)}
              maxLength={config.maxLength}
              data-testid="ss-achievement-input"
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">{config.detailLabel}</p>
            <Textarea
              placeholder={config.detailLabel}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={config.maxLength}
              rows={2}
              data-testid="ss-detail-input"
            />
          </div>
          <Button disabled={!canSubmit} onClick={handleSubmit} data-testid="ss-submit-btn">
            分享成就
          </Button>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <Button variant="outline" size="sm" onClick={onReveal} data-testid="ss-reveal-btn">
          公布成功故事牆
        </Button>
      )}
    </div>
  );
}

export default SuccessStory;
