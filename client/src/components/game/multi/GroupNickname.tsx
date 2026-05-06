import { useState } from "react";
import { Loader2, Laugh, Vote, Trophy } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface NickEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  nick: string;
}

interface NickVote extends Record<string, unknown> {
  userId: string;
  targetEntryId: string;
}

interface GroupNicknameState extends Record<string, unknown> {
  stage: "submit" | "vote" | "reveal";
  nicks: NickEntry[];
  votes: NickVote[];
}

interface GroupNicknameConfig {
  title?: string;
  prompt?: string;
  placeholder?: string;
}

function extractConfig(raw: Record<string, unknown>): GroupNicknameConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : undefined,
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function GroupNickname({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<GroupNicknameState>({
    gameId,
    sessionId,
    pageId,
    type: "group_nickname",
    defaultState: { stage: "submit", nicks: [], votes: [] },
  });

  const [nickInput, setNickInput] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="gnn-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const nicks = state.nicks as NickEntry[];
  const votes = state.votes as NickVote[];
  const stage = state.stage as "submit" | "vote" | "reveal";

  const myNick = nicks.find((n) => n.userId === userId);
  const myVote = votes.find((v) => v.userId === userId);
  const canSubmitNick = nickInput.trim().length >= 2;

  const handleSubmitNick = () => {
    if (!canSubmitNick || myNick) return;
    const entry: NickEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      nick: nickInput.trim(),
    };
    updateState({ ...state, nicks: [...nicks, entry] });
    setNickInput("");
  };

  const handleVote = (targetEntryId: string) => {
    if (myVote) return;
    const vote: NickVote = { userId, targetEntryId };
    updateState({ ...state, votes: [...votes, vote] });
  };

  const handleAdvanceStage = () => {
    if (stage === "submit") updateState({ ...state, stage: "vote" });
    else if (stage === "vote") updateState({ ...state, stage: "reveal" });
  };

  const voteCount = (entryId: string) => votes.filter((v) => v.targetEntryId === entryId).length;

  const winner = stage === "reveal"
    ? nicks.reduce(
        (best, n) => (!best || voteCount(n.entryId) > voteCount(best.entryId) ? n : best),
        null as NickEntry | null,
      )
    : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="gnn-title" className="text-xl font-bold text-center">
        {cfg.title ?? "隊伍外號大徵集"}
      </div>
      <div data-testid="gnn-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "為你的隊伍取一個有趣的外號吧！"}
      </div>
      <div data-testid="gnn-stage" className="text-xs text-center font-medium text-primary">
        {stage === "submit" ? "📝 提名階段" : stage === "vote" ? "🗳️ 投票階段" : "🏆 揭曉！"}
      </div>
      <div data-testid="gnn-count" className="text-xs text-center text-muted-foreground">
        已收到 {nicks.length} 個外號提名
      </div>

      {stage === "submit" && !myNick && (
        <div data-testid="gnn-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <input
            data-testid="gnn-nick-input"
            type="text"
            className="border rounded-lg px-3 py-2 text-sm w-full"
            placeholder={cfg.placeholder ?? "輸入外號（至少2字）"}
            maxLength={20}
            value={nickInput}
            onChange={(e) => setNickInput(e.target.value)}
          />
          <button
            data-testid="gnn-submit-btn"
            disabled={!canSubmitNick}
            onClick={handleSubmitNick}
            className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Laugh className="w-4 h-4" />
            提名這個外號
          </button>
        </div>
      )}

      {myNick && stage === "submit" && (
        <div data-testid="gnn-my-nick" className="bg-amber-50 rounded-xl p-3 border border-amber-200">
          <span className="text-sm font-semibold text-amber-700">你的提名：</span>
          <span className="text-sm ml-2">{myNick.nick}</span>
        </div>
      )}

      {stage === "vote" && nicks.length > 0 && (
        <div data-testid="gnn-vote-list" className="flex flex-col gap-2">
          {nicks.map((n) => (
            <button
              key={n.entryId}
              data-testid={`gnn-vote-item-${n.entryId}`}
              onClick={() => handleVote(n.entryId)}
              disabled={!!myVote}
              className={`rounded-xl p-3 border text-left transition-colors ${
                myVote?.targetEntryId === n.entryId
                  ? "border-amber-500 bg-amber-50"
                  : "border-border hover:bg-accent"
              } disabled:cursor-default`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{n.nick}</span>
                <span className="text-xs text-muted-foreground">by {n.userName}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {myVote && stage === "vote" && (
        <div data-testid="gnn-my-vote" className="text-xs text-center text-muted-foreground">
          已投票！等待結果揭曉。
        </div>
      )}

      {isTeamLead && stage !== "reveal" && (
        <button
          data-testid="gnn-advance-btn"
          onClick={handleAdvanceStage}
          className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Vote className="w-4 h-4" />
          {stage === "submit" ? "進入投票階段" : "揭曉結果"}
        </button>
      )}

      {stage === "reveal" && nicks.length === 0 && (
        <div data-testid="gnn-empty" className="text-center text-muted-foreground p-8">
          還沒有人提名外號
        </div>
      )}

      {stage === "reveal" && winner && (
        <div data-testid="gnn-result" className="flex flex-col gap-3">
          <div data-testid="gnn-winner" className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 text-center">
            <Trophy className="w-8 h-8 text-amber-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-amber-700">{winner.nick}</div>
            <div className="text-xs text-amber-600 mt-1">
              獲得 {voteCount(winner.entryId)} 票 · 提名人：{winner.userName}
            </div>
          </div>
          <div data-testid="gnn-all-results" className="flex flex-col gap-1">
            {nicks
              .slice()
              .sort((a, b) => voteCount(b.entryId) - voteCount(a.entryId))
              .map((n) => (
                <div
                  key={n.entryId}
                  data-testid={`gnn-result-${n.entryId}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 bg-muted text-sm"
                >
                  <span className="font-medium">{n.nick}</span>
                  <span className="text-muted-foreground">{voteCount(n.entryId)} 票</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
