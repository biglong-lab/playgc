// 遊戲管理共用常數

export const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已發布",
  archived: "已封存",
};

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-500",
  published: "bg-green-500/10 text-green-500",
  archived: "bg-gray-500/10 text-gray-500",
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "簡單",
  medium: "中等",
  hard: "困難",
};

// 將 null/undefined 狀態正規化為 "draft"
export function normalizeStatus(status: string | null | undefined): string {
  return status || "draft";
}
