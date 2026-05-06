import { useState } from "react";
import { Loader2, PartyPopper, Utensils } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MenuItem extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  emoji: string;
  dish: string;
}

interface PartyMenuState extends Record<string, unknown> {
  items: MenuItem[];
  revealed: boolean;
}

interface PartyMenuConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): PartyMenuConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const EMOJI_OPTIONS = ["🍕", "🍣", "🍜", "🍔", "🍰", "🥗", "🍦", "🍱", "🌮", "🍝", "🥘", "🍩"];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function PartyMenu({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<PartyMenuState>({
    gameId,
    sessionId,
    pageId,
    type: "party_menu",
    defaultState: { items: [], revealed: false },
  });

  const [selectedEmoji, setSelectedEmoji] = useState("🍕");
  const [dish, setDish] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="pmn-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const items = state.items as MenuItem[];
  const revealed = state.revealed as boolean;
  const myItem = items.find((i) => i.userId === userId);
  const canSubmit = dish.trim().length >= 3;

  const handleSubmit = () => {
    if (!canSubmit || myItem) return;
    const entryId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      items: [...items, { entryId, userId, userName, emoji: selectedEmoji, dish: dish.trim() }],
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="pmn-title" className="text-xl font-bold text-center">
        {cfg.title ?? "派對菜單"}
      </div>
      <div data-testid="pmn-prompt" className="text-sm text-center text-muted-foreground">
        {cfg.prompt ?? "分享你想帶來派對的一道料理！"}
      </div>
      <div data-testid="pmn-count" className="text-xs text-center text-muted-foreground">
        已有 {items.length} 人點菜
      </div>

      {!myItem && (
        <div data-testid="pmn-form" className="flex flex-col gap-4 bg-card rounded-xl p-4 border">
          <div>
            <div className="text-sm font-medium mb-2">選一個料理 Emoji</div>
            <div data-testid="pmn-emoji-grid" className="grid grid-cols-6 gap-2">
              {EMOJI_OPTIONS.map((em) => (
                <button
                  key={em}
                  data-testid={`pmn-emoji-${em}`}
                  onClick={() => setSelectedEmoji(em)}
                  className={`text-2xl rounded-lg p-2 transition-colors ${
                    selectedEmoji === em
                      ? "bg-pink-100 ring-2 ring-pink-400"
                      : "bg-muted hover:bg-pink-50"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">料理名稱</label>
            <input
              data-testid="pmn-dish-input"
              type="text"
              value={dish}
              onChange={(e) => setDish(e.target.value)}
              placeholder="輸入料理名稱（至少 3 字）"
              maxLength={30}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>
          <button
            data-testid="pmn-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-pink-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Utensils className="w-4 h-4" />
            加入菜單
          </button>
        </div>
      )}

      {myItem && (
        <div data-testid="pmn-my-item" className="bg-pink-50 rounded-xl p-3 border border-pink-200 flex items-center gap-3">
          <span className="text-3xl">{myItem.emoji}</span>
          <div>
            <div className="text-sm font-semibold text-pink-700">你的料理已加入菜單</div>
            <div className="text-base font-bold">{myItem.dish}</div>
          </div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="pmn-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-pink-500 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <PartyPopper className="w-4 h-4" />
          公布派對菜單
        </button>
      )}

      {revealed && items.length === 0 && (
        <div data-testid="pmn-empty" className="text-center text-muted-foreground p-8">
          還沒有人點菜
        </div>
      )}

      {revealed && items.length > 0 && (
        <div data-testid="pmn-result" className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-center text-pink-700">
            🎉 派對菜單（{items.length} 道料理）
          </div>
          <div className="grid grid-cols-1 gap-2">
            {items.map((item) => (
              <div
                key={item.entryId}
                data-testid={`pmn-card-${item.entryId}`}
                className="flex items-center gap-3 bg-gradient-to-r from-pink-50 to-orange-50 rounded-xl p-3 border border-pink-100"
              >
                <span className="text-3xl">{item.emoji}</span>
                <div className="flex-1">
                  <div className="font-bold text-sm">{item.dish}</div>
                  <div className="text-xs text-muted-foreground">由 {item.userName} 帶來</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
