import { Button } from "@/components/ui/button";

export interface RoleAssignment extends Record<string, unknown> {
  assignId: string;
  userId: string;
  userName: string;
  role: string;
}

export interface RolePlayCardConfig extends Record<string, unknown> {
  title: string;
  roles: string[];
}

export interface RolePlayCardState extends Record<string, unknown> {
  assignments: RoleAssignment[];
  revealed: boolean;
}

interface RolePlayCardProps {
  config: RolePlayCardConfig;
  state: RolePlayCardState;
  myUserId: string;
  onDraw: () => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: RolePlayCardConfig = {
  title: "角色扮演卡",
  roles: ["領導者", "觀察者", "挑戰者", "支持者"],
};

function extractConfig(raw: unknown): RolePlayCardConfig {
  const r = raw as Record<string, unknown>;
  if (r && "roles" in r && Array.isArray(r.roles)) return r as unknown as RolePlayCardConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("roles" in c && Array.isArray(c.roles)) return c as unknown as RolePlayCardConfig;
  }
  return DEFAULT_CONFIG;
}

export default function RolePlayCard({ config: rawConfig, state, myUserId, onDraw, onReveal }: RolePlayCardProps) {
  const config = extractConfig(rawConfig as unknown);
  const myAssignment = state.assignments.find((a) => a.userId === myUserId);

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="rpc-result">
        <h2 className="text-xl font-bold" data-testid="rpc-title">{config.title}</h2>
        {state.assignments.length === 0 ? (
          <p className="text-muted-foreground" data-testid="rpc-empty">還沒有人抽取角色</p>
        ) : (
          <div className="space-y-2">
            {state.assignments.map((a) => (
              <div key={a.assignId} className="p-3 border rounded flex items-center gap-3" data-testid={`rpc-assignment-${a.assignId}`}>
                <span className="text-2xl">🎭</span>
                <div>
                  <p className="font-semibold">{a.userName}</p>
                  <p className="text-muted-foreground text-sm">{a.role}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground" data-testid="rpc-count">共 {state.assignments.length} 人</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="rpc-title">{config.title}</h2>
      <p className="text-sm text-muted-foreground" data-testid="rpc-count">已抽卡：{state.assignments.length} 人</p>

      {myAssignment ? (
        <div className="p-6 border-2 border-primary rounded-xl text-center" data-testid="rpc-my-role">
          <p className="text-muted-foreground text-sm mb-1">你的角色</p>
          <p className="text-3xl">🎭</p>
          <p className="text-2xl font-bold mt-2">{myAssignment.role}</p>
        </div>
      ) : (
        <Button onClick={onDraw} size="lg" className="w-full" data-testid="rpc-draw-btn">
          抽取角色卡
        </Button>
      )}

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="rpc-reveal-btn">
        公布所有角色
      </Button>
    </div>
  );
}
