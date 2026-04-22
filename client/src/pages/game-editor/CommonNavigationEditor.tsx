// 通用導航/獎勵編輯器
// 為所有 pageType 提供統一的「下一頁」和「獎勵分數」設定
// 排除自身已有分支邏輯的 pageType（flow_router / button / vote / conditional_verify）
import { Input } from "@/components/ui/input";
import { ChevronRight, Award, Navigation } from "lucide-react";
import type { Page } from "@shared/schema";
import type { EditorProps } from "./page-config-shared";
import { PageSelect } from "@/components/shared/PageSelect";

interface CommonNavigationEditorProps extends EditorProps {
  allPages: Page[];
  pageType: string;
  currentPageId?: string;
}

/** 不需要通用 nextPageId 的頁面類型（有自己的分支機制） */
const EXCLUDED_PAGE_TYPES = new Set([
  "flow_router",       // 純邏輯節點，有 routes[]
  "button",            // 每個 button 有自己的 nextPageId
  "vote",              // 每個 option 有自己的 nextPageId
  "conditional_verify",// 有 successNextPageId + failureNextPageId
  "time_bomb",         // 有 successNextPageId + failureNextPageId
]);

/** 不需要 rewardPoints 的頁面類型（已有自己的獎勵編輯或無獎勵概念） */
const NO_REWARDS_PAGE_TYPES = new Set([
  "flow_router",
  "button",            // 每個 button 有自己的 rewardPoints
  "vote",              // 投票沒有固定獎勵
  "time_bomb",         // 已有 RewardsSection
  "lock",              // 已有 rewardPoints 輸入
  "motion_challenge",  // 已有 rewardPoints 輸入
  "photo_mission",     // 已有 RewardsSection
  "gps_mission",       // 已有 RewardsSection
  "shooting_mission",  // 已有 RewardsSection
  "qr_scan",           // 已有 RewardsSection
  "conditional_verify",// 已有 rewardPoints 輸入
]);

export default function CommonNavigationEditor({
  config,
  updateField,
  allPages,
  pageType,
  currentPageId,
}: CommonNavigationEditorProps) {
  const showNextPage = !EXCLUDED_PAGE_TYPES.has(pageType);
  const showRewards = !NO_REWARDS_PAGE_TYPES.has(pageType);

  if (!showNextPage && !showRewards) return null;

  // 過濾掉「自己」（避免設 nextPageId 指向當前頁造成無限迴圈）
  const selectablePages = allPages.filter((p) => p.id !== currentPageId);

  const currentNextPageId = (config.nextPageId as string) || "_next";

  return (
    <div className="pt-4 mt-4 border-t border-border space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Navigation className="w-4 h-4" />
        頁面流程與獎勵
      </h4>

      {showNextPage && (
        <div>
          <label className="text-sm font-medium mb-2 block flex items-center gap-1">
            <ChevronRight className="w-4 h-4" />
            完成後前往
          </label>
          <Select
            value={currentNextPageId}
            onValueChange={(value) => {
              // "_next" → 清除 nextPageId 走遊戲預設順序
              updateField("nextPageId", value === "_next" ? undefined : value);
            }}
          >
            <SelectTrigger data-testid="select-next-page">
              <SelectValue placeholder="選擇完成後前往的頁面" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_next">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <ChevronRight className="w-3 h-3" />
                  下一頁（依遊戲順序）
                </span>
              </SelectItem>
              <SelectItem value="_end">
                <span className="flex items-center gap-2 text-emerald-600">
                  <Flag className="w-3 h-3" />
                  結束遊戲
                </span>
              </SelectItem>
              {selectablePages.map((p, idx) => {
                const cfg = p.config as Record<string, unknown> | null | undefined;
                const title =
                  (cfg?.title as string) ||
                  (cfg?.question as string) ||
                  (cfg?.instruction as string) ||
                  `#${idx + 1} ${p.pageType}`;
                return (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="truncate">
                      #{p.pageOrder}. {title.slice(0, 40)}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            選擇完成本頁後要前往的目標頁面。預設按遊戲頁面順序進入下一頁。
          </p>
        </div>
      )}

      {showRewards && (
        <div>
          <label className="text-sm font-medium mb-2 block flex items-center gap-1">
            <Award className="w-4 h-4" />
            完成獎勵分數
          </label>
          <Input
            type="number"
            value={(config.rewardPoints as number | undefined) ?? 0}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              updateField("rewardPoints", Number.isFinite(n) ? n : 0);
            }}
            min={0}
            data-testid="input-reward-points"
          />
          <p className="text-xs text-muted-foreground mt-1">
            玩家完成本頁後獲得的分數。可填 0 表示無獎勵。
          </p>
        </div>
      )}
    </div>
  );
}
