// 🎭 RoleAssign — 角色分派元件（W4 D3，S 級）
//
// 玩法：
//   - admin 設定 N 個角色（名稱+任務+顏色）
//   - 玩家進入時透過穩定 hash 分配角色
//   - 玩家看到「你的角色」+ 任務指示
//   - 適用：劇本殺、企業團建、推理遊戲、角色扮演
//
// pageType: role_assign（multi 軸線）

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

export interface RoleDefinition {
  id: string;
  name: string;       // 角色名（偵探 / 嫌犯 / 證人）
  emoji?: string;     // 視覺 emoji
  description: string; // 任務說明
  color?: string;     // 角色卡背景色
  isSecret?: boolean;  // 是否秘密任務（隊友看不到內容）
}

export interface RoleAssignConfig {
  title?: string;
  subtitle?: string;
  roles?: RoleDefinition[];
  /** 是否允許玩家「重新抽」（預設 false）*/
  allowReroll?: boolean;
}

interface RoleAssignState {
  assignments: Record<string, string>; // userName → roleId
}

export interface RoleAssignProps {
  config: RoleAssignConfig;
  state: RoleAssignState | null;
  myUserName: string;
  onAssign: (userName: string, roleId: string) => void;
  onReroll?: () => void;
}

/** 穩定 hash 分配 */
function pickRoleForUser(roles: RoleDefinition[], userName: string, salt: number = 0): RoleDefinition | null {
  if (roles.length === 0) return null;
  let hash = salt;
  for (let i = 0; i < userName.length; i++) {
    hash = (hash * 31 + userName.charCodeAt(i)) | 0;
  }
  return roles[Math.abs(hash) % roles.length];
}

export default function RoleAssign({
  config,
  state,
  myUserName,
  onAssign,
  onReroll,
}: RoleAssignProps) {
  const roles = config.roles ?? [];
  const assignments = state?.assignments ?? {};
  const [revealed, setRevealed] = useState(false);

  const myRoleId = assignments[myUserName];
  const myRole = roles.find((r) => r.id === myRoleId);

  // 自動分配（首次進入）
  useMemo(() => {
    if (!myRoleId && roles.length > 0) {
      const picked = pickRoleForUser(roles, myUserName);
      if (picked) onAssign(myUserName, picked.id);
    }
  }, [myRoleId, roles, myUserName, onAssign]);

  if (!myRole || roles.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto p-4 text-center text-muted-foreground py-8">
        等待角色分配中...
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-display font-bold">{config.title ?? "🎭 角色分派"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
      </div>

      {/* 角色卡 */}
      <div
        className="rounded-2xl p-6 text-center space-y-4 shadow-lg border-2"
        style={{
          backgroundColor: myRole.color ? `${myRole.color}20` : undefined,
          borderColor: myRole.color ?? "var(--border)",
        }}
      >
        {myRole.isSecret && !revealed ? (
          // 秘密任務：點擊揭開
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="w-full space-y-3 text-center py-8"
            data-testid="btn-reveal-role"
          >
            <div className="text-7xl">🤫</div>
            <h3 className="text-xl font-bold">你的秘密任務</h3>
            <p className="text-sm text-muted-foreground">點擊揭開（只有你看得到）</p>
          </button>
        ) : (
          <>
            {myRole.emoji && <div className="text-7xl">{myRole.emoji}</div>}
            <h3 className="text-2xl font-display font-bold">{myRole.name}</h3>
            <div className="bg-background/40 rounded-lg p-4 text-left">
              <p className="text-sm whitespace-pre-line">{myRole.description}</p>
            </div>
            {myRole.isSecret && (
              <p className="text-xs text-muted-foreground italic">🤐 秘密任務 — 不要告訴別人</p>
            )}
          </>
        )}
      </div>

      {config.allowReroll && onReroll && (
        <button
          type="button"
          onClick={onReroll}
          className="w-full py-2 text-sm border rounded-lg hover:bg-muted"
          data-testid="btn-reroll"
        >
          🎲 重新抽角色
        </button>
      )}

      {/* 隊友角色預覽（不揭曉秘密任務）*/}
      {Object.keys(assignments).length > 1 && (
        <div className="space-y-1.5 mt-4">
          <p className="text-xs text-muted-foreground">隊友角色</p>
          {Object.entries(assignments).map(([name, rId]) => {
            if (name === myUserName) return null;
            const r = roles.find((rr) => rr.id === rId);
            if (!r) return null;
            return (
              <div
                key={name}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card border text-sm"
              >
                <span>{r.emoji ?? "👤"}</span>
                <span className="font-medium">{name}</span>
                <span className="text-muted-foreground">— {r.isSecret ? "（秘密角色）" : r.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
