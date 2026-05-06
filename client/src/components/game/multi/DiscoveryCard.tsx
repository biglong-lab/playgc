import { useState } from "react";
import { Loader2, Sparkles, Search } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface DiscoveryEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  discovery: string;
}

interface DiscoveryCardState extends Record<string, unknown> {
  cards: DiscoveryEntry[];
  revealed: boolean;
}

interface DiscoveryCardConfig {
  title?: string;
  prompt?: string;
  placeholder?: string;
}

function extractConfig(raw: Record<string, unknown>): DiscoveryCardConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : undefined,
  };
}

const CARD_BG = [
  "bg-rose-50 border-l-rose-400",
  "bg-orange-50 border-l-orange-400",
  "bg-yellow-50 border-l-yellow-400",
  "bg-lime-50 border-l-lime-400",
  "bg-teal-50 border-l-teal-400",
  "bg-sky-50 border-l-sky-400",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function DiscoveryCard({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<DiscoveryCardState>({
    gameId,
    sessionId,
    pageId,
    type: "discovery_card",
    defaultState: { cards: [], revealed: false },
  });

  const [discovery, setDiscovery] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="dsc-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const cards = state.cards as DiscoveryEntry[];
  const revealed = state.revealed as boolean;
  const myCard = cards.find((c) => c.userId === userId);
  const canSubmit = discovery.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myCard) return;
    const entry: DiscoveryEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      discovery: discovery.trim(),
    };
    updateState({ ...state, cards: [...cards, entry] });
    setDiscovery("");
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="dsc-title" className="text-xl font-bold text-center">
        {cfg.title ?? "活動發現卡"}
      </div>
      <div data-testid="dsc-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "這次活動讓你發現了什麼？關於自己、關於團隊、關於世界…"}
      </div>
      <div data-testid="dsc-count" className="text-xs text-center text-muted-foreground">
        已收到 {cards.length} 張發現卡
      </div>

      {!myCard && (
        <div data-testid="dsc-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <textarea
            data-testid="dsc-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none w-full"
            rows={3}
            maxLength={80}
            placeholder={cfg.placeholder ?? "寫下你的發現…（至少5字）"}
            value={discovery}
            onChange={(e) => setDiscovery(e.target.value)}
          />
          <button
            data-testid="dsc-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-rose-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            分享我的發現
          </button>
        </div>
      )}

      {myCard && (
        <div data-testid="dsc-my-card" className="bg-rose-50 rounded-xl p-3 border border-rose-200">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-rose-500" />
            <span className="text-sm font-semibold text-rose-700">你的發現</span>
          </div>
          <p className="text-sm text-foreground">{myCard.discovery}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="dsc-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-rose-500 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          揭曉大家的發現
        </button>
      )}

      {revealed && cards.length === 0 && (
        <div data-testid="dsc-empty" className="text-center text-muted-foreground p-8">
          還沒有人分享發現
        </div>
      )}

      {revealed && cards.length > 0 && (
        <div data-testid="dsc-result" className="flex flex-col gap-2">
          <div data-testid="dsc-result-title" className="text-sm font-semibold text-center text-rose-700 flex items-center justify-center gap-1">
            <Sparkles className="w-4 h-4" />
            隊伍發現牆
          </div>
          {cards.map((c, idx) => (
            <div
              key={c.entryId}
              data-testid={`dsc-card-${c.entryId}`}
              className={`rounded-xl p-3 border-l-4 ${CARD_BG[idx % CARD_BG.length]}`}
            >
              <div className="text-xs font-semibold text-rose-700 mb-1">{c.userName}</div>
              <p className="text-sm leading-relaxed">{c.discovery}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
