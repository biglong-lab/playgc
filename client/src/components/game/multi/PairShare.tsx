import { Button } from "@/components/ui/button";

export interface PairEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
}

export interface PairResult extends Record<string, unknown> {
  pairId: string;
  userAId: string;
  userAName: string;
  userBId: string;
  userBName: string;
}

export interface PairShareConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  pairingMode: string;
}

export interface PairShareState extends Record<string, unknown> {
  entries: PairEntry[];
  pairs: PairResult[];
  unpairedId: string | null;
  unpairedName: string | null;
  revealed: boolean;
}

interface PairShareProps {
  config: PairShareConfig;
  state: PairShareState;
  myUserId: string;
  onJoin: () => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: PairShareConfig = {
  title: "配對分享",
  prompt: "加入後系統會隨機幫你配對一位夥伴",
  pairingMode: "random",
};

function extractConfig(raw: unknown): PairShareConfig {
  const r = raw as Record<string, unknown>;
  if (r && "pairingMode" in r) return r as unknown as PairShareConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("pairingMode" in c) return c as unknown as PairShareConfig;
  }
  return DEFAULT_CONFIG;
}

export default function PairShare({ config: rawConfig, state, myUserId, onJoin, onReveal }: PairShareProps) {
  const config = extractConfig(rawConfig as unknown);
  const myEntry = state.entries.find((e) => e.userId === myUserId);

  const myPair = state.revealed
    ? state.pairs.find((p) => p.userAId === myUserId || p.userBId === myUserId)
    : null;
  const partnerName = myPair
    ? myPair.userAId === myUserId ? myPair.userBName : myPair.userAName
    : null;

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="ps-result">
        <h2 className="text-xl font-bold" data-testid="ps-title">{config.title}</h2>
        <p className="text-sm text-muted-foreground" data-testid="ps-count">{state.entries.length} 人參與</p>
        {state.pairs.length === 0 ? (
          <p className="text-muted-foreground" data-testid="ps-empty">人數不足，無法配對</p>
        ) : (
          <div className="space-y-2">
            {state.pairs.map((p) => (
              <div key={p.pairId} className="p-3 border rounded flex items-center gap-3" data-testid={`ps-pair-${p.pairId}`}>
                <span className="text-xl">🤝</span>
                <span className="font-medium">{p.userAName}</span>
                <span className="text-muted-foreground">×</span>
                <span className="font-medium">{p.userBName}</span>
              </div>
            ))}
            {state.unpairedId && (
              <div className="p-3 border rounded border-dashed text-muted-foreground text-sm" data-testid="ps-unpaired">
                {state.unpairedName} 今天單獨行動 🙂
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="ps-title">{config.title}</h2>
      <p className="text-sm" data-testid="ps-prompt">{config.prompt}</p>
      <p className="text-sm text-muted-foreground" data-testid="ps-count">已加入：{state.entries.length} 人</p>

      {myEntry ? (
        <div className="p-3 border rounded bg-muted/30" data-testid="ps-my-entry">
          ✅ 你已加入等待配對
        </div>
      ) : (
        <Button onClick={onJoin} className="w-full" data-testid="ps-join-btn">
          加入配對池
        </Button>
      )}

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="ps-reveal-btn">
        隨機配對並公布
      </Button>
    </div>
  );
}
