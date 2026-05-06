import { useState } from "react";
import { Repeat2, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SwapEntry {
  entryId: string;
  userId: string;
  userName: string;
  teachSkill: string;
  teachTarget: string;
  learnSkill: string;
  learnTarget: string;
}

interface TalentSwapState extends Record<string, unknown> {
  entries: SwapEntry[];
  revealed: boolean;
}

interface TalentSwapConfig {
  title: string;
  teachPrompt: string;
  learnPrompt: string;
}

function extractConfig(raw: Record<string, unknown>): TalentSwapConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "技能交換市集",
    teachPrompt:
      typeof raw.teachPrompt === "string"
        ? raw.teachPrompt
        : "我可以教誰什麼？",
    learnPrompt:
      typeof raw.learnPrompt === "string"
        ? raw.learnPrompt
        : "我想向誰學什麼？",
  };
}

const DEFAULT_STATE: TalentSwapState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TalentSwap({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<TalentSwapState>({
    gameId,
    sessionId,
    pageId,
    type: "talent_swap",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [teachSkill, setTeachSkill] = useState("");
  const [teachTarget, setTeachTarget] = useState("");
  const [learnSkill, setLearnSkill] = useState("");
  const [learnTarget, setLearnTarget] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="ts-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit =
    teachSkill.trim().length >= 2 &&
    teachTarget.trim().length >= 1 &&
    learnSkill.trim().length >= 2 &&
    learnTarget.trim().length >= 1;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: SwapEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      teachSkill: teachSkill.trim(),
      teachTarget: teachTarget.trim(),
      learnSkill: learnSkill.trim(),
      learnTarget: learnTarget.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function buildMatchMap() {
    const map: Record<string, string[]> = {};
    state.entries.forEach((e) => {
      const key = e.learnTarget;
      if (!map[key]) map[key] = [];
      map[key].push(`${e.userName} 想學 ${e.learnSkill}`);
    });
    return map;
  }

  const matchMap = state.revealed ? buildMatchMap() : {};

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Repeat2 className="w-5 h-5 text-indigo-600" />
        <h2 className="text-xl font-bold" data-testid="ts-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-xs text-gray-400" data-testid="ts-count">
        已提交：{state.entries.length} 份
      </p>

      {!myEntry ? (
        <div className="space-y-4" data-testid="ts-form">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-green-700">{cfg.teachPrompt}</p>
            <input
              data-testid="ts-teach-skill"
              className="w-full border rounded p-2 text-sm"
              placeholder="我可以教的技能／知識（≥2字）"
              maxLength={40}
              value={teachSkill}
              onChange={(e) => setTeachSkill(e.target.value)}
            />
            <input
              data-testid="ts-teach-target"
              className="w-full border rounded p-2 text-sm"
              placeholder="我想教的對象（隊友名字）"
              maxLength={20}
              value={teachTarget}
              onChange={(e) => setTeachTarget(e.target.value)}
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-blue-700">{cfg.learnPrompt}</p>
            <input
              data-testid="ts-learn-skill"
              className="w-full border rounded p-2 text-sm"
              placeholder="我想學的技能／知識（≥2字）"
              maxLength={40}
              value={learnSkill}
              onChange={(e) => setLearnSkill(e.target.value)}
            />
            <input
              data-testid="ts-learn-target"
              className="w-full border rounded p-2 text-sm"
              placeholder="我想向誰學（隊友名字）"
              maxLength={20}
              value={learnTarget}
              onChange={(e) => setLearnTarget(e.target.value)}
            />
          </div>

          <button
            data-testid="ts-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-40 text-sm"
          >
            提交交換提案
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-indigo-50 rounded border border-indigo-200 text-sm"
          data-testid="ts-my-entry"
        >
          <p className="text-xs text-indigo-600 font-medium mb-2">你的提案</p>
          <p className="text-xs text-gray-600">
            <span className="text-green-700 font-medium">教</span> {myEntry.teachTarget}：{myEntry.teachSkill}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            <span className="text-blue-700 font-medium">學自</span> {myEntry.learnTarget}：{myEntry.learnSkill}
          </p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ts-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示交換市集
        </button>
      )}

      {state.revealed && (
        <div data-testid="ts-result" className="space-y-4">
          <p className="text-sm font-semibold text-gray-600">🔄 技能交換總覽</p>
          {state.entries.length === 0 ? (
            <p data-testid="ts-empty" className="text-gray-400 text-sm">尚無提交</p>
          ) : (
            <>
              <div className="space-y-2">
                {state.entries.map((entry) => (
                  <div
                    key={entry.entryId}
                    data-testid={`ts-card-${entry.entryId}`}
                    className="p-3 bg-white border rounded shadow-sm text-xs"
                  >
                    <p className="font-semibold text-gray-700 mb-1">{entry.userName}</p>
                    <p className="text-green-700">
                      教 <span className="font-medium">{entry.teachTarget}</span>：{entry.teachSkill}
                    </p>
                    <p className="text-blue-700 mt-0.5">
                      學自 <span className="font-medium">{entry.learnTarget}</span>：{entry.learnSkill}
                    </p>
                  </div>
                ))}
              </div>

              {Object.keys(matchMap).length > 0 && (
                <div data-testid="ts-match-map" className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-xs font-semibold text-yellow-700 mb-2">📬 誰被點名學習</p>
                  {Object.entries(matchMap).map(([target, requests]) => (
                    <div key={target} className="mb-1">
                      <span className="text-xs font-medium text-gray-700">{target}</span>
                      <span className="text-xs text-gray-500">：{requests.join("、")}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default TalentSwap;
