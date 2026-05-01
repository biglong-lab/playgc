// 👥 TeammatePanel — 多人遊戲隊友狀態列表（共用 UI）
//
// 用途：給 multi/ 元件（VoteTeam、ShootingTeam、GpsTeamMission 等）顯示隊友
// 當前狀態，讓玩家知道誰已完成、誰在進行中、誰斷線。
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §7.2
//
// 規範：
//   - 只負責 UI 呈現，不管資料來源（由父層元件透過 props 傳入）
//   - 兩種版型：compact（手機底部抽屜）/ full（桌機側欄）
//   - 自己（myUserId）會用主題色高亮
//   - 斷線狀態用紅點 + 灰色文字標記

import { Check, Loader2, Pause, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** 隊友當前狀態（依多人遊戲生命週期） */
export type TeammateMemberStatus =
  | "idle"          // 在線但未開始（等待中）
  | "in_progress"   // 進行中（已開始作答 / 操作）
  | "completed"     // 已完成本元件
  | "disconnected"; // 斷線（5 秒未收到心跳）

export interface TeammateStatus {
  /** 玩家 ID（user.id 或 sessionPlayer.id） */
  userId: string;
  /** 顯示名（nickname / displayName） */
  displayName: string;
  /** 頭像 URL（選填，無則顯示首字字符） */
  avatarUrl?: string | null;
  /** 當前狀態 */
  status: TeammateMemberStatus;
  /** 即時分數（選填，僅特定多人元件需要） */
  score?: number;
  /** 是否為隊長（顯示皇冠標記） */
  isLeader?: boolean;
}

export interface TeammatePanelProps {
  /** 隊友列表（含自己） */
  members: TeammateStatus[];
  /** 自己的 userId（用主題色高亮） */
  myUserId?: string;
  /** 版型：compact 橫排小卡片 / full 垂直列表 */
  variant?: "compact" | "full";
  /** 是否顯示分數欄位 */
  showScore?: boolean;
  /** 額外 class */
  className?: string;
}

/** 狀態 → icon */
function StatusIcon({ status }: { status: TeammateMemberStatus }) {
  switch (status) {
    case "idle":
      return <Pause className="w-3.5 h-3.5 text-muted-foreground" data-testid="status-idle" />;
    case "in_progress":
      return (
        <Loader2
          className="w-3.5 h-3.5 text-primary animate-spin"
          data-testid="status-in-progress"
        />
      );
    case "completed":
      return <Check className="w-3.5 h-3.5 text-success" data-testid="status-completed" />;
    case "disconnected":
      return <WifiOff className="w-3.5 h-3.5 text-destructive" data-testid="status-disconnected" />;
  }
}

/** 狀態 → 中文文字 */
function statusLabel(status: TeammateMemberStatus): string {
  switch (status) {
    case "idle":
      return "等待中";
    case "in_progress":
      return "進行中";
    case "completed":
      return "已完成";
    case "disconnected":
      return "斷線";
  }
}

/** 取頭像首字（無 avatarUrl 時） */
function getInitial(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase() || "?";
}

/**
 * TeammatePanel — 隊友狀態列表
 *
 * @example 桌機側欄（full 版型，含分數）
 *   <TeammatePanel members={members} myUserId={user.id} showScore />
 *
 * @example 手機底部抽屜（compact 版型）
 *   <TeammatePanel members={members} myUserId={user.id} variant="compact" />
 */
export default function TeammatePanel({
  members,
  myUserId,
  variant = "full",
  showScore = false,
  className,
}: TeammatePanelProps) {
  if (members.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-muted-foreground py-3",
          className,
        )}
        data-testid="teammate-panel-empty"
      >
        尚無隊友資料
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn("flex flex-wrap gap-2", className)}
        data-testid="teammate-panel-compact"
      >
        {members.map((member) => {
          const isMe = member.userId === myUserId;
          const isDisconnected = member.status === "disconnected";
          return (
            <div
              key={member.userId}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs",
                "border bg-card",
                isMe && "border-primary bg-primary/10",
                isDisconnected && "opacity-60",
              )}
              data-testid={`teammate-${member.userId}`}
            >
              {/* 頭像（首字 fallback） */}
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center",
                  "bg-muted text-[10px] font-medium",
                )}
              >
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getInitial(member.displayName)
                )}
              </div>
              <span className={cn("font-medium", isDisconnected && "text-muted-foreground")}>
                {member.displayName}
                {member.isLeader && <span className="ml-0.5">👑</span>}
              </span>
              <StatusIcon status={member.status} />
              {showScore && typeof member.score === "number" && (
                <span className="font-number tabular-nums text-muted-foreground">
                  {member.score}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // full variant
  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      data-testid="teammate-panel-full"
    >
      {members.map((member) => {
        const isMe = member.userId === myUserId;
        const isDisconnected = member.status === "disconnected";
        return (
          <div
            key={member.userId}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg",
              "border bg-card transition-colors",
              isMe && "border-primary bg-primary/10",
              isDisconnected && "opacity-60",
            )}
            data-testid={`teammate-${member.userId}`}
          >
            {/* 頭像 */}
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                "bg-muted text-sm font-medium",
              )}
            >
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt={member.displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                getInitial(member.displayName)
              )}
            </div>

            {/* 名字 + 狀態文字 */}
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "text-sm font-medium truncate",
                  isDisconnected && "text-muted-foreground",
                )}
              >
                {member.displayName}
                {member.isLeader && <span className="ml-1">👑</span>}
                {isMe && (
                  <span className="ml-1 text-xs text-primary">（你）</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <StatusIcon status={member.status} />
                <span>{statusLabel(member.status)}</span>
              </div>
            </div>

            {/* 分數（選填） */}
            {showScore && typeof member.score === "number" && (
              <div className="text-right shrink-0">
                <div className="text-base font-number font-bold tabular-nums">
                  {member.score}
                </div>
                <div className="text-[10px] text-muted-foreground">分</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
