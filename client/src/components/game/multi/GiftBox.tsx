import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface GiftEntry {
  entryId: string;
  userId: string;
  senderName: string;
  recipientName: string;
  giftLabel: string;
  message: string;
}

interface GiftBoxState extends Record<string, unknown> {
  gifts: GiftEntry[];
  revealed: boolean;
}

interface GiftBoxConfig {
  title: string;
  prompt: string;
  giftPlaceholder: string;
  messagePlaceholder: string;
}

function extractConfig(raw: Record<string, unknown>): GiftBoxConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "禮物盒",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "送給一位隊友一份「看見的禮物」——你在他身上看見的一個珍貴特質或力量",
    giftPlaceholder:
      typeof raw.giftPlaceholder === "string"
        ? raw.giftPlaceholder
        : "禮物名稱（如：傾聽的力量、拆解問題的能力…）",
    messagePlaceholder:
      typeof raw.messagePlaceholder === "string"
        ? raw.messagePlaceholder
        : "給對方的一句話（選填）",
  };
}

const DEFAULT_STATE: GiftBoxState = { gifts: [], revealed: false };

const GIFT_EMOJIS = ["🎁", "💎", "🌟", "🏅", "🌺", "🔑", "💡", "🎯", "🦋", "🌈"];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function GiftBox({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<GiftBoxState>({
    gameId,
    sessionId,
    pageId,
    type: "gift_box",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [recipientName, setRecipientName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🎁");
  const [giftLabel, setGiftLabel] = useState("");
  const [message, setMessage] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="gb-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const senderName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myGift = state.gifts.find((g) => g.userId === userId);
  const canSubmit =
    recipientName.trim().length >= 1 && giftLabel.trim().length >= 2;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: GiftEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      senderName,
      recipientName: recipientName.trim(),
      giftLabel: `${selectedEmoji} ${giftLabel.trim()}`,
      message: message.trim(),
    };
    updateState({ ...state, gifts: [...state.gifts, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function buildRecipientMap() {
    const map: Record<string, GiftEntry[]> = {};
    state.gifts.forEach((g) => {
      if (!map[g.recipientName]) map[g.recipientName] = [];
      map[g.recipientName].push(g);
    });
    return map;
  }

  const recipientMap = state.revealed ? buildRecipientMap() : {};

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5 text-rose-500" />
        <h2 className="text-xl font-bold" data-testid="gb-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="gb-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="gb-count">
        已送出：{state.gifts.length} 份禮物
      </p>

      {!myGift ? (
        <div className="space-y-3" data-testid="gb-form">
          <input
            data-testid="gb-recipient-input"
            className="w-full border rounded p-2 text-sm"
            placeholder="送給誰？（輸入隊友名字）"
            maxLength={20}
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />

          <div>
            <p className="text-xs text-gray-500 mb-1">選一個象徵</p>
            <div data-testid="gb-emoji-picker" className="flex gap-2 flex-wrap">
              {GIFT_EMOJIS.map((em) => (
                <button
                  key={em}
                  data-testid={`gb-emoji-${em}`}
                  onClick={() => setSelectedEmoji(em)}
                  className={`text-xl p-1 rounded transition-all ${
                    selectedEmoji === em
                      ? "ring-2 ring-rose-400 bg-rose-50"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <input
            data-testid="gb-gift-input"
            className="w-full border rounded p-2 text-sm"
            placeholder={cfg.giftPlaceholder}
            maxLength={40}
            value={giftLabel}
            onChange={(e) => setGiftLabel(e.target.value)}
          />

          <textarea
            data-testid="gb-message-input"
            className="w-full border rounded p-2 text-sm resize-none"
            rows={2}
            placeholder={cfg.messagePlaceholder}
            maxLength={60}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <button
            data-testid="gb-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-rose-500 text-white rounded disabled:opacity-40 text-sm"
          >
            送出禮物
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-rose-50 rounded border border-rose-200 text-sm"
          data-testid="gb-my-entry"
        >
          <p className="text-xs text-rose-600 font-medium mb-1">你送出的禮物</p>
          <p className="text-xs text-gray-600">
            送給 <span className="font-medium">{myGift.recipientName}</span>：{myGift.giftLabel}
          </p>
          {myGift.message && (
            <p className="text-xs text-gray-400 mt-1">「{myGift.message}」</p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="gb-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示禮物盒
        </button>
      )}

      {state.revealed && (
        <div data-testid="gb-result" className="space-y-4">
          <p className="text-sm font-semibold text-gray-600">🎁 全隊禮物清單</p>
          {state.gifts.length === 0 ? (
            <p data-testid="gb-empty" className="text-gray-400 text-sm">尚無送出</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(recipientMap).map(([recipient, gifts]) => (
                <div
                  key={recipient}
                  data-testid={`gb-recipient-${recipient}`}
                  className="p-3 bg-white border rounded shadow-sm"
                >
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    {recipient} 收到的禮物
                  </p>
                  {gifts.map((g) => (
                    <div
                      key={g.entryId}
                      data-testid={`gb-card-${g.entryId}`}
                      className="mb-1"
                    >
                      <span className="text-xs text-rose-600 font-medium">
                        {g.giftLabel}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">
                        — 來自 {g.senderName}
                      </span>
                      {g.message && (
                        <p className="text-xs text-gray-400 italic mt-0.5">
                          「{g.message}」
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GiftBox;
