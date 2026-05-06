import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface LessonEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  lesson: string;
  domain: string;
  age: string;
}

interface LifeLessonState extends Record<string, unknown> {
  entries: LessonEntry[];
  revealed: boolean;
}

interface LifeLessonConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): LifeLessonConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const DOMAINS = [
  { id: "work", label: "職場工作", emoji: "💼" },
  { id: "people", label: "人際關係", emoji: "🤝" },
  { id: "money", label: "金錢理財", emoji: "💰" },
  { id: "health", label: "身心健康", emoji: "💚" },
  { id: "family", label: "家庭親情", emoji: "🏠" },
  { id: "growth", label: "個人成長", emoji: "🌱" },
];

const AGE_GROUPS = [
  { id: "teen", label: "青少年" },
  { id: "20s", label: "20 多歲" },
  { id: "30s", label: "30 多歲" },
  { id: "recent", label: "最近" },
];

const CARD_COLORS = [
  "border-l-emerald-400 bg-emerald-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-purple-400 bg-purple-50",
  "border-l-teal-400 bg-teal-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function LifeLesson({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<LifeLessonState>({
    gameId,
    sessionId,
    pageId,
    type: "life_lesson",
    defaultState: { entries: [], revealed: false },
  });

  const [lesson, setLesson] = useState("");
  const [domain, setDomain] = useState("");
  const [age, setAge] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="ll-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as LessonEntry[]).find((e) => e.userId === userId);
  const canSubmit = lesson.trim().length >= 10 && domain !== "" && age !== "";

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: LessonEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      lesson: lesson.trim(),
      domain,
      age,
    };
    updateState({ ...state, entries: [...(state.entries as LessonEntry[]), entry] });
    setLesson("");
    setDomain("");
    setAge("");
  };

  const entries = state.entries as LessonEntry[];
  const revealed = state.revealed as boolean;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="ll-title" className="text-xl font-bold text-center">
        {cfg.title ?? "人生一堂課"}
      </div>
      <div data-testid="ll-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "分享一個你從經歷中學到的寶貴人生功課！"}
      </div>
      <div data-testid="ll-count" className="text-xs text-center text-muted-foreground">
        已分享 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="ll-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {DOMAINS.map((d) => (
              <button
                key={d.id}
                data-testid={`ll-domain-${d.id}`}
                onClick={() => setDomain(d.id)}
                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all ${domain === d.id ? "border-emerald-400 bg-emerald-50 font-semibold" : "hover:border-emerald-300"}`}
              >
                <span className="text-xl mb-1">{d.emoji}</span>
                <span>{d.label}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {AGE_GROUPS.map((a) => (
              <button
                key={a.id}
                data-testid={`ll-age-${a.id}`}
                onClick={() => setAge(a.id)}
                className={`flex-1 py-1.5 rounded-full border text-xs transition-all ${age === a.id ? "border-emerald-400 bg-emerald-50 font-semibold" : "hover:border-emerald-300"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <textarea
            data-testid="ll-lesson-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={3}
            placeholder="你的人生功課（至少10字）"
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
          />
          <button
            data-testid="ll-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-emerald-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            分享智慧！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="ll-my-entry" className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs">{DOMAINS.find((d) => d.id === myEntry.domain)?.emoji}</span>
            <span className="text-xs font-medium">{DOMAINS.find((d) => d.id === myEntry.domain)?.label}</span>
            <span className="text-xs text-muted-foreground">· {AGE_GROUPS.find((a) => a.id === myEntry.age)?.label}</span>
          </div>
          <div className="text-sm line-clamp-2">{myEntry.lesson}</div>
          <div className="text-xs text-muted-foreground mt-1">已提交</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="ll-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-emerald-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊人生智慧
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="ll-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人分享人生功課
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="ll-result" className="flex flex-col gap-3">
          <div data-testid="ll-lesson-wall" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const dom = DOMAINS.find((d) => d.id === e.domain);
              const ag = AGE_GROUPS.find((a) => a.id === e.age);
              return (
                <div
                  key={e.entryId}
                  data-testid={`ll-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{dom?.emoji}</span>
                    <span className="text-xs text-muted-foreground">{dom?.label} · {ag?.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-sm">{e.lesson}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
