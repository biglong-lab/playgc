import { useState } from "react";
import { Loader2, Heart, MessageCircle } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface PraiseEntry extends Record<string, unknown> {
  entryId: string;
  fromUserId: string;
  fromName: string;
  recipientName: string;
  message: string;
}

interface PeerPraiseState extends Record<string, unknown> {
  praises: PraiseEntry[];
  revealed: boolean;
}

interface PeerPraiseConfig {
  title?: string;
  prompt?: string;
  recipientPlaceholder?: string;
  messagePlaceholder?: string;
}

function extractConfig(raw: Record<string, unknown>): PeerPraiseConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
    recipientPlaceholder: typeof raw.recipientPlaceholder === "string" ? raw.recipientPlaceholder : undefined,
    messagePlaceholder: typeof raw.messagePlaceholder === "string" ? raw.messagePlaceholder : undefined,
  };
}

const PRAISE_COLORS = [
  "bg-pink-50 border-l-pink-400",
  "bg-rose-50 border-l-rose-400",
  "bg-red-50 border-l-red-400",
  "bg-orange-50 border-l-orange-400",
  "bg-amber-50 border-l-amber-400",
  "bg-yellow-50 border-l-yellow-400",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function PeerPraise({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<PeerPraiseState>({
    gameId,
    sessionId,
    pageId,
    type: "peer_praise",
    defaultState: { praises: [], revealed: false },
  });

  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="ppr-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const fromUserId = user?.id ?? "";
  const fromName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const praises = state.praises as PraiseEntry[];
  const revealed = state.revealed as boolean;
  const myPraise = praises.find((p) => p.fromUserId === fromUserId);
  const canSubmit = recipientName.trim().length >= 1 && message.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myPraise) return;
    const entry: PraiseEntry = {
      entryId: `${fromUserId}-${Date.now()}`,
      fromUserId,
      fromName,
      recipientName: recipientName.trim(),
      message: message.trim(),
    };
    updateState({ ...state, praises: [...praises, entry] });
    setRecipientName("");
    setMessage("");
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="ppr-title" className="text-xl font-bold text-center">
        {cfg.title ?? "隊友讚美時間"}
      </div>
      <div data-testid="ppr-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "說一句真心讚美給你最欣賞的隊友！"}
      </div>
      <div data-testid="ppr-count" className="text-xs text-center text-muted-foreground">
        已送出 {praises.length} 則讚美
      </div>

      {!myPraise && (
        <div data-testid="ppr-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              稱讚誰？
            </label>
            <input
              data-testid="ppr-recipient-input"
              type="text"
              className="border rounded-lg px-3 py-2 text-sm w-full"
              placeholder={cfg.recipientPlaceholder ?? "輸入隊友名字"}
              maxLength={20}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              想說什麼？
            </label>
            <textarea
              data-testid="ppr-message-input"
              className="border rounded-lg px-3 py-2 text-sm resize-none w-full"
              rows={3}
              maxLength={100}
              placeholder={cfg.messagePlaceholder ?? "寫下你的讚美…（至少5字）"}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <button
            data-testid="ppr-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-pink-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Heart className="w-4 h-4" />
            送出讚美
          </button>
        </div>
      )}

      {myPraise && (
        <div data-testid="ppr-my-praise" className="bg-pink-50 rounded-xl p-3 border border-pink-200">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-4 h-4 text-pink-500" />
            <span className="text-sm font-semibold text-pink-700">
              你的讚美 → {myPraise.recipientName}
            </span>
          </div>
          <p className="text-sm text-foreground">{myPraise.message}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="ppr-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-pink-500 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          揭曉所有讚美
        </button>
      )}

      {revealed && praises.length === 0 && (
        <div data-testid="ppr-empty" className="text-center text-muted-foreground p-8">
          還沒有人送出讚美
        </div>
      )}

      {revealed && praises.length > 0 && (
        <div data-testid="ppr-result" className="flex flex-col gap-2">
          <div
            data-testid="ppr-result-title"
            className="text-sm font-semibold text-center text-pink-700 flex items-center justify-center gap-1"
          >
            <Heart className="w-4 h-4" />
            隊伍讚美牆
          </div>
          {praises.map((p, idx) => (
            <div
              key={p.entryId}
              data-testid={`ppr-card-${p.entryId}`}
              className={`rounded-xl p-3 border-l-4 ${PRAISE_COLORS[idx % PRAISE_COLORS.length]}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-pink-700">
                  給 {p.recipientName}
                </span>
                <span className="text-xs text-muted-foreground">from {p.fromName}</span>
              </div>
              <p className="text-sm leading-relaxed">{p.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
