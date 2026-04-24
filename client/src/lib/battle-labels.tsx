// 🎯 對戰中心共用標籤/顏色/Badge helpers
//
// 為什麼要抽出來？
//   原本 BattleHome、BattleSlotDetail、BattleRanking、BattleSeasonHistory 各自定義
//   slotStatusBadge / skillLevelLabel / tierColors / tierBg
//   →  改一處要修四處，命名/順序/顏色容易跑掉
//   抽到這支 lib：所有 Battle 頁面共用，未來新增狀態只改一個地方
//
// 設計：
//   - 純 lookup 表（const）+ 對應 helper 函式
//   - 沒有 React state，純展示用
//   - tier 共用 shared/schema/battle-results.ts 的 tierLabels
//
import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";

// ============================
// 1. 對戰時段狀態 (slot status)
// ============================
type SlotStatusVariant = "default" | "secondary" | "destructive" | "outline";

export const SLOT_STATUS_INFO: Record<
  string,
  { label: string; variant: SlotStatusVariant }
> = {
  open: { label: "開放報名", variant: "default" },
  confirmed: { label: "已成局", variant: "secondary" },
  full: { label: "已額滿", variant: "destructive" },
  in_progress: { label: "對戰中", variant: "outline" },
  completed: { label: "已結束", variant: "outline" },
  cancelled: { label: "已取消", variant: "destructive" },
};

/** 取得時段狀態的中文標籤（供文字顯示用）*/
export function slotStatusLabel(status: string | null | undefined): string {
  if (!status) return "未知";
  return SLOT_STATUS_INFO[status]?.label ?? status;
}

/** 時段狀態 Badge 元件（適合直接放在 list/card title 旁）*/
export function slotStatusBadge(status: string | null | undefined): JSX.Element {
  const lookup = status ? SLOT_STATUS_INFO[status] : undefined;
  const info = lookup ?? {
    label: status ?? "未知",
    variant: "outline" as SlotStatusVariant,
  };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

// ============================
// 2. 玩家技能等級 (skillLevel)
// ============================
export const SKILL_LEVEL_LABEL: Record<string, string> = {
  beginner: "初學者",
  intermediate: "中級",
  advanced: "高手",
  expert: "高手", // alias — server 可能回 expert 或 advanced
};

/** 技能等級中文化（避免使用者看到 beginner / intermediate / advanced 英文）*/
export function skillLevelLabel(level: string | null | undefined): string {
  if (!level) return "未填";
  return SKILL_LEVEL_LABEL[level] ?? level;
}

// ============================
// 3. 段位顏色 (tier)
// ============================
/** 段位「卡片」用：邊框 + 背景，適合包整個排名 entry */
export const TIER_BG: Record<string, string> = {
  master: "bg-yellow-500/10 border-yellow-500/30",
  diamond: "bg-cyan-500/10 border-cyan-500/30",
  platinum: "bg-indigo-500/10 border-indigo-500/30",
  gold: "bg-amber-500/10 border-amber-500/30",
  silver: "bg-gray-500/10 border-gray-500/30",
  bronze: "bg-orange-500/10 border-orange-500/30",
};

/** 段位 Badge 用：背景 + 文字色，適合做小 Badge */
export const TIER_BADGE: Record<string, string> = {
  bronze: "bg-orange-500/20 text-orange-400",
  silver: "bg-gray-500/20 text-gray-300",
  gold: "bg-yellow-500/20 text-yellow-400",
  platinum: "bg-cyan-500/20 text-cyan-400",
  diamond: "bg-blue-500/20 text-blue-400",
  master: "bg-purple-500/20 text-purple-400",
};

/** 安全地取得段位 className（找不到就回空字串，不會破壞 layout）*/
export function tierBgClass(tier: string | null | undefined): string {
  if (!tier) return "";
  return TIER_BG[tier] ?? "";
}
export function tierBadgeClass(tier: string | null | undefined): string {
  if (!tier) return "";
  return TIER_BADGE[tier] ?? "";
}
