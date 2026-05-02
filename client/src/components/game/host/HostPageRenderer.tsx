// 📺 HostPageRenderer — host_* pageType 渲染器
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
//
// 設計理由：HostScreen / HostPlay 不走 GamePageRenderer（因為不需要 chapter / theme /
// commonProps 等多功能）。本檔是 host 軸線的 mini-renderer，依 pageType 路由到對應容器。

import { lazy, Suspense } from "react";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

const PollLivePage = lazy(() => import("./PollLivePage"));

interface HostPageRendererProps {
  page: Page;
}

function FallbackLoader() {
  return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export default function HostPageRenderer({ page }: HostPageRendererProps) {
  return (
    <Suspense fallback={<FallbackLoader />}>
      {(() => {
        switch (page.pageType) {
          case "host_poll_live":
            return <PollLivePage page={page} />;
          // Phase 1 W3-W4 會陸續加：
          //   host_emoji_react / host_wave_response / host_crowd_gather
          //   host_trivia_showdown / host_live_leaderboard
          //   host_scoreboard_announcement / host_knowledge_map
          default:
            return (
              <div className="text-center text-zinc-400 p-8">
                <p>未知的 host pageType：{page.pageType}</p>
                <p className="text-xs mt-2">請通知 admin 確認設定</p>
              </div>
            );
        }
      })()}
    </Suspense>
  );
}
