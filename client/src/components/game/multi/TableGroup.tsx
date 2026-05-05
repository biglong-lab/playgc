import { Button } from "@/components/ui/button";

export interface TableMember extends Record<string, unknown> {
  memberId: string;
  userId: string;
  userName: string;
  tableIndex: number;
}

export interface TableGroupConfig extends Record<string, unknown> {
  title: string;
  tableCount: number;
  tableNames: string[];
}

export interface TableGroupState extends Record<string, unknown> {
  members: TableMember[];
  revealed: boolean;
}

interface TableGroupProps {
  config: TableGroupConfig;
  state: TableGroupState;
  myUserId: string;
  onJoin: (tableIndex: number) => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: TableGroupConfig = {
  title: "桌組分配",
  tableCount: 3,
  tableNames: ["桌 A", "桌 B", "桌 C"],
};

function extractConfig(raw: unknown): TableGroupConfig {
  const r = raw as Record<string, unknown>;
  if (r && "tableCount" in r && typeof r.tableCount === "number") return r as unknown as TableGroupConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("tableCount" in c && typeof c.tableCount === "number") return c as unknown as TableGroupConfig;
  }
  return DEFAULT_CONFIG;
}

function tableLabel(config: TableGroupConfig, idx: number): string {
  return config.tableNames?.[idx] ?? `桌 ${idx + 1}`;
}

export default function TableGroup({ config: rawConfig, state, myUserId, onJoin, onReveal }: TableGroupProps) {
  const config = extractConfig(rawConfig as unknown);
  const count = Math.max(1, config.tableCount);
  const tables = Array.from({ length: count }, (_, i) => i);

  const myMember = state.members.find((m) => m.userId === myUserId);

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="tg-result">
        <h2 className="text-xl font-bold" data-testid="tg-title">{config.title}</h2>
        <p className="text-sm text-muted-foreground" data-testid="tg-count">共 {state.members.length} 人</p>
        {state.members.length === 0 ? (
          <p className="text-muted-foreground" data-testid="tg-empty">還沒有人加入桌組</p>
        ) : (
          <div className="grid gap-3">
            {tables.map((idx) => {
              const group = state.members.filter((m) => m.tableIndex === idx);
              return (
                <div key={idx} className="p-3 border rounded" data-testid={`tg-result-table-${idx}`}>
                  <p className="font-semibold text-sm mb-1">{tableLabel(config, idx)} ({group.length} 人)</p>
                  <div className="flex flex-wrap gap-1">
                    {group.map((m) => (
                      <span key={m.memberId} className="px-2 py-0.5 bg-muted rounded text-xs">{m.userName}</span>
                    ))}
                    {group.length === 0 && <span className="text-xs text-muted-foreground">尚無成員</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="tg-title">{config.title}</h2>
      <p className="text-sm text-muted-foreground" data-testid="tg-count">已加入：{state.members.length} 人</p>

      {myMember ? (
        <div className="p-3 border rounded bg-muted/30" data-testid="tg-my-table">
          你在：<strong>{tableLabel(config, myMember.tableIndex)}</strong>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {tables.map((idx) => {
            const cnt = state.members.filter((m) => m.tableIndex === idx).length;
            return (
              <Button
                key={idx}
                variant="outline"
                onClick={() => onJoin(idx)}
                data-testid={`tg-table-${idx}`}
              >
                {tableLabel(config, idx)} ({cnt})
              </Button>
            );
          })}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="tg-reveal-btn">
        公布分組
      </Button>
    </div>
  );
}
