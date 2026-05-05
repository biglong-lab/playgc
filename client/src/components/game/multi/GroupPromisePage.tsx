import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import GroupPromise from "./GroupPromise";
import type { GroupPromiseConfig, GroupPromiseState, Signer } from "./GroupPromise";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface GroupPromisePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: GroupPromiseConfig = {
  title: "🤝 集體承諾宣言",
  pledgeText: "我承諾將今天學到的知識，落實應用在工作中，並在一個月內回報成果。",
  goalSigners: 20,
};

const DEFAULT_STATE: GroupPromiseState = {
  signers: [],
};

export default function GroupPromisePage({ page, sessionId, gameId, pageId }: GroupPromisePageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: GroupPromiseConfig } | GroupPromiseConfig | null) ?? null;
  const config: GroupPromiseConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as GroupPromiseConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<GroupPromiseState>({
    gameId,
    sessionId,
    pageId,
    type: "group_promise",
    defaultState: DEFAULT_STATE,
  });

  const handleSign = useCallback(async () => {
    const already = state.signers.some((s: Signer) => s.userId === myUserId);
    if (already) return;
    const newSigner: Signer = {
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
    <GroupPromise
      config={config}
      state={state}
      myUserId={myUserId}
      onSign={handleSign}
    />
  );
}
