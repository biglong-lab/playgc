import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import TeamContract, {
  type TeamContractConfig,
  type TeamContractState,
  type ContractSigner,
} from "./TeamContract";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface TeamContractPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: TeamContractConfig = {
  title: "📜 團隊承諾書",
  contractText: "我們承諾彼此尊重、積極合作，共同達成目標！",
  pledgeLabel: "我承諾！",
  showSigners: true,
  celebrationText: "全員完成簽署！",
};

const DEFAULT_STATE: TeamContractState = { signers: [] };

export default function TeamContractPage({ page, sessionId, gameId, pageId }: TeamContractPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: TeamContractConfig } | TeamContractConfig | null) ?? null;
  const config: TeamContractConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as TeamContractConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamContractState>({
    gameId,
    sessionId,
    pageId,
    type: "team_contract",
    defaultState: DEFAULT_STATE,
  });

  const handleSign = useCallback(async () => {
    if (state.signers.some((s: ContractSigner) => s.userId === myUserId)) return;
    const newSigner: ContractSigner = {
      userId: myUserId,
      userName: myUserName,
      signedAt: Date.now(),
    };
    await updateState({ ...state, signers: [...state.signers, newSigner] });
  }, [state, myUserId, myUserName, updateState]);

  if (!isLoaded) {
    return (
      <Card className="m-4">
        <CardContent className="flex items-center gap-2 py-4">
          <Loader2 className="animate-spin w-4 h-4" />
          <span>載入中…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <TeamContract
      config={config}
      state={state}
      myUserId={myUserId}
      onSign={handleSign}
    />
  );
}
