import { useState } from "react";
import { Loader2, Flag, Trophy } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface FlagEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  emoji: string;
  motto: string;
}

interface FlagVote extends Record<string, unknown> {
  userId: string;
  targetEntryId: string;
}

interface FlagDesignState extends Record<string, unknown> {
  stage: "design" | "vote" | "reveal";
  designs: FlagEntry[];
  votes: FlagVote[];
}

interface FlagDesignConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): FlagDesignConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const EMOJI_OPTIONS = ["🔥", "⚡", "🌊", "🌟", "🦁", "🚀", "🌈", "🎯", "💎", "🌙", "🦅", "🌺"];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function FlagDesign({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<FlagDesignState>({
    gameId,
    sessionId,
    pageId,
    type: "flag_design",
    defaultState: { stage: "design", designs: [], votes: [] },
  });

  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [motto, setMotto] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="fld-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const designs = state.designs as FlagEntry[];
  const votes = state.votes as FlagVote[];
  const stage = state.stage as "design" | "vote" | "reveal";

  const myDesign = designs.find((d) => d.userId === userId);
  const myVote = votes.find((v) => v.userId === userId);
  const canSubmit = selectedEmoji.length > 0 && motto.trim().length >= 3;

  const handleSubmitDesign = () => {
    if (!canSubmit || myDesign) return;
    const entry: FlagEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      emoji: selectedEmoji,
      motto: motto.trim(),
    };
    updateState({ ...state, designs: [...designs, entry] });
    setSelectedEmoji("");
    setMotto("");
  };

  const handleVote = (targetEntryId: string) => {
    if (myVote) return;
    updateState({ ...state, votes: [...votes, { userId, targetEntryId }] });
  };

  const handleAdvanceStage = () => {
    if (stage === "design") updateState({ ...state, stage: "vote" });
    else if (stage === "vote") updateState({ ...state, stage: "reveal" });
  };

  const voteCount = (entryId: string) => votes.filter((v) => v.targetEntryId === entryId).length;

  const winner = stage === "reveal"
    ? designs.reduce(
        (best, d) => (!best || voteCount(d.entryId) > voteCount(best.entryId) ? d : best),
        null as FlagEntry | null,
      )
    : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="fld-title" className="text-xl font-bold text-center">
        {cfg.title ?? "隊伍旗幟設計"}
      </div>
      <div data-testid="fld-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "選一個圖騰、寫一句精神標語，為隊伍設計旗幟！"}
      </div>
      <div data-testid="fld-stage" className="text-xs text-center font-medium text-primary">
        {stage === "design" ? "🎨 設計階段" : stage === "vote" ? "🗳️ 投票階段" : "🏆 揭曉！"}
      </div>
      <div data-testid="fld-count" className="text-xs text-center text-muted-foreground">
        已收到 {designs.length} 個旗幟設計
      </div>

      {stage === "design" && !myDesign && (
        <div data-testid="fld-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">選一個隊伍圖騰</div>
            <div data-testid="fld-emoji-grid" className="grid grid-cols-6 gap-2">
              {EMOJI_OPTIONS.map((em) => (
                <button
                  key={em}
                  data-testid={`fld-emoji-${em}`}
                  onClick={() => setSelectedEmoji(em)}
                  className={`text-2xl p-2 rounded-lg border-2 transition-colors ${
                    selectedEmoji === em
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-transparent hover:border-muted"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">精神標語</label>
            <input
              data-testid="fld-motto-input"
              type="text"
              className="border rounded-lg px-3 py-2 text-sm w-full"
              placeholder="例：無所畏懼，勇往直前"
              maxLength={20}
              value={motto}
              onChange={(e) => setMotto(e.target.value)}
            />
          </div>
          <button
            data-testid="fld-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmitDesign}
            className="bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Flag className="w-4 h-4" />
            提交旗幟設計
          </button>
        </div>
      )}

      {myDesign && stage === "design" && (
        <div data-testid="fld-my-design" className="bg-indigo-50 rounded-xl p-4 border border-indigo-200 text-center">
          <div className="text-4xl mb-2">{myDesign.emoji}</div>
          <div className="font-semibold text-indigo-700">{myDesign.motto}</div>
          <div className="text-xs text-muted-foreground mt-1">你的旗幟已提交</div>
        </div>
      )}

      {stage === "vote" && designs.length > 0 && (
        <div data-testid="fld-vote-list" className="grid grid-cols-2 gap-2">
          {designs.map((d) => (
            <button
              key={d.entryId}
              data-testid={`fld-vote-item-${d.entryId}`}
              onClick={() => handleVote(d.entryId)}
              disabled={!!myVote}
              className={`rounded-xl p-3 border-2 text-center transition-colors ${
                myVote?.targetEntryId === d.entryId
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-border hover:border-indigo-300"
              } disabled:cursor-default`}
            >
              <div className="text-3xl mb-1">{d.emoji}</div>
              <div className="text-xs font-semibold leading-tight">{d.motto}</div>
              <div className="text-xs text-muted-foreground mt-1">{d.userName}</div>
            </button>
          ))}
        </div>
      )}

      {myVote && stage === "vote" && (
        <div data-testid="fld-my-vote" className="text-xs text-center text-muted-foreground">
          已投票！等待揭曉。
        </div>
      )}

      {isTeamLead && stage !== "reveal" && (
        <button
          data-testid="fld-advance-btn"
          onClick={handleAdvanceStage}
          className="bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Flag className="w-4 h-4" />
          {stage === "design" ? "進入投票階段" : "揭曉結果"}
        </button>
      )}

      {stage === "reveal" && designs.length === 0 && (
        <div data-testid="fld-empty" className="text-center text-muted-foreground p-8">
          還沒有人設計旗幟
        </div>
      )}

      {stage === "reveal" && winner && (
        <div data-testid="fld-result" className="flex flex-col gap-3">
          <div data-testid="fld-winner" className="bg-indigo-50 border-2 border-indigo-400 rounded-2xl p-6 text-center">
            <Trophy className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
            <div className="text-5xl mb-2">{winner.emoji}</div>
            <div className="text-lg font-bold text-indigo-700">{winner.motto}</div>
            <div className="text-xs text-indigo-500 mt-1">
              {voteCount(winner.entryId)} 票 · 設計者：{winner.userName}
            </div>
          </div>
          <div data-testid="fld-all-results" className="grid grid-cols-2 gap-2">
            {designs
              .slice()
              .sort((a, b) => voteCount(b.entryId) - voteCount(a.entryId))
              .map((d) => (
                <div
                  key={d.entryId}
                  data-testid={`fld-result-${d.entryId}`}
                  className="rounded-xl p-3 border text-center bg-muted"
                >
                  <div className="text-2xl mb-1">{d.emoji}</div>
                  <div className="text-xs font-semibold">{d.motto}</div>
                  <div className="text-xs text-muted-foreground">{voteCount(d.entryId)} 票</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
