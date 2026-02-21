// 流程路由器頁面 — Fallback 元件
// 正常遊戲中不會被渲染（GamePlay 的 resolveFlowRouter 會跳過），
// 但作為安全網，若玩家直接落在此頁面，自動評估路由並跳轉。
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { evaluateFlowRouter } from "@/lib/flow-router";
import type { FlowRouterConfig } from "@shared/schema";

interface FlowRouterPageProps {
  config: FlowRouterConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  variables: Record<string, unknown>;
  inventory: string[];
  score: number;
}

export default function FlowRouterPage({
  config,
  onComplete,
  variables,
  inventory,
  score,
}: FlowRouterPageProps) {
  useEffect(() => {
    const nextPageId = evaluateFlowRouter(config, variables, inventory, score);
    if (nextPageId) {
      onComplete(undefined, nextPageId);
    } else {
      // 無匹配 → 直接下一頁
      onComplete();
    }
    // 只在掛載時評估一次，避免重複觸發 onComplete 導致無限迴圈
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 極簡過場畫面（正常不會停留超過一幀）
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
