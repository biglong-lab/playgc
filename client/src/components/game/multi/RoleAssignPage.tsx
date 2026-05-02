// 🎭 RoleAssignPage — pageType="role_assign" 對應容器
// W4 D3 簡化版：本地 state（W4 D5 整合 useTeamRoleAssignSync）

import { useState, useCallback } from "react";
import RoleAssign, { type RoleAssignConfig } from "./RoleAssign";
import { useAuth } from "@/hooks/useAuth";
import type { Page } from "@shared/schema";

interface RoleAssignPageProps {
  page: Page;
}

interface RoleAssignState {
  assignments: Record<string, string>;
}

export default function RoleAssignPage({ page }: RoleAssignPageProps) {
  const { user } = useAuth();
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: RoleAssignConfig } | RoleAssignConfig | null) ?? null;
  const config: RoleAssignConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as RoleAssignConfig | null)) ?? {
      title: "🎭 角色分派",
      subtitle: "推理遊戲開始 — 你扮演誰？",
      allowReroll: false,
      roles: [
        {
          id: "detective",
          name: "偵探",
          emoji: "🕵️",
          description: "你是案件的偵探。\n仔細聽嫌犯與證人的描述，找出真相。\n你可以詢問任何問題。",
          color: "#3b82f6",
        },
        {
          id: "suspect",
          name: "嫌犯",
          emoji: "🎭",
          description: "你被懷疑了！\n但你是無辜的（也可能不是）。\n撒謊或誠實由你決定。",
          color: "#ef4444",
          isSecret: true,
        },
        {
          id: "witness",
          name: "證人",
          emoji: "👁",
          description: "你看到事發經過。\n但你的記憶可能不完整。\n誠實回答偵探的問題。",
          color: "#10b981",
        },
      ],
    };

  const [state, setState] = useState<RoleAssignState>({ assignments: {} });

  const handleAssign = useCallback((userName: string, roleId: string) => {
    setState((prev) => {
      if (prev.assignments[userName]) return prev; // 已分配，不重複
      return { assignments: { ...prev.assignments, [userName]: roleId } };
    });
  }, []);

  const handleReroll = useCallback(() => {
    setState((prev) => {
      const next = { ...prev.assignments };
      delete next[myUserName];
      return { assignments: next };
    });
  }, [myUserName]);

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
