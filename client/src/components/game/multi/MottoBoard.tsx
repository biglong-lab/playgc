import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MottoEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  motto: string;
  attitude: string;
}

interface MottoBoardState extends Record<string, unknown> {
  entries: MottoEntry[];
  revealed: boolean;
}

interface MottoBoardConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): MottoBoardConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const ATTITUDES = [
  { id: "positive", label: "積極進取", emoji: "🚀", color: "border-orange-400 bg-orange-50" },
  { id: "grateful", label: "感恩珍惜", emoji: "🙏", color: "border-green-400 bg-green-50" },
  { id: "learning", label: "持續學習", emoji: "📖", color: "border-blue-400 bg-blue-50" },
  { id: "creative", label: "創意創新", emoji: "💡", color: "border-yellow-400 bg-yellow-50" },
  { id: "resilient", label: "堅韌不拔", emoji: "💪", color: "border-red-400 bg-red-50" },
  { id: "balanced", label: "平衡和諧", emoji: "☯️", color: "border-purple-400 bg-purple-50" },
];

const CARD_COLORS = [
  "border-l-orange-400 bg-orange-50",
  "border-l-green-400 bg-green-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-yellow-400 bg-yellow-50",
  "border-l-red-400 bg-red-50",
  "border-l-purple-400 bg-purple-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MottoBoard({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<MottoBoardState>({
    gameId,
    sessionId,
    pageId,
    type: "motto_board",
    defaultState: { entries: [], revealed: false },
  });

  const [motto, setMotto] = useState("");
  const [attitude, setAttitude] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="mb-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as MottoEntry[]).find((e) => e.userId === userId);
  const canSubmit = motto.trim().length >= 5 && attitude !== "";

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: MottoEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      motto: motto.trim(),
      attitude,
    };
    updateState({ ...state, entries: [...(state.entries as MottoEntry[]), entry] });
    setMotto("");
    setAttitude("");
  };

  const entries = state.entries as MottoEntry[];
  const revealed = state.revealed as boolean;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="mb-title" className="text-xl font-bold text-center">
        {cfg.title ?? "人生座右銘"}
      </div>
      <div data-testid="mb-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "分享一句支撐你前行的座右銘或人生信條！"}
      </div>
      <div data-testid="mb-count" className="text-xs text-center text-muted-foreground">
        已分享 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="mb-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {ATTITUDES.map((a) => (
              <button
                key={a.id}
                data-testid={`mb-attitude-${a.id}`}
                onClick={() => setAttitude(a.id)}
                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all ${attitude === a.id ? `${a.color} font-semibold border-2` : "hover:border-gray-300"}`}
              >
                <span className="text-xl mb-1">{a.emoji}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
          <input
            data-testid="mb-motto-input"
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="輸入你的座右銘（至少5字）"
            value={motto}
            onChange={(e) => setMotto(e.target.value)}
          />
          <button
            data-testid="mb-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-orange-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            分享信條！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="mb-my-entry" className="bg-orange-50 rounded-xl p-3 border border-orange-200">
          <div className="text-xs text-orange-500 mb-1">
            {ATTITUDES.find((a) => a.id === myEntry.attitude)?.emoji}{" "}
            {ATTITUDES.find((a) => a.id === myEntry.attitude)?.label}
          </div>
          <div className="text-sm font-medium italic">「{myEntry.motto}」</div>
          <div className="text-xs text-muted-foreground mt-1">已提交</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="mb-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-orange-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊座右銘
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="mb-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人分享座右銘
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="mb-result" className="flex flex-col gap-3">
          <div data-testid="mb-motto-wall" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const att = ATTITUDES.find((a) => a.id === e.attitude);
              return (
                <div
                  key={e.entryId}
                  data-testid={`mb-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{att?.emoji}</span>
                    <span className="text-xs text-muted-foreground">{att?.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-sm font-medium italic">「{e.motto}」</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
