// 接力模式進度條 — 顯示各段落完成狀態
import { memo } from "react";

interface RelayParticipant {
  readonly relaySegment?: number | null;
  readonly relayStatus?: string | null;
}

interface RelayProgressProps {
  readonly participants: readonly RelayParticipant[];
  readonly segmentCount: number;
}

/** 計算各段落狀態 */
function getSegmentStates(
  participants: readonly RelayParticipant[],
  segmentCount: number,
): readonly ("completed" | "active" | "pending")[] {
  const states: ("completed" | "active" | "pending")[] = [];

  for (let i = 1; i <= segmentCount; i++) {
    const participant = participants.find((p) => p.relaySegment === i);
    if (participant?.relayStatus === "completed") {
      states.push("completed");
    } else if (participant?.relayStatus === "active") {
      states.push("active");
    } else {
      states.push("pending");
    }
  }

  return states;
}

/** 段落色彩對應 */
function getSegmentClasses(status: "completed" | "active" | "pending"): string {
  switch (status) {
    case "completed":
      return "bg-green-500";
    case "active":
      return "bg-blue-500 animate-pulse";
    case "pending":
      return "bg-muted";
  }
}

/** 進度文字 */
function getProgressText(segments: readonly ("completed" | "active" | "pending")[]): string {
  const completedCount = segments.filter((s) => s === "completed").length;
  const total = segments.length;

  if (completedCount === total) {
    return "接力完成！";
  }

  const activeIndex = segments.findIndex((s) => s === "active");
  if (activeIndex >= 0) {
    return `第 ${activeIndex + 1}/${total} 段進行中`;
  }

  return `${completedCount}/${total} 段已完成`;
}

export default memo(function RelayProgress({ participants, segmentCount }: RelayProgressProps) {
  if (segmentCount <= 0) return null;

  const segments = getSegmentStates(participants, segmentCount);
  const progressText = getProgressText(segments);

  return (
    <div className="mb-4" data-testid="relay-progress">
      <div className="flex gap-1.5 mb-2">
        {segments.map((status, index) => (
          <div
            key={index}
            className={`h-3 flex-1 rounded-full transition-colors ${getSegmentClasses(status)}`}
            data-testid={`segment-${index}`}
            data-status={status}
          />
        ))}
      </div>
      <p className="text-sm text-center text-muted-foreground">{progressText}</p>
    </div>
  );
});
