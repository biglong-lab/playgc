// 遊戲頁面渲染器 - 根據 pageType 渲染對應元件
// 使用 React.lazy 動態載入，避免 GamePlay chunk 過大
import { lazy, Suspense, useMemo } from "react";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/feedback/PageTransition";
import { PageLocationMiniMap, shouldShowMiniMap } from "@/components/game/PageLocationMiniMap";
import FeedbackButtons from "@/components/game/FeedbackButtons";
import { useLastShownVariant, clearShownVariant } from "@/lib/feedback-tracker";

// 通用元件（shared/components/）— 個人/多人都可用
const TextCardPage = lazy(() => import("@/components/game/shared/components/TextCardPage"));
const DialoguePage = lazy(() => import("@/components/game/shared/components/DialoguePage"));
const VideoPage = lazy(() => import("@/components/game/shared/components/VideoPage"));
const FlowRouterPage = lazy(() => import("@/components/game/shared/components/FlowRouterPage"));

// 多人專用元件（multi/）— 只能在 playerMode='multi' 的遊戲使用
const PhotoTeamFlow = lazy(() => import("@/components/game/multi/PhotoTeamFlow"));
const VoteTeamPage = lazy(() => import("@/components/game/multi/VoteTeamPage"));
const ShootingTeamPage = lazy(() => import("@/components/game/multi/ShootingTeamPage"));
const GpsTeamMissionPage = lazy(() => import("@/components/game/multi/GpsTeamMissionPage"));
const ChoiceVerifyRacePage = lazy(() => import("@/components/game/multi/ChoiceVerifyRacePage"));
const LockCoopPage = lazy(() => import("@/components/game/multi/LockCoopPage"));
const RelayMissionPage = lazy(() => import("@/components/game/multi/RelayMissionPage"));
const TerritoryCapturePage = lazy(() => import("@/components/game/multi/TerritoryCapturePage"));
const JigsawPuzzlePage = lazy(() => import("@/components/game/multi/JigsawPuzzlePage"));
const TreasureHuntPage = lazy(() => import("@/components/game/multi/TreasureHuntPage"));
const GpsCascadePage = lazy(() => import("@/components/game/multi/GpsCascadePage"));
const CollectiveScorePage = lazy(() => import("@/components/game/multi/CollectiveScorePage"));
const RoleAssignPage = lazy(() => import("@/components/game/multi/RoleAssignPage"));
const CheckInPage = lazy(() => import("@/components/game/multi/CheckInPage"));
const WishWallPage = lazy(() => import("@/components/game/multi/WishWallPage"));
const MultiVotePage = lazy(() => import("@/components/game/multi/MultiVotePage"));
const DotVotePage = lazy(() => import("@/components/game/multi/DotVotePage"));
const TwoTruthsPage = lazy(() => import("@/components/game/multi/TwoTruthsPage"));
const IdeaWallPage = lazy(() => import("@/components/game/multi/IdeaWallPage"));
const SpeedNetworkingPage = lazy(() => import("@/components/game/multi/SpeedNetworkingPage"));
const TeamHealthCheckPage = lazy(() => import("@/components/game/multi/TeamHealthCheckPage"));
const MadLibsPage = lazy(() => import("@/components/game/multi/MadLibsPage"));
const WouldYouRatherPage = lazy(() => import("@/components/game/multi/WouldYouRatherPage"));
const ScaledFeedbackPage = lazy(() => import("@/components/game/multi/ScaledFeedbackPage"));
const ThinkingHatsPage = lazy(() => import("@/components/game/multi/ThinkingHatsPage"));
const NeverHaveIEverPage = lazy(() => import("@/components/game/multi/NeverHaveIEverPage"));
const PlayerWordCloudPage = lazy(() => import("@/components/game/multi/WordCloudPage"));
const RankChoicePage = lazy(() => import("@/components/game/multi/RankChoicePage"));
const BrainDumpPage = lazy(() => import("@/components/game/multi/BrainDumpPage"));
const RoseBudThornPage = lazy(() => import("@/components/game/multi/RoseBudThornPage"));
const StoryWallPage = lazy(() => import("@/components/game/multi/StoryWallPage"));
const KptRetroPage = lazy(() => import("@/components/game/multi/KptRetroPage"));
const FourLsPage = lazy(() => import("@/components/game/multi/FourLsPage"));
const SafetyCheckPage = lazy(() => import("@/components/game/multi/SafetyCheckPage"));
const TeamPactPage = lazy(() => import("@/components/game/multi/TeamPactPage"));
const EnergyMapPage = lazy(() => import("@/components/game/multi/EnergyMapPage"));
const TeamRadarPage = lazy(() => import("@/components/game/multi/TeamRadarPage"));
const SpotVotePage = lazy(() => import("@/components/game/multi/SpotVotePage"));
const TeamDreamPage = lazy(() => import("@/components/game/multi/TeamDreamPage"));
const GroupNicknamePage = lazy(() => import("@/components/game/multi/GroupNicknamePage"));
const ActivityMemoPage = lazy(() => import("@/components/game/multi/ActivityMemoPage"));
const RoleBoardPage = lazy(() => import("@/components/game/multi/RoleBoardPage"));
const DiscoveryCardPage = lazy(() => import("@/components/game/multi/DiscoveryCardPage"));
const HighLowCardPage = lazy(() => import("@/components/game/multi/HighLowCardPage"));
const FlagDesignPage = lazy(() => import("@/components/game/multi/FlagDesignPage"));
const PeerPraisePage = lazy(() => import("@/components/game/multi/PeerPraisePage"));
const ScaleCheckPage = lazy(() => import("@/components/game/multi/ScaleCheckPage"));
const VenueRatingPage = lazy(() => import("@/components/game/multi/VenueRatingPage"));
const PartyMenuPage = lazy(() => import("@/components/game/multi/PartyMenuPage"));
const MicroCommitPage = lazy(() => import("@/components/game/multi/MicroCommitPage"));
const ClosingThoughtPage = lazy(() => import("@/components/game/multi/ClosingThoughtPage"));
const GiftToTeamPage = lazy(() => import("@/components/game/multi/GiftToTeamPage"));
const AbilityBadgePage = lazy(() => import("@/components/game/multi/AbilityBadgePage"));
const GratitudeTreePage = lazy(() => import("@/components/game/multi/GratitudeTreePage"));
const WeddingVowPage = lazy(() => import("@/components/game/multi/WeddingVowPage"));
const BirthdayCandlePage = lazy(() => import("@/components/game/multi/BirthdayCandlePage"));
const AwardCeremonyPage = lazy(() => import("@/components/game/multi/AwardCeremonyPage"));
const DinnerTablePage = lazy(() => import("@/components/game/multi/DinnerTablePage"));

// 📺 ADR-0004 HostScreen 軸線（W2 D2 註冊首發 PollLive）
const PollLivePage = lazy(() => import("@/components/game/host/PollLivePage"));
const EmojiReactPage = lazy(() => import("@/components/game/host/EmojiReactPage"));
const LotteryWheelPage = lazy(() => import("@/components/game/host/LotteryWheelPage"));
const ProgressQuestPage = lazy(() => import("@/components/game/host/ProgressQuestPage"));
const WordCloudPage = lazy(() => import("@/components/game/host/WordCloudPage"));
const QuestChainPage = lazy(() => import("@/components/game/multi/QuestChainPage"));
const MemoryMatchPage = lazy(() => import("@/components/game/solo/MemoryMatchPage"));
const WaveResponsePage = lazy(() => import("@/components/game/host/WaveResponsePage"));
const CrowdGatherPage = lazy(() => import("@/components/game/host/CrowdGatherPage"));
const LiveLeaderboardPage = lazy(() => import("@/components/game/host/LiveLeaderboardPage"));
const PolaroidCollagePage = lazy(() => import("@/components/game/host/PolaroidCollagePage"));
const GuestbookDigitalPage = lazy(() => import("@/components/game/host/GuestbookDigitalPage"));
const TriviaShowdownPage = lazy(() => import("@/components/game/host/TriviaShowdownPage"));
const ScoreboardAnnouncementPage = lazy(() => import("@/components/game/host/ScoreboardAnnouncementPage"));
const KnowledgeMapPage = lazy(() => import("@/components/game/host/KnowledgeMapPage"));
const TeamBattleScorePage = lazy(() => import("@/components/game/host/TeamBattleScorePage"));
const BingoBoardPage = lazy(() => import("@/components/game/host/BingoBoardPage"));
const BlessingWallPage = lazy(() => import("@/components/game/host/BlessingWallPage"));
const MicroQaPage = lazy(() => import("@/components/game/host/MicroQaPage"));

// 個人元件（暫留根目錄，Phase 1.6 第二批會搬到 solo/）
const ButtonPage = lazy(() => import("@/components/game/solo/ButtonPage"));
const TextVerifyPage = lazy(() => import("@/components/game/solo/TextVerifyPage"));
const ChoiceVerifyPage = lazy(() => import("@/components/game/solo/ChoiceVerifyPage"));
const ConditionalVerifyPage = lazy(() => import("@/components/game/solo/ConditionalVerifyPage"));
const ShootingMissionPage = lazy(() => import("@/components/game/solo/ShootingMissionPage"));
const PhotoMissionPage = lazy(() => import("@/components/game/solo/PhotoMissionPage"));
const PhotoSpotFlow = lazy(() => import("@/components/game/solo/PhotoSpotFlow"));
const PhotoCompareFlow = lazy(() => import("@/components/game/solo/PhotoCompareFlow"));
const PhotoBeforeAfterFlow = lazy(() => import("@/components/game/solo/PhotoBeforeAfterFlow"));
const PhotoBurstFlow = lazy(() => import("@/components/game/solo/PhotoBurstFlow"));
const PhotoArStickerFlow = lazy(() => import("@/components/game/solo/PhotoArStickerFlow"));
const PhotoOcrFlow = lazy(() => import("@/components/game/solo/PhotoOcrFlow"));
const GpsMissionPage = lazy(() => import("@/components/game/solo/GpsMissionPage"));
const QrScanPage = lazy(() => import("@/components/game/solo/QrScanPage"));
const TimeBombPage = lazy(() => import("@/components/game/solo/TimeBombPage"));
const LockPage = lazy(() => import("@/components/game/solo/LockPage"));
const MotionChallengePage = lazy(() => import("@/components/game/solo/MotionChallengePage"));
const FlashlightPage = lazy(() => import("@/components/game/solo/FlashlightPage"));
const VotePage = lazy(() => import("@/components/game/solo/VotePage"));

// 📦 模組層級常數（避免每次 render 重新建立 Set）
const SKIP_REWARD_WRAP_TYPES = new Set([
  "button",       // 按鈕級獎勵，不該共享頁面級 items
  "flow_router",  // 純路由
]);

const SKIP_MINI_MAP_TYPES = new Set([
  "gps_mission",      // 已有 GpsMissionMap
  "photo_spot",       // 已有 GPS 引導
  "flow_router",      // 純路由
  "qr_scan",          // QR 相機需要全螢幕
  "video",            // 影片播放器需要全寬
  "shooting_mission", // AR 預瞄全螢幕
  "photo_mission",    // 相機介面全螢幕
  "photo_compare",    // 左右對比 layout
  "photo_before_after", // before/after 動畫
  "photo_burst",      // 連拍進度條
  "photo_ar",         // AR 視角
  "photo_team",       // 團隊合照 layout
  "photo_ocr",        // 文字框掃描
  "motion_challenge", // 加速度計感應
]);

function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="relative">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <p className="text-sm animate-pulse">載入頁面中...</p>
      </div>
    </div>
  );
}

interface GamePageRendererProps {
  readonly page: Page;
  readonly onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string
  ) => void;
  readonly onVariableUpdate: (key: string, value: unknown) => void;
  readonly sessionId: string;
  readonly gameId: string;
  readonly variables: Record<string, unknown>;
  readonly inventory: string[];
  readonly score: number;
  readonly visitedLocations?: string[];
}

export default function GamePageRenderer({
  page,
  onComplete,
  onVariableUpdate,
  sessionId,
  gameId,
  variables,
  inventory,
  score,
  visitedLocations = [],
}: GamePageRendererProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 動態分發器，config 從 DB JSON 傳給各元件
  const config = page.config as any;

  // 🎁 統一補完 rewardItems / rewardPoints — 修「道具獎勵發不出來」bug
  //
  // 背景：原本各頁面元件自己處理 rewardItems，導致 8+ 個頁面類型遺漏
  // （TextCard / Dialogue / Video / Vote / TimeBomb / Lock / MotionChallenge）
  // 玩家完成這些頁面後 inventory 不會增加。
  //
  // 解法：在 GamePageRenderer 統一包裝 onComplete，自動從 page.config 補上
  // rewardItems[] 和 rewardPoints。
  // 已經自己處理的元件（GpsMission / TextVerify 等）也安全 — 用 Set 去重。
  //
  // 失敗保護：
  //   reward = undefined / null → 不補（元件明確表示沒獎勵）
  //   reward.points === 0 且 reward.items 也空 → 視為「失敗 fallthrough」，不補
  //   其他情況（成功）→ 補 items
  //
  // 例外：button 頁面有「按鈕級獎勵」（button.rewardPoints/items），
  // 不應該被頁面級 config.rewardItems 干擾 → 跳過 wrapper
  // ⚡ 用模組層級 SKIP_REWARD_WRAP_TYPES（不在 render 內建 Set）
  const shouldSkipRewardWrap = SKIP_REWARD_WRAP_TYPES.has(page.pageType);

  const wrappedOnComplete = useMemo(() => {
    if (shouldSkipRewardWrap) {
      return onComplete; // ButtonPage / FlowRouter 直接用原 onComplete
    }
    return ((reward, nextPageId) => {
      // 1. reward 為 undefined → 元件明確表示沒獎勵，不補
      if (!reward) {
        onComplete(reward, nextPageId);
        return;
      }

      // 2. 判斷是否為「失敗 fallthrough」（points=0 且沒 items）
      const elementSuppliedItems = reward.items && reward.items.length > 0;
      const elementSuppliedPoints = typeof reward.points === "number" && reward.points > 0;
      const isFailureFallthrough = !elementSuppliedItems && !elementSuppliedPoints;

      if (isFailureFallthrough) {
        onComplete(reward, nextPageId);
        return;
      }

      // 3. 算成功 → 補 rewardItems（從 config）
      const finalReward: { points?: number; items?: string[] } = { ...reward };

      const cfgItems = (config?.rewardItems as string[] | undefined) ?? [];
      const grantItem = config?.onSuccess?.grantItem as string | undefined;

      if (cfgItems.length > 0 || grantItem) {
        const merged = new Set<string>(finalReward.items ?? []);
        cfgItems
          .filter((id) => typeof id === "string" && id.length > 0)
          .forEach((id) => merged.add(id));
        if (grantItem && typeof grantItem === "string") {
          merged.add(grantItem);
        }
        if (merged.size > 0) {
          finalReward.items = Array.from(merged);
        }
      }

      // 4. 補 rewardPoints（若元件沒帶 points 但 config 有設）
      const cfgPoints = config?.rewardPoints as number | undefined;
      if (typeof cfgPoints === "number" && cfgPoints > 0 && !elementSuppliedPoints) {
        finalReward.points = cfgPoints;
      }

      onComplete(finalReward, nextPageId);
    }) as typeof onComplete;
  }, [config, onComplete, shouldSkipRewardWrap]);

  // 記憶化 commonProps 避免每次渲染都建立新物件
  // 🎨 P2 變體池：把 page.variantPool 統一傳下去，玩家端用 pickVariant 抽訊息
  const commonProps = useMemo(() => ({
    config,
    onComplete: wrappedOnComplete, // 🎁 統一處理 rewardItems
    onVariableUpdate,
    sessionId,
    gameId,
    variables,
    variantPool: (page as { variantPool?: unknown }).variantPool ?? null,
  }), [config, wrappedOnComplete, onVariableUpdate, sessionId, gameId, variables, page]);

  const renderPage = () => {
    switch (page.pageType) {
      case "text_card":
        return <TextCardPage {...commonProps} />;
      case "dialogue":
        return <DialoguePage {...commonProps} />;
      case "video":
        return <VideoPage {...commonProps} />;
      case "button":
        return <ButtonPage {...commonProps} />;
      case "text_verify":
        return <TextVerifyPage {...commonProps} />;
      case "choice_verify":
        return <ChoiceVerifyPage {...commonProps} />;
      case "conditional_verify":
        return (
          <ConditionalVerifyPage
            {...commonProps}
            inventory={inventory}
            score={score}
            visitedLocations={visitedLocations}
          />
        );
      case "shooting_mission":
        return <ShootingMissionPage {...commonProps} />;
      case "photo_mission":
        return <PhotoMissionPage {...commonProps} />;
      // 🆕 v2 獨立拍照類元件
      case "photo_spot":
        return <PhotoSpotFlow {...commonProps} />;
      case "photo_compare":
        return <PhotoCompareFlow {...commonProps} />;
      case "photo_before_after":
        return <PhotoBeforeAfterFlow {...commonProps} />;
      case "photo_burst":
        return <PhotoBurstFlow {...commonProps} />;
      case "photo_ar":
        return <PhotoArStickerFlow {...commonProps} />;
      case "photo_team":
        return <PhotoTeamFlow {...commonProps} pageId={page.id} />;
      case "vote_team":
        return <VoteTeamPage {...commonProps} pageId={page.id} />;
      case "shooting_team":
        return <ShootingTeamPage {...commonProps} pageId={page.id} />;
      case "gps_team_mission":
        return <GpsTeamMissionPage {...commonProps} pageId={page.id} />;
      case "choice_verify_race":
        return <ChoiceVerifyRacePage {...commonProps} pageId={page.id} />;
      case "lock_coop":
        return <LockCoopPage {...commonProps} pageId={page.id} />;
      case "relay_mission":
        return <RelayMissionPage {...commonProps} pageId={page.id} />;
      case "territory_capture":
        return <TerritoryCapturePage {...commonProps} pageId={page.id} />;
      case "jigsaw_puzzle":
        return <JigsawPuzzlePage {...commonProps} page={page} pageId={page.id} />;
      case "treasure_hunt":
        return <TreasureHuntPage {...commonProps} page={page} pageId={page.id} />;
      case "gps_cascade":
        return <GpsCascadePage {...commonProps} page={page} pageId={page.id} />;
      case "collective_score":
        return <CollectiveScorePage {...commonProps} page={page} pageId={page.id} />;
      case "role_assign":
        return <RoleAssignPage {...commonProps} page={page} pageId={page.id} />;
      // 📺 HostScreen 軸線（ADR-0004）
      case "host_poll_live":
        return <PollLivePage page={page} />;
      case "host_emoji_react":
        return <EmojiReactPage page={page} />;
      case "host_lottery_wheel":
        return <LotteryWheelPage page={page} />;
      case "host_progress_quest":
        return <ProgressQuestPage page={page} />;
      case "host_word_cloud":
        return <WordCloudPage page={page} />;
      case "quest_chain":
        return <QuestChainPage {...commonProps} page={page} pageId={page.id} />;
      case "check_in":
        return <CheckInPage {...commonProps} page={page} pageId={page.id} />;
      case "wish_wall":
        return <WishWallPage {...commonProps} page={page} pageId={page.id} />;
      case "multi_vote":
        return <MultiVotePage {...commonProps} page={page} pageId={page.id} />;
      case "dot_vote":
        return <DotVotePage {...commonProps} page={page} pageId={page.id} />;
      case "two_truths":
        return <TwoTruthsPage {...commonProps} page={page} pageId={page.id} />;
      case "idea_wall":
        return <IdeaWallPage {...commonProps} page={page} pageId={page.id} />;
      case "speed_networking":
        return <SpeedNetworkingPage {...commonProps} page={page} pageId={page.id} />;
      case "team_health_check":
        return <TeamHealthCheckPage {...commonProps} page={page} pageId={page.id} />;
      case "mad_libs":
        return <MadLibsPage {...commonProps} page={page} pageId={page.id} />;
      case "would_you_rather":
        return <WouldYouRatherPage {...commonProps} page={page} pageId={page.id} />;
      case "scaled_feedback":
        return <ScaledFeedbackPage {...commonProps} page={page} pageId={page.id} />;
      case "thinking_hats":
        return <ThinkingHatsPage {...commonProps} page={page} pageId={page.id} />;
      case "never_have_i_ever":
        return <NeverHaveIEverPage {...commonProps} page={page} pageId={page.id} />;
      case "word_cloud":
        return <PlayerWordCloudPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "rank_choice":
        return <RankChoicePage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "brain_dump":
        return <BrainDumpPage {...commonProps} page={page} pageId={page.id} />;
      case "rose_bud_thorn":
        return <RoseBudThornPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "story_wall":
        return <StoryWallPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "kpt_retro":
        return <KptRetroPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "four_ls":
        return <FourLsPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "safety_check":
        return <SafetyCheckPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "team_pact":
        return <TeamPactPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "energy_map":
        return <EnergyMapPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "team_radar":
        return <TeamRadarPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "spot_vote":
        return <SpotVotePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "team_dream":
        return <TeamDreamPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "group_nickname":
        return <GroupNicknamePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "activity_memo":
        return <ActivityMemoPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "role_board":
        return <RoleBoardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "discovery_card":
        return <DiscoveryCardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "high_low_card":
        return <HighLowCardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "flag_design":
        return <FlagDesignPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "peer_praise":
        return <PeerPraisePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "scale_check":
        return <ScaleCheckPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "venue_rating":
        return <VenueRatingPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "party_menu":
        return <PartyMenuPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "micro_commit":
        return <MicroCommitPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "closing_thought":
        return <ClosingThoughtPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "gift_to_team":
        return <GiftToTeamPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "ability_badge":
        return <AbilityBadgePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "gratitude_tree":
        return <GratitudeTreePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "wedding_vow":
        return <WeddingVowPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "birthday_candle":
        return <BirthdayCandlePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "award_ceremony":
        return <AwardCeremonyPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "dinner_table":
        return <DinnerTablePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "memory_match":
        return <MemoryMatchPage {...commonProps} />;
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
        return <KnowledgeMapPage page={page} />;
      case "host_team_battle_score":
        return <TeamBattleScorePage page={page} />;
      case "host_bingo_board":
        return <BingoBoardPage page={page} />;
      case "host_blessing_wall":
        return <BlessingWallPage page={page} />;
      case "host_micro_qa":
        return <MicroQaPage page={page} />;
      case "photo_ocr":
        return <PhotoOcrFlow {...commonProps} />;
      case "gps_mission":
        return <GpsMissionPage {...commonProps} />;
      case "qr_scan":
        return <QrScanPage {...commonProps} />;
      case "time_bomb":
        return <TimeBombPage {...commonProps} />;
      case "lock":
        return <LockPage {...commonProps} />;
      case "motion_challenge":
        return <MotionChallengePage {...commonProps} />;
      case "flashlight":
        return <FlashlightPage {...commonProps} />;
      case "vote":
        return <VotePage {...commonProps} />;
      case "flow_router":
        return (
          <FlowRouterPage
            {...commonProps}
            inventory={inventory}
            score={score}
          />
        );
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              未知頁面類型: {page.pageType}
            </p>
          </div>
        );
    }
  };

  // 🔑 key={page.id} 強制每次換頁都 unmount + remount
  // 避免連續同型 page（如兩題 choice_verify）時 React reconciler
  // 復用 component 實例，導致前一題的 selectedOption / answer 殘留
  // 🎬 用 AnimatePresence + PageTransition 包裹，消除切頁白閃
  // - flow_router 用 flow variant（極短淡入，不干擾玩家）
  // - 其他頁面用 default variant（0.28s fade + 位移）
  const variant = page.pageType === "flow_router" ? "flow" : "default";

  // 🗺️ 自動偵測 locationSettings → 顯示頁面定位迷你地圖
  const showMiniMap = shouldShowMiniMap(config) && !SKIP_MINI_MAP_TYPES.has(page.pageType);

  // 📊 P11-8: 訂閱最近顯示的變體（給 FeedbackButtons 用）
  const lastShownVariant = useLastShownVariant();
  // 換頁時清除 tracker（避免上一頁變體按鈕殘留）
  useMemo(() => {
    clearShownVariant();
    return null;
  }, [page.id]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={page.id} variant={variant} className="h-full">
        <Suspense fallback={<PageLoadingFallback />}>
          {showMiniMap && (
            <div className="px-4 pt-2 pb-1 bg-card/30 max-h-[35vh] overflow-hidden">
              <PageLocationMiniMap settings={config.locationSettings} />
            </div>
          )}
          {renderPage()}
          {/* 📊 P11-8: 變體訊息反饋按鈕（玩家觸發 toast 後 60s 內可見） */}
          {lastShownVariant && lastShownVariant.pageId === page.id && (
            <div className="fixed bottom-4 right-4 bg-background/95 backdrop-blur border rounded-lg shadow-lg p-2 z-50">
              <FeedbackButtons
                pageId={lastShownVariant.pageId}
                variantKey={lastShownVariant.variantKey}
                variantIndex={lastShownVariant.variantIndex}
                variantText={lastShownVariant.variantText}
                gameId={gameId}
                sessionId={sessionId}
                variant="floating"
              />
            </div>
          )}
        </Suspense>
      </PageTransition>
    </AnimatePresence>
  );
}
