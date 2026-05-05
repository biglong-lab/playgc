import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

const BADGE_COLORS = [
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-violet-400 to-purple-500",
  "from-sky-400 to-blue-500",
  "from-rose-400 to-pink-500",
  "from-lime-400 to-green-500",
];

interface HighlightEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  title: string;
  detail: string;
}

interface PersonalHighlightState extends Record<string, unknown> {
  entries: HighlightEntry[];
  revealed: boolean;
}

interface PersonalHighlightConfig {
  prompt?: string;
  title?: string;
  detailLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): PersonalHighlightConfig {
  return {
    prompt: typeof raw.prompt === "string" ? raw.prompt : "分享你最近一個值得驕傲的成就或亮點！",
    title: typeof raw.title === "string" ? raw.title : "個人亮點",
    detailLabel: typeof raw.detailLabel === "string" ? raw.detailLabel : "補充說明（選填）",
  };
}

export interface PersonalHighlightProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function PersonalHighlight({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: PersonalHighlightProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<PersonalHighlightState>({
    gameId,
    sessionId,
    pageId,
    type: "personal_highlight",
    defaultState: { entries: [], revealed: false },
  });

  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="ph-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!title.trim() || myEntry) return;
    const entry: HighlightEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      title: title.trim(),
      detail: detail.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setTitle("");
    setDetail("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-center" data-testid="ph-title">
        {cfg.title ?? "個人亮點"}
      </h2>
      <p className="text-center text-muted-foreground text-sm" data-testid="ph-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="ph-count">
        已分享：{state.entries.length} 人
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder="你的亮點標題"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            data-testid="ph-title-input"
          />
          <Textarea
            placeholder={cfg.detailLabel ?? "補充說明（選填）"}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            maxLength={200}
            data-testid="ph-detail-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="w-full"
            data-testid="ph-submit-btn"
          >
            分享我的亮點
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm" data-testid="ph-my-entry">
          <p className="font-semibold">⭐ {myEntry.title}</p>
          {myEntry.detail && <p className="text-muted-foreground mt-1">{myEntry.detail}</p>}
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-3" data-testid="ph-result">
          {state.entries.length === 0 ? (
            <p className="text-center text-muted-foreground" data-testid="ph-empty">
              尚無分享
            </p>
          ) : (
            state.entries.map((entry, idx) => (
              <div
                key={entry.entryId}
                data-testid={`ph-entry-${entry.entryId}`}
                className={`rounded-xl p-4 text-white bg-gradient-to-br ${BADGE_COLORS[idx % BADGE_COLORS.length]}`}
              >
                <p className="font-semibold text-sm opacity-80">{entry.userName}</p>
                <p className="font-bold text-base mt-1">⭐ {entry.title}</p>
                {entry.detail && <p className="text-sm opacity-90 mt-1">{entry.detail}</p>}
              </div>
            ))
          )}
        </div>
      ) : (
        isTeamLead && (
          <Button
            onClick={handleReveal}
            variant="default"
            className="w-full"
            data-testid="ph-reveal-btn"
          >
            展示所有亮點
          </Button>
        )
      )}
    </div>
  );
}

export default PersonalHighlight;
