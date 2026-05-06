import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface TalentEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  talent: string;
  level: string;
  story: string;
}

interface SecretTalentState extends Record<string, unknown> {
  entries: TalentEntry[];
  revealed: boolean;
}

interface SecretTalentConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): SecretTalentConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const TALENT_LEVELS = [
  { id: "beginner", label: "入門中", emoji: "🌱" },
  { id: "amateur", label: "業餘水準", emoji: "⭐" },
  { id: "decent", label: "還不錯", emoji: "✨" },
  { id: "good", label: "頗有水準", emoji: "🔥" },
  { id: "expert", label: "達人等級", emoji: "👑" },
];

const CARD_COLORS = [
  "border-l-cyan-400 bg-cyan-50",
  "border-l-fuchsia-400 bg-fuchsia-50",
  "border-l-lime-400 bg-lime-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-rose-400 bg-rose-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SecretTalent({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SecretTalentState>({
    gameId,
    sessionId,
    pageId,
    type: "secret_talent",
    defaultState: { entries: [], revealed: false },
  });

  const [talent, setTalent] = useState("");
  const [level, setLevel] = useState("");
  const [story, setStory] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="st-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as TalentEntry[]).find((e) => e.userId === userId);
  const canSubmit = talent.trim().length >= 3 && level !== "" && story.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: TalentEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      talent: talent.trim(),
      level,
      story: story.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as TalentEntry[]), entry] });
    setTalent("");
    setLevel("");
    setStory("");
  };

  const entries = state.entries as TalentEntry[];
  const revealed = state.revealed as boolean;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="st-title" className="text-xl font-bold text-center">
        {cfg.title ?? "隱藏才能大揭密"}
      </div>
      <div data-testid="st-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "揭曉你的隱藏才能，讓大家大吃一驚！"}
      </div>
      <div data-testid="st-count" className="text-xs text-center text-muted-foreground">
        已揭密 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="st-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <input
            data-testid="st-talent-input"
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="你的隱藏才能是？（至少3字，例如：打手鼓、口技）"
            value={talent}
            onChange={(e) => setTalent(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            {TALENT_LEVELS.map((l) => (
              <button
                key={l.id}
                data-testid={`st-level-${l.id}`}
                onClick={() => setLevel(l.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs transition-all ${level === l.id ? "border-cyan-400 bg-cyan-50 font-semibold" : "hover:border-cyan-300"}`}
              >
                <span>{l.emoji}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
          <textarea
            data-testid="st-story-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="簡單說說這個才能的故事或來由（至少5字）"
            value={story}
            onChange={(e) => setStory(e.target.value)}
          />
          <button
            data-testid="st-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-cyan-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            揭曉！🎭
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="st-my-entry" className="bg-cyan-50 rounded-xl p-3 border border-cyan-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs">{TALENT_LEVELS.find((l) => l.id === myEntry.level)?.emoji}</span>
            <span className="text-sm font-semibold">{myEntry.talent}</span>
            <span className="text-xs text-muted-foreground">· {TALENT_LEVELS.find((l) => l.id === myEntry.level)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground line-clamp-2">{myEntry.story}</div>
          <div className="text-xs text-muted-foreground mt-1">已揭密</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="st-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-cyan-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉所有才能
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="st-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人揭密才能
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="st-result" className="flex flex-col gap-3">
          <div data-testid="st-talent-wall" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const lv = TALENT_LEVELS.find((l) => l.id === e.level);
              return (
                <div
                  key={e.entryId}
                  data-testid={`st-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{lv?.emoji}</span>
                    <span className="text-sm font-semibold">{e.talent}</span>
                    <span className="text-xs text-muted-foreground">· {lv?.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{e.story}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
