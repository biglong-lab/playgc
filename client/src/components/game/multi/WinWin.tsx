import { useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface WinWinEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  teamWin: string;
  myWin: string;
}

interface WinWinState extends Record<string, unknown> {
  entries: WinWinEntry[];
  revealed: boolean;
}

interface WinWinConfig {
  title?: string;
  prompt?: string;
  teamWinLabel?: string;
  myWinLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): WinWinConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "雙贏回顧",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "這次活動，團隊贏了什麼？你個人贏了什麼？",
    teamWinLabel: typeof raw.teamWinLabel === "string" ? raw.teamWinLabel : "🏆 團隊贏了…",
    myWinLabel: typeof raw.myWinLabel === "string" ? raw.myWinLabel : "⭐ 我個人贏了…",
  };
}

const COLUMN_STYLE = {
  team: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", header: "🏆 團隊贏了" },
  my: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", header: "⭐ 個人贏了" },
};

export interface WinWinProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function WinWin({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: WinWinProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<WinWinState>({
    gameId,
    sessionId,
    pageId,
    type: "win_win",
    defaultState: { entries: [], revealed: false },
  });

  const [teamWin, setTeamWin] = useState("");
  const [myWin, setMyWin] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="ww-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = teamWin.trim() || myWin.trim();

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: WinWinEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      teamWin: teamWin.trim(),
      myWin: myWin.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setTeamWin("");
    setMyWin("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const teamWins = state.entries.filter((e) => e.teamWin);
  const myWins = state.entries.filter((e) => e.myWin);

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <Trophy className="w-6 h-6 text-amber-500" />
        <h2 className="text-xl font-bold" data-testid="ww-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="ww-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="ww-count">
        已提交：{state.entries.length} 份
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder={cfg.teamWinLabel}
            value={teamWin}
            onChange={(e) => setTeamWin(e.target.value)}
            maxLength={60}
            data-testid="ww-team-win-input"
          />
          <Input
            placeholder={cfg.myWinLabel}
            value={myWin}
            onChange={(e) => setMyWin(e.target.value)}
            maxLength={60}
            data-testid="ww-my-win-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            data-testid="ww-submit-btn"
          >
            提交雙贏
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm" data-testid="ww-my-entry">
          {myEntry.teamWin && <p className="text-amber-700 font-medium">🏆 {myEntry.teamWin}</p>}
          {myEntry.myWin && <p className="text-blue-700 font-medium mt-1">⭐ {myEntry.myWin}</p>}
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-4" data-testid="ww-result">
          {(["team", "my"] as const).map((col) => {
            const c = COLUMN_STYLE[col];
            const items = col === "team" ? teamWins : myWins;
            return (
              <div key={col} data-testid={`ww-col-${col}`} className={`rounded-xl border ${c.border} ${c.bg} p-3`}>
                <p className={`text-sm font-bold mb-2 ${c.text}`}>
                  {c.header}（{items.length} 則）
                </p>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">無</p>
                ) : (
                  items.map((e) => (
                    <div key={e.entryId} data-testid={`ww-entry-${e.entryId}-${col}`} className="text-xs bg-white rounded border p-2 mb-1">
                      <p className="text-muted-foreground font-medium">{e.userName}</p>
                      <p className="font-semibold">{col === "team" ? e.teamWin : e.myWin}</p>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="ww-reveal-btn">
            揭曉雙贏結果
          </Button>
        )
      )}
    </div>
  );
}

export default WinWin;
