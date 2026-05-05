// 🎭 RoleAssignPage — pageType="role_assign" 容器（L3 持久化版 2026-05-05）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import RoleAssign, { type RoleAssignConfig } from "./RoleAssign";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface RoleAssignPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface RoleAssignState extends Record<string, unknown> {
  assignments: Record<string, string>;
}

export default function RoleAssignPage({ page, sessionId, gameId, pageId }: RoleAssignPageProps) {
  const { user } = useAuth();
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: RoleAssignConfig } | RoleAssignConfig | null) ?? null;
  const config: RoleAssignConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as RoleAssignConfig | null)) ?? {
      title: "🎭 角色分派",
      subtitle: "推理遊戲開始 — 你扮演誰？",
      allowReroll: false,
      roles: [
        { id: "detective", name: "偵探", emoji: "🕵️", description: "你是案件的偵探。", color: "#3b82f6" },
        { id: "suspect", name: "嫌犯", emoji: "🎭", description: "你被懷疑了！", color: "#ef4444", isSecret: true },
        { id: "witness", name: "證人", emoji: "👁", description: "你看到事發經過。", color: "#10b981" },
      ],
    };

  const defaultState: RoleAssignState = { assignments: {} };

  const { state, updateState, isLoaded } = useTeamPagePersistence<RoleAssignState>({
    gameId, sessionId, pageId, type: "role_assign", defaultState,
  });

  const handleAssign = useCallback(async (userName: string, roleId: string) => {
    if (state.assignments[userName]) return;
    await updateState({ assignments: { ...state.assignments, [userName]: roleId } });
  }, [state.assignments, updateState]);

  const handleReroll = useCallback(async () => {
    const next = { ...state.assignments };
    delete next[myUserName];
    await updateState({ assignments: next });
  }, [state.assignments, myUserName, updateState]);

  if (!isLoaded) {
    return (
      <Card data-testid="role-assign-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <RoleAssign
      config={config}
      state={state}
      myUserName={myUserName}
      onAssign={handleAssign}
      onReroll={handleReroll}
    />
  );
}
