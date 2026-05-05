import React, { useState } from "react";

export interface GroupContractConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxRuleLength: number;
  topN: number;
}

export interface ContractRule extends Record<string, unknown> {
  ruleId: string;
  userId: string;
  userName: string;
  text: string;
  votes: string[];
}

export interface GroupContractState extends Record<string, unknown> {
  rules: ContractRule[];
  phase: "submit" | "vote" | "result";
}

interface Props {
  config: GroupContractConfig;
  state: GroupContractState;
  myUserId: string;
  onSubmitRule: (text: string) => void;
  onVote: (ruleId: string) => void;
  onAdvancePhase: () => void;
}

export default function GroupContract({
  config,
  state,
  myUserId,
  onSubmitRule,
  onVote,
  onAdvancePhase,
}: Props) {
  const { title, prompt, maxRuleLength, topN } = config;
  const { rules, phase } = state;

  const myRule = rules.find((r) => r.userId === myUserId);
  const [draft, setDraft] = useState("");

  const canSubmit = draft.trim().length > 0 && draft.length <= maxRuleLength && !myRule;
  const sortedByVotes = [...rules].sort((a, b) => b.votes.length - a.votes.length);
  const adoptedRuleIds = new Set(sortedByVotes.slice(0, topN).map((r) => r.ruleId));

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmitRule(draft.trim());
    setDraft("");
  }

  return (
    <div data-testid="gc-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="gc-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p data-testid="gc-prompt" className="text-sm text-center text-gray-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
        {prompt}
      </p>

      <div data-testid="gc-phase" className="text-center text-xs font-semibold text-emerald-700">
        {phase === "submit" && "📝 提案階段"}
        {phase === "vote" && "🗳️ 投票階段"}
        {phase === "result" && "📜 公約確立"}
      </div>

      <div data-testid="gc-rule-count" className="text-center text-sm text-gray-500">
        <span className="font-semibold text-emerald-600">{rules.length}</span> 條提案
      </div>

      {phase === "submit" && (
        <div className="flex flex-col gap-3">
          {!myRule ? (
            <>
              <div className="flex flex-col gap-1">
                <input
                  data-testid="gc-rule-input"
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="提出一條你認為重要的規則…"
                  maxLength={maxRuleLength + 5}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
                {draft.length > maxRuleLength && (
                  <p data-testid="gc-rule-error" className="text-xs text-red-500 text-center">
                    規則最多 {maxRuleLength} 字
                  </p>
                )}
              </div>

              <button
                data-testid="gc-submit-btn"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                送出我的提案
              </button>
            </>
          ) : (
            <div data-testid="gc-submitted-msg" className="p-3 bg-green-50 rounded-xl border border-green-200 text-center">
              <p className="text-sm text-gray-700">「{myRule.text}」</p>
              <p className="text-green-700 font-semibold text-sm mt-1">✅ 已送出！等待進入投票</p>
            </div>
          )}

          <button
            data-testid="gc-advance-btn"
            onClick={onAdvancePhase}
            className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 text-sm"
          >
            開始投票
          </button>
        </div>
      )}

      {phase === "vote" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-center text-gray-500">點擊你認同的規則為其投票（可多選，自己的規則不能投）</p>
          {rules.map((rule) => {
            const voted = rule.votes.includes(myUserId);
            const isOwn = rule.userId === myUserId;
            return (
              <div
                key={rule.ruleId}
                data-testid={`gc-rule-${rule.ruleId}`}
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  voted ? "bg-emerald-50 border-emerald-300" : "bg-white border-gray-200"
                }`}
              >
                <div className="flex-1 text-sm text-gray-700">{rule.text}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{rule.votes.length}票</span>
                  <button
                    data-testid={`gc-vote-btn-${rule.ruleId}`}
                    onClick={() => onVote(rule.ruleId)}
                    disabled={isOwn}
                    className={`px-2 py-1 rounded-full text-xs font-bold ${
                      voted
                        ? "bg-emerald-500 text-white"
                        : isOwn
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gray-100 text-gray-600 hover:bg-emerald-100"
                    }`}
                  >
                    {voted ? "✓ 已投" : isOwn ? "我的" : "投票"}
                  </button>
                </div>
              </div>
            );
          })}

          <button
            data-testid="gc-advance-btn"
            onClick={onAdvancePhase}
            className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 text-sm"
          >
            確立公約
          </button>
        </div>
      )}

      {phase === "result" && (
        <div data-testid="gc-result" className="flex flex-col gap-3">
          {rules.length === 0 ? (
            <div data-testid="gc-empty" className="text-center text-gray-400 p-8">
              還沒有人提案
            </div>
          ) : (
            <>
              <p className="text-xs text-center text-gray-500">
                得票前 {topN} 條成為正式公約 🏆
              </p>
              {sortedByVotes.map((rule, idx) => {
                const isAdopted = adoptedRuleIds.has(rule.ruleId);
                return (
                  <div
                    key={rule.ruleId}
                    data-testid={`gc-result-rule-${rule.ruleId}`}
                    className={`p-3 rounded-xl border ${
                      isAdopted
                        ? "bg-emerald-50 border-emerald-300"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {isAdopted && (
                        <span data-testid={`gc-adopted-${rule.ruleId}`} className="text-emerald-600 font-bold text-sm">
                          {idx + 1}.
                        </span>
                      )}
                      <p className="flex-1 text-sm text-gray-700">{rule.text}</p>
                      <span className="text-xs font-bold text-gray-500 ml-2">
                        {rule.votes.length}票
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
