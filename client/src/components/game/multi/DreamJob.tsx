import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface DreamJobEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  job: string;
  age: string;
  story: string;
}

interface DreamJobState extends Record<string, unknown> {
  entries: DreamJobEntry[];
  revealed: boolean;
}

interface DreamJobConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): DreamJobConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const JOBS = [
  { id: "astronaut", label: "太空人", emoji: "🚀" },
  { id: "artist", label: "藝術家", emoji: "🎨" },
  { id: "doctor", label: "醫生", emoji: "⚕️" },
  { id: "athlete", label: "運動員", emoji: "🏆" },
  { id: "chef", label: "廚師", emoji: "👨‍🍳" },
  { id: "teacher", label: "老師", emoji: "📚" },
  { id: "scientist", label: "科學家", emoji: "🔬" },
  { id: "firefighter", label: "消防員", emoji: "🚒" },
  { id: "pilot", label: "飛行員", emoji: "✈️" },
  { id: "musician", label: "音樂家", emoji: "🎵" },
  { id: "detective", label: "偵探", emoji: "🕵️" },
  { id: "adventurer", label: "探險家", emoji: "🗺️" },
];

const AGE_GROUPS = [
  { id: "preschool", label: "幼稚園" },
  { id: "elementary", label: "小學" },
  { id: "junior", label: "國中" },
  { id: "high", label: "高中" },
];

const CARD_COLORS = [
  "border-l-indigo-400 bg-indigo-50",
  "border-l-cyan-400 bg-cyan-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-emerald-400 bg-emerald-50",
  "border-l-violet-400 bg-violet-50",
  "border-l-fuchsia-400 bg-fuchsia-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function DreamJob({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<DreamJobState>({
    gameId,
    sessionId,
    pageId,
    type: "dream_job",
    defaultState: { entries: [], revealed: false },
  });

  const [job, setJob] = useState("");
  const [age, setAge] = useState("");
  const [story, setStory] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="dj-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as DreamJobEntry[]).find((e) => e.userId === userId);
  const canSubmit = job !== "" && age !== "" && story.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: DreamJobEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      job,
      age,
      story: story.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as DreamJobEntry[]), entry] });
    setJob("");
    setAge("");
    setStory("");
  };

  const entries = state.entries as DreamJobEntry[];
  const revealed = state.revealed as boolean;

  const jobCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.job] = (acc[e.job] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="dj-title" className="text-xl font-bold text-center">
        {cfg.title ?? "童年夢想職業"}
      </div>
      <div data-testid="dj-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "你小時候最想成為什麼？說說當時的夢想故事！"}
      </div>
      <div data-testid="dj-count" className="text-xs text-center text-muted-foreground">
        已分享 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="dj-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {JOBS.map((j) => (
              <button
                key={j.id}
                data-testid={`dj-job-${j.id}`}
                onClick={() => setJob(j.id)}
                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all ${job === j.id ? "border-indigo-400 bg-indigo-50 font-semibold" : "hover:border-indigo-300"}`}
              >
                <span className="text-2xl mb-1">{j.emoji}</span>
                <span>{j.label}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {AGE_GROUPS.map((a) => (
              <button
                key={a.id}
                data-testid={`dj-age-${a.id}`}
                onClick={() => setAge(a.id)}
                className={`flex-1 py-1 rounded-lg border text-xs transition-all ${age === a.id ? "border-indigo-400 bg-indigo-50 font-semibold" : "hover:border-indigo-300"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <textarea
            data-testid="dj-story-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="說說你當時為什麼想當這個？（至少5字）"
            value={story}
            onChange={(e) => setStory(e.target.value)}
          />
          <button
            data-testid="dj-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            分享夢想！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="dj-my-entry" className="bg-indigo-50 rounded-xl p-3 border border-indigo-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{JOBS.find((j) => j.id === myEntry.job)?.emoji}</span>
            <span className="text-sm font-semibold">{JOBS.find((j) => j.id === myEntry.job)?.label}</span>
            <span className="text-xs text-muted-foreground">· {AGE_GROUPS.find((a) => a.id === myEntry.age)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.story}</div>
          <div className="text-xs text-muted-foreground mt-1">已分享</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="dj-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊夢想清單
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="dj-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人分享夢想職業
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="dj-result" className="flex flex-col gap-3">
          <div data-testid="dj-job-summary" className="flex flex-wrap gap-2">
            {JOBS.filter((j) => jobCounts[j.id] > 0).map((j) => (
              <div
                key={j.id}
                data-testid={`dj-badge-${j.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold"
              >
                {j.emoji} {j.label}
                <span className="ml-1 bg-indigo-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {jobCounts[j.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="dj-dream-wall" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const j = JOBS.find((x) => x.id === e.job);
              const a = AGE_GROUPS.find((x) => x.id === e.age);
              return (
                <div
                  key={e.entryId}
                  data-testid={`dj-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{j?.emoji}</span>
                    <span className="text-sm font-semibold">{j?.label}</span>
                    <span className="text-xs text-muted-foreground">· {a?.label}</span>
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
