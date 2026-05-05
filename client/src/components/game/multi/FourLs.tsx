import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface FourLEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  liked: string;
  learned: string;
  lacked: string;
  longed: string;
}

interface FourLsState extends Record<string, unknown> {
  entries: FourLEntry[];
  revealed: boolean;
}

interface FourLsConfig {
  title?: string;
  prompt?: string;
  likedLabel?: string;
  learnedLabel?: string;
  lackedLabel?: string;
  longedLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): FourLsConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "🔄 四 L 覆盤",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "從四個角度反思這次經驗，至少填一項",
    likedLabel: typeof raw.likedLabel === "string" ? raw.likedLabel : "👍 Liked（喜歡的）",
    learnedLabel: typeof raw.learnedLabel === "string" ? raw.learnedLabel : "💡 Learned（學到的）",
    lackedLabel: typeof raw.lackedLabel === "string" ? raw.lackedLabel : "❓ Lacked（缺少的）",
    longedLabel: typeof raw.longedLabel === "string" ? raw.longedLabel : "🌟 Longed for（期待的）",
  };
}

type ColKey = "liked" | "learned" | "lacked" | "longed";

const COLUMN_STYLE: Record<ColKey, { bg: string; border: string; text: string; header: string }> = {
  liked: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", header: "👍 Liked" },
  learned: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", header: "💡 Learned" },
  lacked: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", header: "❓ Lacked" },
  longed: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", header: "🌟 Longed for" },
};

export interface FourLsProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function FourLs({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: FourLsProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<FourLsState>({
    gameId,
    sessionId,
    pageId,
    type: "four_ls",
    defaultState: { entries: [], revealed: false },
  });

  const [liked, setLiked] = useState("");
  const [learned, setLearned] = useState("");
  const [lacked, setLacked] = useState("");
  const [longed, setLonged] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="fl-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = liked.trim() || learned.trim() || lacked.trim() || longed.trim();

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: FourLEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      liked: liked.trim(),
      learned: learned.trim(),
      lacked: lacked.trim(),
      longed: longed.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setLiked("");
    setLearned("");
    setLacked("");
    setLonged("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const cols: { key: ColKey; items: FourLEntry[] }[] = [
    { key: "liked", items: state.entries.filter((e) => e.liked) },
    { key: "learned", items: state.entries.filter((e) => e.learned) },
    { key: "lacked", items: state.entries.filter((e) => e.lacked) },
    { key: "longed", items: state.entries.filter((e) => e.longed) },
  ];

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <RefreshCw className="w-6 h-6 text-blue-500" />
        <h2 className="text-xl font-bold" data-testid="fl-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="fl-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="fl-count">
        已提交：{state.entries.length} 份
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder={cfg.likedLabel}
            value={liked}
            onChange={(e) => setLiked(e.target.value)}
            maxLength={60}
            data-testid="fl-liked-input"
          />
          <Input
            placeholder={cfg.learnedLabel}
            value={learned}
            onChange={(e) => setLearned(e.target.value)}
            maxLength={60}
            data-testid="fl-learned-input"
          />
          <Input
            placeholder={cfg.lackedLabel}
            value={lacked}
            onChange={(e) => setLacked(e.target.value)}
            maxLength={60}
            data-testid="fl-lacked-input"
          />
          <Input
            placeholder={cfg.longedLabel}
            value={longed}
            onChange={(e) => setLonged(e.target.value)}
            maxLength={60}
            data-testid="fl-longed-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            data-testid="fl-submit-btn"
          >
            提交四 L 反思
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 text-sm" data-testid="fl-my-entry">
          {myEntry.liked && <p className="text-green-700 font-medium">👍 {myEntry.liked}</p>}
          {myEntry.learned && <p className="text-blue-700 font-medium mt-1">💡 {myEntry.learned}</p>}
          {myEntry.lacked && <p className="text-amber-700 font-medium mt-1">❓ {myEntry.lacked}</p>}
          {myEntry.longed && <p className="text-purple-700 font-medium mt-1">🌟 {myEntry.longed}</p>}
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-4" data-testid="fl-result">
          {cols.map(({ key, items }) => {
            const c = COLUMN_STYLE[key];
            return (
              <div key={key} data-testid={`fl-col-${key}`} className={`rounded-xl border ${c.border} ${c.bg} p-3`}>
                <p className={`text-sm font-bold mb-2 ${c.text}`}>
                  {c.header}（{items.length} 則）
                </p>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">無</p>
                ) : (
                  items.map((e) => (
                    <div key={`${e.entryId}-${key}`} data-testid={`fl-item-${e.entryId}-${key}`} className="text-xs bg-white rounded border p-2 mb-1">
                      <p className="text-muted-foreground font-medium">{e.userName}</p>
                      <p className="font-semibold">{e[key] as string}</p>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="fl-reveal-btn">
            展示四 L 覆盤
          </Button>
        )
      )}
    </div>
  );
}

export default FourLs;
