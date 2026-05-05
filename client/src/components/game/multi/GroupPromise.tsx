import React from "react";

export interface GroupPromiseConfig {
  title: string;
  pledgeText: string;
  goalSigners?: number;
}

export interface Signer {
  userId: string;
  userName: string;
  signedAt: number; // timestamp
}

export interface GroupPromiseState extends Record<string, unknown> {
  signers: Signer[];
}

interface Props {
  config: GroupPromiseConfig;
  state: GroupPromiseState;
  myUserId: string;
  onSign: () => void;
}

export default function GroupPromise({ config, state, myUserId, onSign }: Props) {
  const { title, pledgeText, goalSigners } = config;
  const { signers } = state;

  const hasSigned = signers.some((s) => s.userId === myUserId);
  const pct = goalSigners && goalSigners > 0
    ? Math.min(Math.round((signers.length / goalSigners) * 100), 100)
    : null;
  const goalReached = goalSigners ? signers.length >= goalSigners : false;

  return (
    <div data-testid="gp-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto text-center">
      <h2 data-testid="gp-title" className="text-lg font-bold">{title}</h2>

      {/* 宣言文字 */}
      <div data-testid="gp-pledge" className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-5 shadow-sm">
        <p className="font-semibold text-amber-800 text-base leading-relaxed">{pledgeText}</p>
      </div>

      {/* 進度條（如有目標） */}
      {goalSigners && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span data-testid="gp-count">{signers.length} 人已簽署</span>
            <span data-testid="gp-goal">目標 {goalSigners} 人</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              data-testid="gp-bar"
              className={[
                "h-full rounded-full transition-all duration-500",
                goalReached ? "bg-green-400" : "bg-amber-400",
              ].join(" ")}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct !== null && (
            <p data-testid="gp-pct" className="text-xs text-gray-400">{pct}%</p>
          )}
        </div>
      )}

      {/* 簽名按鈕 */}
      {!hasSigned ? (
        <button
          data-testid="gp-sign-btn"
          onClick={onSign}
          className="py-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-lg transition-all shadow-md"
        >
          ✍️ 我承諾
        </button>
      ) : (
        <div data-testid="gp-signed-msg" className="py-4 rounded-xl border-2 border-green-400 bg-green-50 text-green-700 font-bold text-lg">
          ✅ 已簽署承諾
        </div>
      )}

      {/* 達標慶祝 */}
      {goalReached && (
        <p data-testid="gp-achieved" className="text-center text-green-600 font-semibold text-sm">
          🎉 全員已達標！
        </p>
      )}

      {/* 簽署名單 */}
      {signers.length > 0 && (
        <div data-testid="gp-signer-list" className="flex flex-wrap gap-2 justify-center">
          {signers.map((signer) => (
            <span
              key={signer.userId}
              data-testid={`gp-signer-${signer.userId}`}
              className={[
                "text-xs px-2 py-1 rounded-full",
                signer.userId === myUserId
                  ? "bg-amber-100 text-amber-700 font-semibold"
                  : "bg-gray-100 text-gray-500",
              ].join(" ")}
            >
              {signer.userName}
            </span>
          ))}
        </div>
      )}

      {!goalSigners && (
        <p className="text-xs text-gray-400">
          <span data-testid="gp-count">{signers.length}</span> 人已簽署
        </p>
      )}
    </div>
  );
}
