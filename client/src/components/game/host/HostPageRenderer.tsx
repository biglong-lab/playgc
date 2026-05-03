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
const EmojiReactPage = lazy(() => import("./EmojiReactPage"));
const WaveResponsePage = lazy(() => import("./WaveResponsePage"));
const CrowdGatherPage = lazy(() => import("./CrowdGatherPage"));
const LiveLeaderboardPage = lazy(() => import("./LiveLeaderboardPage"));
const PolaroidCollagePage = lazy(() => import("./PolaroidCollagePage"));
const GuestbookDigitalPage = lazy(() => import("./GuestbookDigitalPage"));
const TriviaShowdownPage = lazy(() => import("./TriviaShowdownPage"));
const ScoreboardAnnouncementPage = lazy(() => import("./ScoreboardAnnouncementPage"));
const KnowledgeMapPage = lazy(() => import("./KnowledgeMapPage"));
const LotteryWheelPage = lazy(() => import("./LotteryWheelPage")); // W18 D1
const ProgressQuestPage = lazy(() => import("./ProgressQuestPage")); // W18 D2
const WordCloudPage = lazy(() => import("./WordCloudPage")); // W18 D3
const TeamBattleScorePage = lazy(() => import("./TeamBattleScorePage")); // W19 紅藍對抗
const BingoBoardPage = lazy(() => import("./BingoBoardPage")); // W22 5×5 賓果板（5 大市場通用）
const BlessingWallPage = lazy(() => import("./BlessingWallPage")); // W22 祝福瀑布牆（交誼類主視覺）

interface HostPageRendererProps {
  page: Page;
  /** W14 D2: LINE 玩家名字（從 LIFF 中繼頁帶過來）*/
  myUserName?: string;
}

function FallbackLoader() {
  return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export default function HostPageRenderer({ page, myUserName }: HostPageRendererProps) {
  return (
    <Suspense fallback={<FallbackLoader />}>
      {(() => {
        switch (page.pageType) {
          case "host_poll_live":
            return <PollLivePage page={page} />;
          case "host_emoji_react":
            return <EmojiReactPage page={page} />;
          case "host_wave_response":
            return <WaveResponsePage page={page} />;
          case "host_crowd_gather":
            return <CrowdGatherPage page={page} />;
          case "host_live_leaderboard":
            return <LiveLeaderboardPage page={page} />;
          case "host_polaroid_collage":
            return <PolaroidCollagePage page={page} />;
          case "host_guestbook_digital":
            return <GuestbookDigitalPage page={page} />;
          case "host_trivia_showdown":
            return <TriviaShowdownPage page={page} />;
          case "host_scoreboard_announcement":
            return <ScoreboardAnnouncementPage page={page} />;
          case "host_knowledge_map":
            return <KnowledgeMapPage page={page} myUserName={myUserName} />;
          case "host_lottery_wheel":
            return <LotteryWheelPage page={page} />;
          case "host_progress_quest":
            return <ProgressQuestPage page={page} />;
          case "host_word_cloud":
            return <WordCloudPage page={page} />;
          case "host_team_battle_score":
            return <TeamBattleScorePage page={page} />;
          case "host_bingo_board":
            return <BingoBoardPage page={page} />;
          case "host_blessing_wall":
            return <BlessingWallPage page={page} />;
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
