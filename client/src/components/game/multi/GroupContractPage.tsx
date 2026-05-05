import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import GroupContract, { GroupContractConfig, GroupContractState, ContractRule } from "./GroupContract";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: GroupContractConfig = {
  title: "共識公約制定",
  prompt: "提出你認為這個團隊最重要的一條規則",
  maxRuleLength: 40,
  topN: 3,
};

const DEFAULT_STATE: GroupContractState = {
  rules: [],
  phase: "submit",
};

export default function GroupContractPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const rawConfig = page?.config;
  const config: GroupContractConfig =
    rawConfig && typeof rawConfig === "object" && "maxRuleLength" in rawConfig
      ? (rawConfig as GroupContractConfig)
      : rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: GroupContractConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<GroupContractState>({
    gameId,
    sessionId,
    pageId,
    type: "group_contract",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-emerald-500" />
      </div>
    );
  }

  function handleSubmitRule(text: string) {
    const newRule: ContractRule = {
      ruleId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text,
      votes: [],
    };
    updateState({ ...state, rules: [...state.rules, newRule] });
  }

  function handleVote(ruleId: string) {
    const updated = state.rules.map((r: ContractRule) => {
      if (r.ruleId !== ruleId) return r;
      const already = r.votes.includes(myUserId);
      return {
        ...r,
        votes: already
          ? r.votes.filter((v: string) => v !== myUserId)
          : [...r.votes, myUserId],
      };
    });
    updateState({ ...state, rules: updated });
  }

  function handleAdvancePhase() {
    const next = state.phase === "submit" ? "vote" : "result";
    updateState({ ...state, phase: next });
  }

  return (
    <GroupContract
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmitRule={handleSubmitRule}
      onVote={handleVote}
      onAdvancePhase={handleAdvancePhase}
    />
  );
}
