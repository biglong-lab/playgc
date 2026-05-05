import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import TableGroup, { TableGroupConfig, TableGroupState, TableMember } from "./TableGroup";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: TableGroupState = { members: [], revealed: false };

export default function TableGroupPage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<TableGroupState>({
    gameId,
    sessionId,
    pageId,
    type: "table_group",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const r = raw as Record<string, unknown>;
  const config: TableGroupConfig =
    "tableCount" in r && typeof r.tableCount === "number"
      ? (r as unknown as TableGroupConfig)
      : r.config && "tableCount" in (r.config as Record<string, unknown>)
        ? (r.config as unknown as TableGroupConfig)
        : { title: "桌組分配", tableCount: 3, tableNames: ["桌 A", "桌 B", "桌 C"] };

  const myUserId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleJoin(tableIndex: number) {
    const existing = state.members.find((m) => m.userId === myUserId);
    if (existing) {
      const updated = state.members.map((m) =>
        m.userId === myUserId ? { ...m, tableIndex } : m
      );
      updateState({ ...state, members: updated });
      return;
    }
    const member: TableMember = {
      memberId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName,
      tableIndex,
    };
    updateState({ ...state, members: [...state.members, member] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <TableGroup
      config={config}
      state={state}
      myUserId={myUserId}
      onJoin={handleJoin}
      onReveal={handleReveal}
    />
  );
}
