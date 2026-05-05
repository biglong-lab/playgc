import { CheckCircle2, Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TeamContractConfig {
  title: string;
  contractText: string;
  pledgeLabel?: string;
  showSigners: boolean;
  targetCount?: number;
  celebrationText?: string;
}

export interface ContractSigner {
  userId: string;
  userName: string;
  signedAt: number;
}

export interface TeamContractState extends Record<string, unknown> {
  signers: ContractSigner[];
}

interface Props {
  config: TeamContractConfig;
  state: TeamContractState;
  myUserId: string;
  onSign: () => void;
}

export default function TeamContract({ config, state, myUserId, onSign }: Props) {
  const {
    title,
    contractText,
    pledgeLabel = "我承諾！",
    showSigners,
    targetCount,
    celebrationText = "全員完成簽署！",
  } = config;

  const { signers } = state;

  const hasSigned = signers.some((s) => s.userId === myUserId);
  const signCount = signers.length;
  const isComplete = targetCount ? signCount >= targetCount : false;
  const pct = targetCount ? Math.min(100, Math.round((signCount / targetCount) * 100)) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex flex-col px-4 py-6 gap-6" data-testid="team-contract-root">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800" data-testid="tc-title">{title}</h1>
      </div>

      {/* Contract */}
      <div className="bg-white rounded-2xl shadow p-6 border-2 border-gray-200">
        <div className="text-center text-gray-400 text-xs mb-4 tracking-widest uppercase">承諾書</div>
        <p className="text-gray-700 leading-relaxed text-center whitespace-pre-wrap" data-testid="tc-contract-text">
          {contractText}
        </p>

        {/* Sign line */}
        <div className="border-t border-dashed border-gray-200 mt-6 pt-4 text-center">
          <p className="text-xs text-gray-400 mb-3">簽署此承諾書代表你的鄭重承諾</p>

          {!hasSigned ? (
            <Button
              onClick={onSign}
              className="bg-slate-700 hover:bg-slate-800 text-white px-8"
              data-testid="tc-sign-btn"
            >
              <Stamp className="w-4 h-4 mr-2" />
              {pledgeLabel}
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-green-600 font-medium" data-testid="tc-signed-msg">
              <CheckCircle2 className="w-5 h-5" />
              已簽署
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      {targetCount && (
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
            <span>簽署進度</span>
            <span data-testid="tc-sign-count">{signCount}</span>
            <span className="text-gray-400">/ {targetCount} 人</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-slate-600 h-3 rounded-full transition-all"
              style={{ width: `${pct}%` }}
              data-testid="tc-progress-bar"
            />
          </div>
          {isComplete && (
            <div className="text-center text-green-600 font-medium mt-3 text-sm" data-testid="tc-complete-msg">
              🎉 {celebrationText}
            </div>
          )}
        </div>
      )}

      {/* Signer list */}
      {showSigners && signers.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-4" data-testid="tc-signer-list">
          <p className="text-xs text-gray-400 mb-3">已簽署（{signCount} 人）：</p>
          <div className="flex flex-wrap gap-2">
            {signers.map((s) => (
              <span
                key={s.userId}
                className="flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full"
                data-testid={`tc-signer-${s.userId}`}
              >
                <CheckCircle2 className="w-3 h-3" />
                {s.userName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Not signed yet */}
      {!hasSigned && signers.length === 0 && (
        <div className="text-center text-gray-400 text-sm" data-testid="tc-no-signers">
          還沒有人簽署，第一個承諾吧！
        </div>
      )}
    </div>
  );
}
