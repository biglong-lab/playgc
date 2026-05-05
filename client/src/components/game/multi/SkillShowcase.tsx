import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SkillEntry {
  entryId: string;
  userId: string;
  userName: string;
  offerSkill: string;
  learnSkill: string;
}

interface SkillShowcaseState extends Record<string, unknown> {
  entries: SkillEntry[];
  revealed: boolean;
}

interface SkillShowcaseConfig {
  title: string;
  offerLabel: string;
  learnLabel: string;
  suggestions: string[];
}

const DEFAULT_SUGGESTIONS = [
  "簡報技巧", "資料分析", "專案管理", "設計思考", "程式開發",
  "溝通協調", "財務規劃", "行銷策略", "客戶服務", "領導力",
  "社群媒體", "文案撰寫", "影像剪輯", "法律知識", "外語能力",
];

function extractConfig(raw: Record<string, unknown>): SkillShowcaseConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "技能交流",
    offerLabel: typeof raw.offerLabel === "string" ? raw.offerLabel : "我能教大家",
    learnLabel: typeof raw.learnLabel === "string" ? raw.learnLabel : "我想學習",
    suggestions: Array.isArray(raw.suggestions)
      ? (raw.suggestions as string[])
      : DEFAULT_SUGGESTIONS,
  };
}

const DEFAULT_STATE: SkillShowcaseState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SkillShowcase({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<SkillShowcaseState>({
    gameId,
    sessionId,
    pageId,
    type: "skill_showcase",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [offerSkill, setOfferSkill] = useState("");
  const [learnSkill, setLearnSkill] = useState("");
  const [offerCustom, setOfferCustom] = useState("");
  const [learnCustom, setLearnCustom] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="ss-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const finalOffer = offerSkill || offerCustom.trim();
  const finalLearn = learnSkill || learnCustom.trim();
  const canSubmit = finalOffer.length > 0 && finalLearn.length > 0;

  function selectOffer(skill: string) {
    setOfferSkill((prev) => (prev === skill ? "" : skill));
    setOfferCustom("");
  }

  function selectLearn(skill: string) {
    setLearnSkill((prev) => (prev === skill ? "" : skill));
    setLearnCustom("");
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: SkillEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      offerSkill: finalOffer,
      learnSkill: finalLearn,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const offerFreq: Record<string, number> = {};
  const learnFreq: Record<string, number> = {};
  state.entries.forEach((e) => {
    offerFreq[e.offerSkill] = (offerFreq[e.offerSkill] ?? 0) + 1;
    learnFreq[e.learnSkill] = (learnFreq[e.learnSkill] ?? 0) + 1;
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-500" />
        <h2 className="text-xl font-bold" data-testid="ss-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-xs text-gray-400" data-testid="ss-count">
        已登記：{state.entries.length} 人
      </p>

      {!myEntry ? (
        <div className="space-y-5" data-testid="ss-form">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2" data-testid="ss-offer-label">
              ⭐ {cfg.offerLabel}
            </p>
            <div className="flex flex-wrap gap-2 mb-2" data-testid="ss-offer-suggestions">
              {cfg.suggestions.map((s) => (
                <button
                  key={s}
                  data-testid={`ss-offer-tag-${s}`}
                  onClick={() => selectOffer(s)}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    offerSkill === s
                      ? "bg-amber-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-amber-100"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              data-testid="ss-offer-custom"
              className="w-full border rounded p-2 text-sm"
              placeholder="或自行輸入技能…"
              maxLength={20}
              value={offerCustom}
              onChange={(e) => {
                setOfferCustom(e.target.value);
                setOfferSkill("");
              }}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2" data-testid="ss-learn-label">
              🎓 {cfg.learnLabel}
            </p>
            <div className="flex flex-wrap gap-2 mb-2" data-testid="ss-learn-suggestions">
              {cfg.suggestions.map((s) => (
                <button
                  key={s}
                  data-testid={`ss-learn-tag-${s}`}
                  onClick={() => selectLearn(s)}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    learnSkill === s
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-blue-100"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              data-testid="ss-learn-custom"
              className="w-full border rounded p-2 text-sm"
              placeholder="或自行輸入想學的技能…"
              maxLength={20}
              value={learnCustom}
              onChange={(e) => {
                setLearnCustom(e.target.value);
                setLearnSkill("");
              }}
            />
          </div>

          <button
            data-testid="ss-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-amber-500 text-white rounded disabled:opacity-40 text-sm"
          >
            登記技能
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-amber-50 rounded border border-amber-200 text-sm space-y-1"
          data-testid="ss-my-entry"
        >
          <p className="text-xs text-gray-600">⭐ 能教：<span className="font-medium">{myEntry.offerSkill}</span></p>
          <p className="text-xs text-gray-600">🎓 想學：<span className="font-medium">{myEntry.learnSkill}</span></p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ss-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示技能交流板
        </button>
      )}

      {state.revealed && (
        <div data-testid="ss-result" className="space-y-4">
          <p className="text-sm font-semibold text-gray-600">🌟 技能交流板</p>
          {state.entries.length === 0 ? (
            <p data-testid="ss-empty" className="text-gray-400 text-sm">尚無登記</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  data-testid={`ss-card-${entry.entryId}`}
                  className="p-3 bg-white border rounded shadow-sm"
                >
                  <p className="text-sm font-semibold text-gray-700">{entry.userName}</p>
                  <p className="text-xs text-amber-600 mt-1">⭐ 能教：{entry.offerSkill}</p>
                  <p className="text-xs text-blue-600">🎓 想學：{entry.learnSkill}</p>
                </div>
              ))}
            </div>
          )}
          {Object.keys(offerFreq).length > 0 && (
            <div data-testid="ss-offer-stats" className="space-y-1">
              <p className="text-xs font-medium text-gray-500">熱門教學技能</p>
              {Object.entries(offerFreq)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([skill, count]) => (
                  <div key={skill} className="flex justify-between text-xs text-gray-600">
                    <span>{skill}</span>
                    <span className="font-medium">{count} 人</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SkillShowcase;
