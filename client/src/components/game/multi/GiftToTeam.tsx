import { useState } from "react";
import { Loader2, Gift } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface GiftEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  giftType: string;
  giftContent: string;
}

interface GiftToTeamState extends Record<string, unknown> {
  gifts: GiftEntry[];
  revealed: boolean;
}

interface GiftToTeamConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): GiftToTeamConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const GIFT_TYPES = [
  { key: "skill", label: "技能", emoji: "🔧" },
  { key: "attitude", label: "態度", emoji: "💪" },
  { key: "knowledge", label: "知識", emoji: "📚" },
  { key: "energy", label: "能量", emoji: "⚡" },
  { key: "support", label: "支持", emoji: "🤝" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function GiftToTeam({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<GiftToTeamState>({
    gameId,
    sessionId,
    pageId,
    type: "gift_to_team",
    defaultState: { gifts: [], revealed: false },
  });

  const [giftType, setGiftType] = useState(GIFT_TYPES[0].key);
  const [giftContent, setGiftContent] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="gtt-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const gifts = state.gifts as GiftEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = gifts.find((g) => g.userId === userId);
  const canSubmit = giftContent.trim().length >= 3;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entryId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      gifts: [...gifts, { entryId, userId, userName, giftType, giftContent: giftContent.trim() }],
    });
  };

  const selectedType = GIFT_TYPES.find((t) => t.key === giftType) ?? GIFT_TYPES[0];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="gtt-title" className="text-xl font-bold text-center">
        {cfg.title ?? "送給隊伍的禮物"}
      </div>
      <div data-testid="gtt-prompt" className="text-sm text-center text-muted-foreground">
        {cfg.prompt ?? "你要貢獻給隊伍什麼？"}
      </div>
      <div data-testid="gtt-count" className="text-xs text-center text-muted-foreground">
        已有 {gifts.length} 人送出禮物
      </div>

      {!myEntry && (
        <div data-testid="gtt-form" className="flex flex-col gap-4 bg-card rounded-xl p-4 border">
          <div>
            <div className="text-sm font-medium mb-2">禮物類型</div>
            <div data-testid="gtt-type-grid" className="flex gap-2 flex-wrap">
              {GIFT_TYPES.map((t) => (
                <button
                  key={t.key}
                  data-testid={`gtt-type-${t.key}`}
                  onClick={() => setGiftType(t.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    giftType === t.key
                      ? "bg-rose-100 border-rose-400 text-rose-700 font-semibold"
                      : "bg-muted border-muted-foreground/20 hover:bg-rose-50"
                  }`}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              {selectedType.emoji} 你的{selectedType.label}是什麼？
            </label>
            <input
              data-testid="gtt-content-input"
              type="text"
              value={giftContent}
              onChange={(e) => setGiftContent(e.target.value)}
              placeholder={`說明你的${selectedType.label}（至少 3 字）`}
              maxLength={50}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
          </div>
          <button
            data-testid="gtt-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-rose-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Gift className="w-4 h-4" />
            送出我的禮物
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="gtt-my-entry" className="bg-rose-50 rounded-xl p-4 border border-rose-200">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-4 h-4 text-rose-600" />
            <span className="text-sm font-semibold text-rose-700">你的禮物已送出</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{GIFT_TYPES.find((t) => t.key === myEntry.giftType)?.emoji}</span>
            <div>
              <div className="text-xs text-rose-500">{GIFT_TYPES.find((t) => t.key === myEntry.giftType)?.label}</div>
              <div className="text-sm font-medium">{myEntry.giftContent}</div>
            </div>
          </div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="gtt-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-rose-500 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Gift className="w-4 h-4" />
          開啟全隊禮物
        </button>
      )}

      {revealed && gifts.length === 0 && (
        <div data-testid="gtt-empty" className="text-center text-muted-foreground p-8">
          還沒有人送出禮物
        </div>
      )}

      {revealed && gifts.length > 0 && (
        <div data-testid="gtt-result" className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-center text-rose-700">
            🎁 全隊禮物盒（{gifts.length} 份）
          </div>
          {gifts.map((g) => (
            <div
              key={g.entryId}
              data-testid={`gtt-card-${g.entryId}`}
              className="flex items-center gap-3 bg-rose-50 rounded-xl p-3 border border-rose-100"
            >
              <span className="text-2xl">{GIFT_TYPES.find((t) => t.key === g.giftType)?.emoji}</span>
              <div className="flex-1">
                <div className="text-xs text-rose-500">{GIFT_TYPES.find((t) => t.key === g.giftType)?.label} · {g.userName}</div>
                <div className="text-sm font-medium">{g.giftContent}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
