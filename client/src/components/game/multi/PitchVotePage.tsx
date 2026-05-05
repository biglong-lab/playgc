import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import PitchVote, { PitchVoteConfig, PitchVoteState, Pitch, PitchRating } from "./PitchVote";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: PitchVoteConfig = {
  title: "創意提案評分",
  prompt: "用一句話說出你的創意提案，讓大家來評分！",
  maxLength: 60,
  showAuthor: true,
};

const DEFAULT_STATE: PitchVoteState = {
  pitches: [],
  phase: "submit",
};

export default function PitchVotePage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const rawConfig = page?.config;
  const config: PitchVoteConfig =
    rawConfig && typeof rawConfig === "object" && "maxLength" in rawConfig
      ? (rawConfig as PitchVoteConfig)
      : rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: PitchVoteConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<PitchVoteState>({
    gameId,
    sessionId,
    pageId,
    type: "pitch_vote",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-orange-500" />
      </div>
    );
  }

  function handleSubmitPitch(text: string) {
    const newPitch: Pitch = {
      pitchId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text,
      ratings: [],
    };
    updateState({ ...state, pitches: [...state.pitches, newPitch] });
  }

  function handleRate(pitchId: string, score: number) {
    const updated = state.pitches.map((p: Pitch) => {
      if (p.pitchId !== pitchId) return p;
      const filtered = p.ratings.filter((r: PitchRating) => r.raterId !== myUserId);
      const newRatings: PitchRating[] = score > 0 ? [...filtered, { raterId: myUserId, score }] : filtered;
      return { ...p, ratings: newRatings };
    });
    updateState({ ...state, pitches: updated });
  }

  function handleAdvancePhase() {
    const next = state.phase === "submit" ? "vote" : "result";
    updateState({ ...state, phase: next });
  }

  return (
    <PitchVote
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmitPitch={handleSubmitPitch}
      onRate={handleRate}
      onAdvancePhase={handleAdvancePhase}
    />
  );
}
