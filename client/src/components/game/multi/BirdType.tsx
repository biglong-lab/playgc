import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface BirdEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  bird: string;
  reason: string;
}

interface BirdTypeState extends Record<string, unknown> {
  entries: BirdEntry[];
  revealed: boolean;
}

interface BirdTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): BirdTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const BIRDS = [
  { id: "eagle", label: "老鷹", emoji: "🦅", desc: "視野遠大獨立自主" },
  { id: "owl", label: "貓頭鷹", emoji: "🦉", desc: "智慧沉靜深夜思考" },
  { id: "parrot", label: "鸚鵡", emoji: "🦜", desc: "活潑善溝通模仿力強" },
  { id: "penguin", label: "企鵝", emoji: "🐧", desc: "忠誠團隊努力可愛" },
  { id: "flamingo", label: "紅鶴", emoji: "🦩", desc: "優雅獨特引人注目" },
  { id: "peacock", label: "孔雀", emoji: "🦚", desc: "自信展現魅力無限" },
  { id: "hummingbird", label: "蜂鳥", emoji: "🐦", desc: "能量充沛快速行動" },
  { id: "crow", label: "烏鴉", emoji: "🐦‍⬛", desc: "聰明機智記憶絕佳" },
  { id: "swan", label: "天鵝", emoji: "🦢", desc: "優雅純潔令人仰慕" },
];

const CARD_COLORS = [
  "border-l-teal-500 bg-teal-50",
  "border-l-cyan-500 bg-cyan-50",
  "border-l-sky-500 bg-sky-50",
  "border-l-blue-500 bg-blue-50",
  "border-l-teal-600 bg-teal-50",
  "border-l-cyan-600 bg-cyan-50",
  "border-l-sky-600 bg-sky-50",
  "border-l-blue-600 bg-blue-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function BirdType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<BirdTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "bird_type",
    defaultState: { entries: [], revealed: false },
  });

  const [bird, setBird] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="brd-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as BirdEntry[]).find((e) => e.userId === userId);
  const canSubmit = bird !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: BirdEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      bird,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as BirdEntry[]), entry] });
    setBird("");
    setReason("");
  };

  const entries = state.entries as BirdEntry[];
  const revealed = state.revealed as boolean;

  const birdCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.bird] = (acc[e.bird] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="brd-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種鳥類"}
      </div>
      <div data-testid="brd-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種鳥類，你最像哪種？說說你的鳥類個性！"}
      </div>
      <div data-testid="brd-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="brd-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {BIRDS.map((b) => (
              <button
                key={b.id}
                data-testid={`brd-bird-${b.id}`}
                onClick={() => setBird(b.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${bird === b.id ? "border-teal-500 bg-teal-50 font-semibold" : "hover:border-teal-400"}`}
              >
                <span className="text-2xl">{b.emoji}</span>
                <div className="font-medium text-center">{b.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{b.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="brd-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種鳥類最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="brd-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-teal-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            展翅飛翔！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="brd-my-entry" className="bg-teal-50 rounded-xl p-3 border border-teal-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{BIRDS.find((b) => b.id === myEntry.bird)?.emoji}</span>
            <span className="text-sm font-semibold">{BIRDS.find((b) => b.id === myEntry.bird)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已振翅</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="brd-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-teal-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊鳥類圖鑑
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="brd-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇鳥類
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="brd-result" className="flex flex-col gap-3">
          <div data-testid="brd-bird-summary" className="flex flex-wrap gap-2">
            {BIRDS.filter((b) => birdCounts[b.id] > 0).map((b) => (
              <div
                key={b.id}
                data-testid={`brd-badge-${b.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-xs font-semibold"
              >
                {b.emoji} {b.label}
                <span className="ml-1 bg-teal-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {birdCounts[b.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="brd-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const b = BIRDS.find((x) => x.id === e.bird);
              return (
                <div
                  key={e.entryId}
                  data-testid={`brd-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{b?.emoji}</span>
                    <span className="text-sm font-semibold">{b?.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{e.reason}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
