import React, { useState } from "react";

export interface PitchVoteConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
  showAuthor: boolean;
}

export interface PitchRating extends Record<string, unknown> {
  raterId: string;
  score: number;
}

export interface Pitch extends Record<string, unknown> {
  pitchId: string;
  userId: string;
  userName: string;
  text: string;
  ratings: PitchRating[];
}

export interface PitchVoteState extends Record<string, unknown> {
  pitches: Pitch[];
  phase: "submit" | "vote" | "result";
}

interface Props {
  config: PitchVoteConfig;
  state: PitchVoteState;
  myUserId: string;
  onSubmitPitch: (text: string) => void;
  onRate: (pitchId: string, score: number) => void;
  onAdvancePhase: () => void;
}

function avgScore(ratings: PitchRating[]): number {
  if (ratings.length === 0) return 0;
  return ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
}

function StarRow({
  pitchId,
  myRating,
  disabled,
  onRate,
}: {
  pitchId: string;
  myRating: number;
  disabled: boolean;
  onRate: (pitchId: string, score: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          data-testid={`pv-star-${pitchId}-${s}`}
          onClick={() => !disabled && onRate(pitchId, myRating === s ? 0 : s)}
          disabled={disabled}
          className={`text-xl transition-transform hover:scale-110 disabled:cursor-not-allowed ${
            s <= myRating ? "opacity-100" : "opacity-30"
          }`}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}

export default function PitchVote({
  config,
  state,
  myUserId,
  onSubmitPitch,
  onRate,
  onAdvancePhase,
}: Props) {
  const { title, prompt, maxLength, showAuthor } = config;
  const { pitches, phase } = state;

  const myPitch = pitches.find((p) => p.userId === myUserId);
  const [draft, setDraft] = useState("");

  const canSubmit = draft.trim().length > 0 && draft.length <= maxLength && !myPitch;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmitPitch(draft.trim());
    setDraft("");
  }

  const sortedByScore = [...pitches].sort(
    (a, b) => avgScore(b.ratings) - avgScore(a.ratings)
  );

  return (
    <div data-testid="pv-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="pv-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p data-testid="pv-prompt" className="text-sm text-center text-gray-600 bg-orange-50 p-3 rounded-xl border border-orange-100">
        {prompt}
      </p>

      <div data-testid="pv-phase" className="text-center text-xs font-semibold text-orange-700">
        {phase === "submit" && "💡 提案階段"}
        {phase === "vote" && "⭐ 評分階段"}
        {phase === "result" && "🏆 結果揭曉"}
      </div>

      <div data-testid="pv-pitch-count" className="text-center text-sm text-gray-500">
        <span className="font-semibold text-orange-600">{pitches.length}</span> 個提案
      </div>

      {phase === "submit" && (
        <div className="flex flex-col gap-3">
          {!myPitch ? (
            <>
              <div className="flex flex-col gap-1">
                <input
                  data-testid="pv-pitch-input"
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="用一句話說出你的創意提案…"
                  maxLength={maxLength + 5}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                {draft.length > maxLength && (
                  <p data-testid="pv-pitch-error" className="text-xs text-red-500 text-center">
                    提案最多 {maxLength} 字
                  </p>
                )}
              </div>
              <button
                data-testid="pv-submit-btn"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                送出提案
              </button>
            </>
          ) : (
            <div data-testid="pv-submitted-msg" className="p-3 bg-green-50 rounded-xl border border-green-200 text-center">
              <p className="text-sm text-gray-700">「{myPitch.text}」</p>
              <p className="text-green-700 font-semibold text-sm mt-1">✅ 已送出！等待進入評分</p>
            </div>
          )}

          <button
            data-testid="pv-advance-btn"
            onClick={onAdvancePhase}
            className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 text-sm"
          >
            開始評分
          </button>
        </div>
      )}

      {phase === "vote" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-center text-gray-500">為每個提案評分（1-5 顆星，自己的提案不能評）</p>
          {pitches.map((pitch) => {
            const myRating = pitch.ratings.find((r) => r.raterId === myUserId)?.score ?? 0;
            const isOwn = pitch.userId === myUserId;
            return (
              <div
                key={pitch.pitchId}
                data-testid={`pv-pitch-${pitch.pitchId}`}
                className="p-3 bg-white rounded-xl border border-gray-200"
              >
                {showAuthor && (
                  <p className="text-xs text-orange-500 font-semibold mb-1">{pitch.userName}</p>
                )}
                <p className="text-sm text-gray-700 mb-2">{pitch.text}</p>
                <div className="flex items-center gap-3">
                  <StarRow
                    pitchId={pitch.pitchId}
                    myRating={myRating}
                    disabled={isOwn}
                    onRate={onRate}
                  />
                  {isOwn && <span className="text-xs text-gray-400">我的提案</span>}
                </div>
              </div>
            );
          })}

          <button
            data-testid="pv-advance-btn"
            onClick={onAdvancePhase}
            className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 text-sm"
          >
            揭曉結果
          </button>
        </div>
      )}

      {phase === "result" && (
        <div data-testid="pv-result" className="flex flex-col gap-3">
          {pitches.length === 0 ? (
            <div data-testid="pv-empty" className="text-center text-gray-400 p-8">
              還沒有人提案
            </div>
          ) : (
            sortedByScore.map((pitch, idx) => {
              const avg = avgScore(pitch.ratings);
              const filled = Math.round(avg);
              return (
                <div
                  key={pitch.pitchId}
                  data-testid={`pv-result-${pitch.pitchId}`}
                  className={`p-4 rounded-xl border shadow-sm ${
                    idx === 0 ? "bg-orange-50 border-orange-200" : "bg-white border-gray-100"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {idx === 0 && <span className="text-lg">🏆</span>}
                    <div className="flex-1">
                      {showAuthor && (
                        <p className="text-xs text-orange-500 font-semibold mb-0.5">
                          {pitch.userName}
                        </p>
                      )}
                      <p className="text-sm font-semibold text-gray-700">{pitch.text}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span
                            key={s}
                            data-testid={`pv-result-star-${pitch.pitchId}-${s}`}
                            className={`text-sm ${s <= filled ? "opacity-100" : "opacity-20"}`}
                          >
                            ⭐
                          </span>
                        ))}
                      </div>
                      <span
                        data-testid={`pv-result-avg-${pitch.pitchId}`}
                        className="text-xs text-gray-500"
                      >
                        {avg > 0 ? avg.toFixed(1) : "—"}（{pitch.ratings.length}人評）
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
