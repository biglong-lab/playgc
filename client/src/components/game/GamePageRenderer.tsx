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
const SharedBoardPage = lazy(() => import("@/components/game/multi/SharedBoardPage"));
const BingoPage = lazy(() => import("@/components/game/multi/BingoPage"));
const MoodMeterPage = lazy(() => import("@/components/game/multi/MoodMeterPage"));
const TeamChecklistPage = lazy(() => import("@/components/game/multi/TeamChecklistPage"));
const FeedbackStarPage = lazy(() => import("@/components/game/multi/FeedbackStarPage"));
const TeamWordCloudPage = lazy(() => import("@/components/game/multi/TeamWordCloudPage"));
const CheckInPage = lazy(() => import("@/components/game/multi/CheckInPage"));
const GroupTimerPage = lazy(() => import("@/components/game/multi/GroupTimerPage"));
const QuickQuestionPage = lazy(() => import("@/components/game/multi/QuickQuestionPage"));
const WishWallPage = lazy(() => import("@/components/game/multi/WishWallPage"));
const StampCardPage = lazy(() => import("@/components/game/multi/StampCardPage"));
const MultiVotePage = lazy(() => import("@/components/game/multi/MultiVotePage"));
const PhotoWallPage = lazy(() => import("@/components/game/multi/PhotoWallPage"));
const CountdownRevealPage = lazy(() => import("@/components/game/multi/CountdownRevealPage"));
const SeatDrawPage = lazy(() => import("@/components/game/multi/SeatDrawPage"));
const NameCardPage = lazy(() => import("@/components/game/multi/NameCardPage"));
const RatingWallPage = lazy(() => import("@/components/game/multi/RatingWallPage"));
const PopQuizPage = lazy(() => import("@/components/game/multi/PopQuizPage"));
const LuckyDrawPage = lazy(() => import("@/components/game/multi/LuckyDrawPage"));
const QuestionBoxPage = lazy(() => import("@/components/game/multi/QuestionBoxPage"));
const StoryChainPage = lazy(() => import("@/components/game/multi/StoryChainPage"));
const RandomTeamPage = lazy(() => import("@/components/game/multi/RandomTeamPage"));
const DotVotePage = lazy(() => import("@/components/game/multi/DotVotePage"));
const TimelineWallPage = lazy(() => import("@/components/game/multi/TimelineWallPage"));
const TwoTruthsPage = lazy(() => import("@/components/game/multi/TwoTruthsPage"));
const RetroBoardPage = lazy(() => import("@/components/game/multi/RetroBoardPage"));
const PledgeWallPage = lazy(() => import("@/components/game/multi/PledgeWallPage"));
const LivePulsePage = lazy(() => import("@/components/game/multi/LivePulsePage"));
const DebateVotePage = lazy(() => import("@/components/game/multi/DebateVotePage"));
const PeerRecognitionPage = lazy(() => import("@/components/game/multi/PeerRecognitionPage"));
const ConsensusScalePage = lazy(() => import("@/components/game/multi/ConsensusScalePage"));
const IdeaWallPage = lazy(() => import("@/components/game/multi/IdeaWallPage"));
const SpeedNetworkingPage = lazy(() => import("@/components/game/multi/SpeedNetworkingPage"));
const PhotoContestPage = lazy(() => import("@/components/game/multi/PhotoContestPage"));
const EmojiBattlePage = lazy(() => import("@/components/game/multi/EmojiBattlePage"));
const ChallengeBoardPage = lazy(() => import("@/components/game/multi/ChallengeBoardPage"));
const BucketListPage = lazy(() => import("@/components/game/multi/BucketListPage"));
const GratitudeWallPage = lazy(() => import("@/components/game/multi/GratitudeWallPage"));
const TeamContractPage = lazy(() => import("@/components/game/multi/TeamContractPage"));
const PriorityRankPage = lazy(() => import("@/components/game/multi/PriorityRankPage"));
const HotSeatPage = lazy(() => import("@/components/game/multi/HotSeatPage"));
const TeamHealthCheckPage = lazy(() => import("@/components/game/multi/TeamHealthCheckPage"));
const ProjectShowcasePage = lazy(() => import("@/components/game/multi/ProjectShowcasePage"));
const CategorySortPage = lazy(() => import("@/components/game/multi/CategorySortPage"));
const EstimationGamePage = lazy(() => import("@/components/game/multi/EstimationGamePage"));
const AgreementMatrixPage = lazy(() => import("@/components/game/multi/AgreementMatrixPage"));
const MadLibsPage = lazy(() => import("@/components/game/multi/MadLibsPage"));
const SpectrumLinePage = lazy(() => import("@/components/game/multi/SpectrumLinePage"));
const PhotoCaptionPage = lazy(() => import("@/components/game/multi/PhotoCaptionPage"));
const WouldYouRatherPage = lazy(() => import("@/components/game/multi/WouldYouRatherPage"));
const ScaledFeedbackPage = lazy(() => import("@/components/game/multi/ScaledFeedbackPage"));
const TeamPollPage = lazy(() => import("@/components/game/multi/TeamPollPage"));
const OpenQuestionPage = lazy(() => import("@/components/game/multi/OpenQuestionPage"));
const CountdownChallengePage = lazy(() => import("@/components/game/multi/CountdownChallengePage"));
const HotTakePage = lazy(() => import("@/components/game/multi/HotTakePage"));
const KnowledgeCheckPage = lazy(() => import("@/components/game/multi/KnowledgeCheckPage"));
const MostLikelyPage = lazy(() => import("@/components/game/multi/MostLikelyPage"));
const PresenceMapPage = lazy(() => import("@/components/game/multi/PresenceMapPage"));
const LetterToSelfPage = lazy(() => import("@/components/game/multi/LetterToSelfPage"));
const GroupCheerPage = lazy(() => import("@/components/game/multi/GroupCheerPage"));
const SilentBrainstormPage = lazy(() => import("@/components/game/multi/SilentBrainstormPage"));
const CardDrawPage = lazy(() => import("@/components/game/multi/CardDrawPage"));
const GroupPromisePage = lazy(() => import("@/components/game/multi/GroupPromisePage"));
const SentenceCompletionPage = lazy(() => import("@/components/game/multi/SentenceCompletionPage"));
const ActionPledgePage = lazy(() => import("@/components/game/multi/ActionPledgePage"));
const ThinkingHatsPage = lazy(() => import("@/components/game/multi/ThinkingHatsPage"));
const TruthOrMythPage = lazy(() => import("@/components/game/multi/TruthOrMythPage"));
const EmojiCheckInPage = lazy(() => import("@/components/game/multi/EmojiCheckInPage"));
const WordAssociationPage = lazy(() => import("@/components/game/multi/WordAssociationPage"));
const FeedbackSandwichPage = lazy(() => import("@/components/game/multi/FeedbackSandwichPage"));
const ValueRankPage = lazy(() => import("@/components/game/multi/ValueRankPage"));
const CollectivePoemPage = lazy(() => import("@/components/game/multi/CollectivePoemPage"));
const BottleLetterPage = lazy(() => import("@/components/game/multi/BottleLetterPage"));
const TimeCapturePage = lazy(() => import("@/components/game/multi/TimeCapturePage"));
const GlowGrowPage = lazy(() => import("@/components/game/multi/GlowGrowPage"));
const WordLadderPage = lazy(() => import("@/components/game/multi/WordLadderPage"));
const HopeFearPage = lazy(() => import("@/components/game/multi/HopeFearPage"));
const NumberGuessPage = lazy(() => import("@/components/game/multi/NumberGuessPage"));
const NeverHaveIEverPage = lazy(() => import("@/components/game/multi/NeverHaveIEverPage"));
const ReactionWallPage = lazy(() => import("@/components/game/multi/ReactionWallPage"));
const DesertIslandPage = lazy(() => import("@/components/game/multi/DesertIslandPage"));
const CategoryChallengePage = lazy(() => import("@/components/game/multi/CategoryChallengePage"));
const WordBidPage = lazy(() => import("@/components/game/multi/WordBidPage"));
const MemoryLanePage = lazy(() => import("@/components/game/multi/MemoryLanePage"));
const EmojiStoryPage = lazy(() => import("@/components/game/multi/EmojiStoryPage"));
const MindSyncPage = lazy(() => import("@/components/game/multi/MindSyncPage"));
const ColorPulsePage = lazy(() => import("@/components/game/multi/ColorPulsePage"));
const CelebrationWallPage = lazy(() => import("@/components/game/multi/CelebrationWallPage"));
const GroupContractPage = lazy(() => import("@/components/game/multi/GroupContractPage"));
const SilentDebatePage = lazy(() => import("@/components/game/multi/SilentDebatePage"));
const PointsAuctionPage = lazy(() => import("@/components/game/multi/PointsAuctionPage"));
const EmojiReactionPage = lazy(() => import("@/components/game/multi/EmojiReactionPage"));
const ConfirmItPage = lazy(() => import("@/components/game/multi/ConfirmItPage"));
const RateIdeaPage = lazy(() => import("@/components/game/multi/RateIdeaPage"));
const ClueRevealPage = lazy(() => import("@/components/game/multi/ClueRevealPage"));
const SpeedTypingPage = lazy(() => import("@/components/game/multi/SpeedTypingPage"));
const GroupMoodPage = lazy(() => import("@/components/game/multi/GroupMoodPage"));
const DailyIntentionPage = lazy(() => import("@/components/game/multi/DailyIntentionPage"));
const FreezeFramePage = lazy(() => import("@/components/game/multi/FreezeFramePage"));
const TwoColumnPage = lazy(() => import("@/components/game/multi/TwoColumnPage"));
const KudosWallPage = lazy(() => import("@/components/game/multi/KudosWallPage"));
const ProgressCheckPage = lazy(() => import("@/components/game/multi/ProgressCheckPage"));
const AhaBoardPage = lazy(() => import("@/components/game/multi/AhaBoardPage"));
const OneLineStoryPage = lazy(() => import("@/components/game/multi/OneLineStoryPage"));
const HeatMapPage = lazy(() => import("@/components/game/multi/HeatMapPage"));
const EnergyBoostPage = lazy(() => import("@/components/game/multi/EnergyBoostPage"));
const RolePlayCardPage = lazy(() => import("@/components/game/multi/RolePlayCardPage"));
const GroupDecisionPage = lazy(() => import("@/components/game/multi/GroupDecisionPage"));
const QuoteWallPage = lazy(() => import("@/components/game/multi/QuoteWallPage"));
const ActionItemPage = lazy(() => import("@/components/game/multi/ActionItemPage"));
const TableGroupPage = lazy(() => import("@/components/game/multi/TableGroupPage"));
const FeedbackFormPage = lazy(() => import("@/components/game/multi/FeedbackFormPage"));
const SkillSwapPage = lazy(() => import("@/components/game/multi/SkillSwapPage"));
const AnonymousVoicePage = lazy(() => import("@/components/game/multi/AnonymousVoicePage"));
const PitchVotePage = lazy(() => import("@/components/game/multi/PitchVotePage"));
const PredictionPollPage = lazy(() => import("@/components/game/multi/PredictionPollPage"));
const AudienceQPage = lazy(() => import("@/components/game/multi/AudienceQPage"));
const TastingNotesPage = lazy(() => import("@/components/game/multi/TastingNotesPage"));
const TimeVaultPage = lazy(() => import("@/components/game/multi/TimeVaultPage"));
const IdeaMarketPage = lazy(() => import("@/components/game/multi/IdeaMarketPage"));
const PersonalFactPage = lazy(() => import("@/components/game/multi/PersonalFactPage"));
const QuizBlitzPage = lazy(() => import("@/components/game/multi/QuizBlitzPage"));
const PlayerWordCloudPage = lazy(() => import("@/components/game/multi/WordCloudPage"));
const SpinWheelPage = lazy(() => import("@/components/game/multi/SpinWheelPage"));
const OpenMicPage = lazy(() => import("@/components/game/multi/OpenMicPage"));
const FastBuzzPage = lazy(() => import("@/components/game/multi/FastBuzzPage"));
const CrowdAnswerPage = lazy(() => import("@/components/game/multi/CrowdAnswerPage"));
const EmojiSliderPage = lazy(() => import("@/components/game/multi/EmojiSliderPage"));
const SceneVotePage = lazy(() => import("@/components/game/multi/SceneVotePage"));
const TimedChallengePage = lazy(() => import("@/components/game/multi/TimedChallengePage"));
const RankChoicePage = lazy(() => import("@/components/game/multi/RankChoicePage"));
const StoryBranchPage = lazy(() => import("@/components/game/multi/StoryBranchPage"));
const MoodMapPage = lazy(() => import("@/components/game/multi/MoodMapPage"));
const PairSharePage = lazy(() => import("@/components/game/multi/PairSharePage"));
const TeamSnapshotPage = lazy(() => import("@/components/game/multi/TeamSnapshotPage"));
const SongWallPage = lazy(() => import("@/components/game/multi/SongWallPage"));
const PersonalCompassPage = lazy(() => import("@/components/game/multi/PersonalCompassPage"));
const BrainDumpPage = lazy(() => import("@/components/game/multi/BrainDumpPage"));
const CheckboxVotePage = lazy(() => import("@/components/game/multi/CheckboxVotePage"));
const SuccessStoryPage = lazy(() => import("@/components/game/multi/SuccessStoryPage"));
const FutureIdeaPage = lazy(() => import("@/components/game/multi/FutureIdeaPage"));
const ValueCardPage = lazy(() => import("@/components/game/multi/ValueCardPage"));
const ThankYouNotePage = lazy(() => import("@/components/game/multi/ThankYouNotePage"));
const SkillMapPage = lazy(() => import("@/components/game/multi/SkillMapPage"));
const MoodBoardPage = lazy(() => import("@/components/game/multi/MoodBoardPage"));
const LearningCheckPage = lazy(() => import("@/components/game/multi/LearningCheckPage"));
const StandPointPage = lazy(() => import("@/components/game/multi/StandPointPage"));
const ConsensusMapPage = lazy(() => import("@/components/game/multi/ConsensusMapPage"));
const SpeedRoundPage = lazy(() => import("@/components/game/multi/SpeedRoundPage"));
const ScaleVotePage = lazy(() => import("@/components/game/multi/ScaleVotePage"));
const WishBucketPage = lazy(() => import("@/components/game/multi/WishBucketPage"));
const QuickPollPage = lazy(() => import("@/components/game/multi/QuickPollPage"));
const EmojiWallPage = lazy(() => import("@/components/game/multi/EmojiWallPage"));
const RandomPickPage = lazy(() => import("@/components/game/multi/RandomPickPage"));
const PersonalScorePage = lazy(() => import("@/components/game/multi/PersonalScorePage"));
const TimeCheckPage = lazy(() => import("@/components/game/multi/TimeCheckPage"));
const TokenVotePage = lazy(() => import("@/components/game/multi/TokenVotePage"));
const GalleryVotePage = lazy(() => import("@/components/game/multi/GalleryVotePage"));
const SentenceStemPage = lazy(() => import("@/components/game/multi/SentenceStemPage"));
const PixelMoodPage = lazy(() => import("@/components/game/multi/PixelMoodPage"));
const CascadeVotePage = lazy(() => import("@/components/game/multi/CascadeVotePage"));
const TeamManifestoPage = lazy(() => import("@/components/game/multi/TeamManifestoPage"));
const CuriosityMapPage = lazy(() => import("@/components/game/multi/CuriosityMapPage"));
const VibeCheckPage = lazy(() => import("@/components/game/multi/VibeCheckPage"));
const CollabCanvasPage = lazy(() => import("@/components/game/multi/CollabCanvasPage"));
const NumberLinePage = lazy(() => import("@/components/game/multi/NumberLinePage"));
const TwoByTwoPage = lazy(() => import("@/components/game/multi/TwoByTwoPage"));
const CountdownPledgePage = lazy(() => import("@/components/game/multi/CountdownPledgePage"));
const StarMapPage = lazy(() => import("@/components/game/multi/StarMapPage"));
const FlashCardPage = lazy(() => import("@/components/game/multi/FlashCardPage"));
const SpeedBrainstormPage = lazy(() => import("@/components/game/multi/SpeedBrainstormPage"));
const SignalMapPage = lazy(() => import("@/components/game/multi/SignalMapPage"));
const TeamTimeCapsulePage = lazy(() => import("@/components/game/multi/TeamTimeCapsulePage"));
const WarmCoolPage = lazy(() => import("@/components/game/multi/WarmCoolPage"));
const GiveGetPage = lazy(() => import("@/components/game/multi/GiveGetPage"));
const AskMeAnythingPage = lazy(() => import("@/components/game/multi/AskMeAnythingPage"));
const RoseBudThornPage = lazy(() => import("@/components/game/multi/RoseBudThornPage"));
const EventTimelinePage = lazy(() => import("@/components/game/multi/EventTimelinePage"));
const YesNoMaybePage = lazy(() => import("@/components/game/multi/YesNoMaybePage"));
const GroupNormPage = lazy(() => import("@/components/game/multi/GroupNormPage"));
const StoryWallPage = lazy(() => import("@/components/game/multi/StoryWallPage"));
const QuickReactionPage = lazy(() => import("@/components/game/multi/QuickReactionPage"));
const PersonalHighlightPage = lazy(() => import("@/components/game/multi/PersonalHighlightPage"));
const KptRetroPage = lazy(() => import("@/components/game/multi/KptRetroPage"));
const ConfidenceVotePage = lazy(() => import("@/components/game/multi/ConfidenceVotePage"));
const TeamGoalPage = lazy(() => import("@/components/game/multi/TeamGoalPage"));
const StartStopContinuePage = lazy(() => import("@/components/game/multi/StartStopContinuePage"));
const PlusEvenBetterPage = lazy(() => import("@/components/game/multi/PlusEvenBetterPage"));
const MeetingCheckPage = lazy(() => import("@/components/game/multi/MeetingCheckPage"));
const HeadlineNewsPage = lazy(() => import("@/components/game/multi/HeadlineNewsPage"));
const RiskRadarPage = lazy(() => import("@/components/game/multi/RiskRadarPage"));
const TwoWordsPage = lazy(() => import("@/components/game/multi/TwoWordsPage"));
const WinWinPage = lazy(() => import("@/components/game/multi/WinWinPage"));
const ImpactCardPage = lazy(() => import("@/components/game/multi/ImpactCardPage"));
const OpenQuizPage = lazy(() => import("@/components/game/multi/OpenQuizPage"));
const MicroBioPage = lazy(() => import("@/components/game/multi/MicroBioPage"));
const AfterActionPage = lazy(() => import("@/components/game/multi/AfterActionPage"));
const TeamAnimalPage = lazy(() => import("@/components/game/multi/TeamAnimalPage"));
const ReverseBrainstormPage = lazy(() => import("@/components/game/multi/ReverseBrainstormPage"));
const FourLsPage = lazy(() => import("@/components/game/multi/FourLsPage"));
const WonderBoardPage = lazy(() => import("@/components/game/multi/WonderBoardPage"));
const ObstacleMapPage = lazy(() => import("@/components/game/multi/ObstacleMapPage"));
const CommonGroundPage = lazy(() => import("@/components/game/multi/CommonGroundPage"));
const SurveyBlockPage = lazy(() => import("@/components/game/multi/SurveyBlockPage"));
const ThoughtBubblePage = lazy(() => import("@/components/game/multi/ThoughtBubblePage"));
const EnergyLevelPage = lazy(() => import("@/components/game/multi/EnergyLevelPage"));
const TeamVisionPage = lazy(() => import("@/components/game/multi/TeamVisionPage"));
const FutureMePage = lazy(() => import("@/components/game/multi/FutureMePage"));
const GrowthEdgePage = lazy(() => import("@/components/game/multi/GrowthEdgePage"));
const ValuesCardPage = lazy(() => import("@/components/game/multi/ValuesCardPage"));
const OpinionSliderPage = lazy(() => import("@/components/game/multi/OpinionSliderPage"));
const StrengthSpotPage = lazy(() => import("@/components/game/multi/StrengthSpotPage"));
const ChallengeFlagPage = lazy(() => import("@/components/game/multi/ChallengeFlagPage"));
const QuestionJarPage = lazy(() => import("@/components/game/multi/QuestionJarPage"));
const WorkStylePage = lazy(() => import("@/components/game/multi/WorkStylePage"));
const ReflectionCardPage = lazy(() => import("@/components/game/multi/ReflectionCardPage"));
const PeakMomentPage = lazy(() => import("@/components/game/multi/PeakMomentPage"));
const SafetyCheckPage = lazy(() => import("@/components/game/multi/SafetyCheckPage"));
const ExpectationBoardPage = lazy(() => import("@/components/game/multi/ExpectationBoardPage"));
const SatisfactionMeterPage = lazy(() => import("@/components/game/multi/SatisfactionMeterPage"));
const TeamFlagPage = lazy(() => import("@/components/game/multi/TeamFlagPage"));
const LearningObjectivePage = lazy(() => import("@/components/game/multi/LearningObjectivePage"));
const AppreciationNotePage = lazy(() => import("@/components/game/multi/AppreciationNotePage"));
const MeetingRatingPage = lazy(() => import("@/components/game/multi/MeetingRatingPage"));
const SkillShowcasePage = lazy(() => import("@/components/game/multi/SkillShowcasePage"));
const HabitTrackerPage = lazy(() => import("@/components/game/multi/HabitTrackerPage"));
const CareerHighlightPage = lazy(() => import("@/components/game/multi/CareerHighlightPage"));
const SuperpowerCardPage = lazy(() => import("@/components/game/multi/SuperpowerCardPage"));
const OriginStoryPage = lazy(() => import("@/components/game/multi/OriginStoryPage"));
const WisdomPoolPage = lazy(() => import("@/components/game/multi/WisdomPoolPage"));
const BlindSpotPage = lazy(() => import("@/components/game/multi/BlindSpotPage"));
const LifeLinePage = lazy(() => import("@/components/game/multi/LifeLinePage"));
const TalentSwapPage = lazy(() => import("@/components/game/multi/TalentSwapPage"));
const GiftBoxPage = lazy(() => import("@/components/game/multi/GiftBoxPage"));
const TimeCapsulePage = lazy(() => import("@/components/game/multi/TimeCapsulePage"));
const TeamPactPage = lazy(() => import("@/components/game/multi/TeamPactPage"));
const EnergyMapPage = lazy(() => import("@/components/game/multi/EnergyMapPage"));
const ChallengeMapPage = lazy(() => import("@/components/game/multi/ChallengeMapPage"));
const ActionPlanPage = lazy(() => import("@/components/game/multi/ActionPlanPage"));
const VisionBoardPage = lazy(() => import("@/components/game/multi/VisionBoardPage"));
const ConflictStylePage = lazy(() => import("@/components/game/multi/ConflictStylePage"));
const PeerMirrorPage = lazy(() => import("@/components/game/multi/PeerMirrorPage"));
const MotivationMapPage = lazy(() => import("@/components/game/multi/MotivationMapPage"));
const HeroStoryPage = lazy(() => import("@/components/game/multi/HeroStoryPage"));
const LearningStylePage = lazy(() => import("@/components/game/multi/LearningStylePage"));
const StressSignalPage = lazy(() => import("@/components/game/multi/StressSignalPage"));
const DecisionStylePage = lazy(() => import("@/components/game/multi/DecisionStylePage"));
const ThreeWordsPage = lazy(() => import("@/components/game/multi/ThreeWordsPage"));
const TeamRadarPage = lazy(() => import("@/components/game/multi/TeamRadarPage"));
const TodayFeelPage = lazy(() => import("@/components/game/multi/TodayFeelPage"));
const SpeedFactPage = lazy(() => import("@/components/game/multi/SpeedFactPage"));
const ColorVibePage = lazy(() => import("@/components/game/multi/ColorVibePage"));
const GoodNewsPage = lazy(() => import("@/components/game/multi/GoodNewsPage"));
const LoveAdvicePage = lazy(() => import("@/components/game/multi/LoveAdvicePage"));
const FavMemoryPage = lazy(() => import("@/components/game/multi/FavMemoryPage"));
const DreamTripPage = lazy(() => import("@/components/game/multi/DreamTripPage"));
const BookRecPage = lazy(() => import("@/components/game/multi/BookRecPage"));
const MottoBoardPage = lazy(() => import("@/components/game/multi/MottoBoardPage"));
const TimeCapacityPage = lazy(() => import("@/components/game/multi/TimeCapacityPage"));
const WishListPage = lazy(() => import("@/components/game/multi/WishListPage"));
const StrengthMapPage = lazy(() => import("@/components/game/multi/StrengthMapPage"));
const SecretTalentPage = lazy(() => import("@/components/game/multi/SecretTalentPage"));
const LifeLessonPage = lazy(() => import("@/components/game/multi/LifeLessonPage"));
const AnimalSpiritPage = lazy(() => import("@/components/game/multi/AnimalSpiritPage"));
const ChildhoodGamePage = lazy(() => import("@/components/game/multi/ChildhoodGamePage"));
const MoodWeatherPage = lazy(() => import("@/components/game/multi/MoodWeatherPage"));
const MovieGenrePage = lazy(() => import("@/components/game/multi/MovieGenrePage"));
const FoodMoodPage = lazy(() => import("@/components/game/multi/FoodMoodPage"));
const DreamJobPage = lazy(() => import("@/components/game/multi/DreamJobPage"));
const TravelStylePage = lazy(() => import("@/components/game/multi/TravelStylePage"));
const SeasonPersonPage = lazy(() => import("@/components/game/multi/SeasonPersonPage"));
const ColorPersonalityPage = lazy(() => import("@/components/game/multi/ColorPersonalityPage"));
const HeroTypePage = lazy(() => import("@/components/game/multi/HeroTypePage"));
const PetPersonalityPage = lazy(() => import("@/components/game/multi/PetPersonalityPage"));
const MusicGenrePage = lazy(() => import("@/components/game/multi/MusicGenrePage"));
const ElementalTypePage = lazy(() => import("@/components/game/multi/ElementalTypePage"));
const CoffeeOrderPage = lazy(() => import("@/components/game/multi/CoffeeOrderPage"));
const PlantTypePage = lazy(() => import("@/components/game/multi/PlantTypePage"));
const CityTypePage = lazy(() => import("@/components/game/multi/CityTypePage"));
const SportVibesPage = lazy(() => import("@/components/game/multi/SportVibesPage"));
const MovieRolePage = lazy(() => import("@/components/game/multi/MovieRolePage"));
const GemStonePage = lazy(() => import("@/components/game/multi/GemStonePage"));
const MythAnimalPage = lazy(() => import("@/components/game/multi/MythAnimalPage"));
const TeaTypePage = lazy(() => import("@/components/game/multi/TeaTypePage"));
const PlanetTypePage = lazy(() => import("@/components/game/multi/PlanetTypePage"));
const VehicleTypePage = lazy(() => import("@/components/game/multi/VehicleTypePage"));
const WeatherTypePage = lazy(() => import("@/components/game/multi/WeatherTypePage"));
const BookGenrePage = lazy(() => import("@/components/game/multi/BookGenrePage"));
const FlowerTypePage = lazy(() => import("@/components/game/multi/FlowerTypePage"));
const CoffeeTypePage = lazy(() => import("@/components/game/multi/CoffeeTypePage"));
const TreeTypePage = lazy(() => import("@/components/game/multi/TreeTypePage"));
const OceanCreaturePage = lazy(() => import("@/components/game/multi/OceanCreaturePage"));
const CandyTypePage = lazy(() => import("@/components/game/multi/CandyTypePage"));
const SpiceTypePage = lazy(() => import("@/components/game/multi/SpiceTypePage"));
const BoardGamePage = lazy(() => import("@/components/game/multi/BoardGamePage"));
const LandscapeTypePage = lazy(() => import("@/components/game/multi/LandscapeTypePage"));
const ArtStylePage = lazy(() => import("@/components/game/multi/ArtStylePage"));
const InsectTypePage = lazy(() => import("@/components/game/multi/InsectTypePage"));
const GemstoneTypePage = lazy(() => import("@/components/game/multi/GemstoneTypePage"));
const MusicTypePage = lazy(() => import("@/components/game/multi/MusicTypePage"));
const BookTypePage = lazy(() => import("@/components/game/multi/BookTypePage"));
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
const AnchorPointPage = lazy(() => import("@/components/game/multi/AnchorPointPage"));
const FirstWordPage = lazy(() => import("@/components/game/multi/FirstWordPage"));
const LegacyWordPage = lazy(() => import("@/components/game/multi/LegacyWordPage"));
const SafetyLevelPage = lazy(() => import("@/components/game/multi/SafetyLevelPage"));
const SparkCapturePage = lazy(() => import("@/components/game/multi/SparkCapturePage"));
const MicroCommitPage = lazy(() => import("@/components/game/multi/MicroCommitPage"));
const ClosingThoughtPage = lazy(() => import("@/components/game/multi/ClosingThoughtPage"));
const GiftToTeamPage = lazy(() => import("@/components/game/multi/GiftToTeamPage"));
const MythicalCreaturePage = lazy(() => import("@/components/game/multi/MythicalCreaturePage"));
const DanceStylePage = lazy(() => import("@/components/game/multi/DanceStylePage"));
const ArchitectureStylePage = lazy(() => import("@/components/game/multi/ArchitectureStylePage"));
const CheeseTypePage = lazy(() => import("@/components/game/multi/CheeseTypePage"));
const MushroomTypePage = lazy(() => import("@/components/game/multi/MushroomTypePage"));
const PastaTypePage = lazy(() => import("@/components/game/multi/PastaTypePage"));
const SushiTypePage = lazy(() => import("@/components/game/multi/SushiTypePage"));
const MaterialTypePage = lazy(() => import("@/components/game/multi/MaterialTypePage"));
const FruitTypePage = lazy(() => import("@/components/game/multi/FruitTypePage"));
const ChocolateTypePage = lazy(() => import("@/components/game/multi/ChocolateTypePage"));
const BirdTypePage = lazy(() => import("@/components/game/multi/BirdTypePage"));
const FishTypePage = lazy(() => import("@/components/game/multi/FishTypePage"));
const IceCreamTypePage = lazy(() => import("@/components/game/multi/IceCreamTypePage"));
const PizzaTypePage = lazy(() => import("@/components/game/multi/PizzaTypePage"));
const AbilityBadgePage = lazy(() => import("@/components/game/multi/AbilityBadgePage"));
const PowerWordPage = lazy(() => import("@/components/game/multi/PowerWordPage"));
const TodayWinPage = lazy(() => import("@/components/game/multi/TodayWinPage"));
const MindShiftPage = lazy(() => import("@/components/game/multi/MindShiftPage"));
const SupportCirclePage = lazy(() => import("@/components/game/multi/SupportCirclePage"));
const WhyCardPage = lazy(() => import("@/components/game/multi/WhyCardPage"));
const ResilienceCardPage = lazy(() => import("@/components/game/multi/ResilienceCardPage"));
const MoonPhasePage = lazy(() => import("@/components/game/multi/MoonPhasePage"));

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
        return <GpsTeamMissionPage {...commonProps} />;
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
      case "shared_board":
        return <SharedBoardPage {...commonProps} page={page} pageId={page.id} />;
      case "bingo":
        return <BingoPage {...commonProps} page={page} pageId={page.id} />;
      case "mood_meter":
        return <MoodMeterPage {...commonProps} page={page} pageId={page.id} />;
      case "team_checklist":
        return <TeamChecklistPage {...commonProps} page={page} pageId={page.id} />;
      case "feedback_star":
        return <FeedbackStarPage {...commonProps} page={page} pageId={page.id} />;
      case "team_word_cloud":
        return <TeamWordCloudPage {...commonProps} page={page} pageId={page.id} />;
      case "check_in":
        return <CheckInPage {...commonProps} page={page} pageId={page.id} />;
      case "group_timer":
        return <GroupTimerPage {...commonProps} page={page} pageId={page.id} />;
      case "quick_question":
        return <QuickQuestionPage {...commonProps} page={page} pageId={page.id} />;
      case "wish_wall":
        return <WishWallPage {...commonProps} page={page} pageId={page.id} />;
      case "stamp_card":
        return <StampCardPage {...commonProps} page={page} pageId={page.id} />;
      case "multi_vote":
        return <MultiVotePage {...commonProps} page={page} pageId={page.id} />;
      case "photo_wall":
        return <PhotoWallPage {...commonProps} page={page} pageId={page.id} />;
      case "countdown_reveal":
        return <CountdownRevealPage {...commonProps} page={page} pageId={page.id} />;
      case "seat_draw":
        return <SeatDrawPage {...commonProps} page={page} pageId={page.id} />;
      case "name_card":
        return <NameCardPage {...commonProps} page={page} pageId={page.id} />;
      case "rating_wall":
        return <RatingWallPage {...commonProps} page={page} pageId={page.id} />;
      case "pop_quiz":
        return <PopQuizPage {...commonProps} page={page} pageId={page.id} />;
      case "lucky_draw":
        return <LuckyDrawPage {...commonProps} page={page} pageId={page.id} />;
      case "question_box":
        return <QuestionBoxPage {...commonProps} page={page} pageId={page.id} />;
      case "story_chain":
        return <StoryChainPage {...commonProps} page={page} pageId={page.id} />;
      case "random_team":
        return <RandomTeamPage {...commonProps} page={page} pageId={page.id} />;
      case "dot_vote":
        return <DotVotePage {...commonProps} page={page} pageId={page.id} />;
      case "timeline_wall":
        return <TimelineWallPage {...commonProps} page={page} pageId={page.id} />;
      case "two_truths":
        return <TwoTruthsPage {...commonProps} page={page} pageId={page.id} />;
      case "retro_board":
        return <RetroBoardPage {...commonProps} page={page} pageId={page.id} />;
      case "pledge_wall":
        return <PledgeWallPage {...commonProps} page={page} pageId={page.id} />;
      case "live_pulse":
        return <LivePulsePage {...commonProps} page={page} pageId={page.id} />;
      case "debate_vote":
        return <DebateVotePage {...commonProps} page={page} pageId={page.id} />;
      case "peer_recognition":
        return <PeerRecognitionPage {...commonProps} page={page} pageId={page.id} />;
      case "consensus_scale":
        return <ConsensusScalePage {...commonProps} page={page} pageId={page.id} />;
      case "idea_wall":
        return <IdeaWallPage {...commonProps} page={page} pageId={page.id} />;
      case "speed_networking":
        return <SpeedNetworkingPage {...commonProps} page={page} pageId={page.id} />;
      case "photo_contest":
        return <PhotoContestPage {...commonProps} page={page} pageId={page.id} />;
      case "emoji_battle":
        return <EmojiBattlePage {...commonProps} page={page} pageId={page.id} />;
      case "challenge_board":
        return <ChallengeBoardPage {...commonProps} page={page} pageId={page.id} />;
      case "bucket_list":
        return <BucketListPage {...commonProps} page={page} pageId={page.id} />;
      case "gratitude_wall":
        return <GratitudeWallPage {...commonProps} page={page} pageId={page.id} />;
      case "team_contract":
        return <TeamContractPage {...commonProps} page={page} pageId={page.id} />;
      case "priority_rank":
        return <PriorityRankPage {...commonProps} page={page} pageId={page.id} />;
      case "hot_seat":
        return <HotSeatPage {...commonProps} page={page} pageId={page.id} />;
      case "team_health_check":
        return <TeamHealthCheckPage {...commonProps} page={page} pageId={page.id} />;
      case "project_showcase":
        return <ProjectShowcasePage {...commonProps} page={page} pageId={page.id} />;
      case "category_sort":
        return <CategorySortPage {...commonProps} page={page} pageId={page.id} />;
      case "estimation_game":
        return <EstimationGamePage {...commonProps} page={page} pageId={page.id} />;
      case "agreement_matrix":
        return <AgreementMatrixPage {...commonProps} page={page} pageId={page.id} />;
      case "mad_libs":
        return <MadLibsPage {...commonProps} page={page} pageId={page.id} />;
      case "spectrum_line":
        return <SpectrumLinePage {...commonProps} page={page} pageId={page.id} />;
      case "photo_caption":
        return <PhotoCaptionPage {...commonProps} page={page} pageId={page.id} />;
      case "would_you_rather":
        return <WouldYouRatherPage {...commonProps} page={page} pageId={page.id} />;
      case "scaled_feedback":
        return <ScaledFeedbackPage {...commonProps} page={page} pageId={page.id} />;
      case "team_poll":
        return <TeamPollPage {...commonProps} page={page} pageId={page.id} />;
      case "open_question":
        return <OpenQuestionPage {...commonProps} page={page} pageId={page.id} />;
      case "countdown_challenge":
        return <CountdownChallengePage {...commonProps} page={page} pageId={page.id} />;
      case "hot_take":
        return <HotTakePage {...commonProps} page={page} pageId={page.id} />;
      case "knowledge_check":
        return <KnowledgeCheckPage {...commonProps} page={page} pageId={page.id} />;
      case "most_likely":
        return <MostLikelyPage {...commonProps} page={page} pageId={page.id} />;
      case "presence_map":
        return <PresenceMapPage {...commonProps} page={page} pageId={page.id} />;
      case "letter_to_self":
        return <LetterToSelfPage {...commonProps} page={page} pageId={page.id} />;
      case "group_cheer":
        return <GroupCheerPage {...commonProps} page={page} pageId={page.id} />;
      case "silent_brainstorm":
        return <SilentBrainstormPage {...commonProps} page={page} pageId={page.id} />;
      case "card_draw":
        return <CardDrawPage {...commonProps} page={page} pageId={page.id} />;
      case "group_promise":
        return <GroupPromisePage {...commonProps} page={page} pageId={page.id} />;
      case "sentence_completion":
        return <SentenceCompletionPage {...commonProps} page={page} pageId={page.id} />;
      case "action_pledge":
        return <ActionPledgePage {...commonProps} page={page} pageId={page.id} />;
      case "thinking_hats":
        return <ThinkingHatsPage {...commonProps} page={page} pageId={page.id} />;
      case "truth_or_myth":
        return <TruthOrMythPage {...commonProps} page={page} pageId={page.id} />;
      case "emoji_check_in":
        return <EmojiCheckInPage {...commonProps} page={page} pageId={page.id} />;
      case "word_association":
        return <WordAssociationPage {...commonProps} page={page} pageId={page.id} />;
      case "feedback_sandwich":
        return <FeedbackSandwichPage {...commonProps} page={page} pageId={page.id} />;
      case "value_rank":
        return <ValueRankPage {...commonProps} page={page} pageId={page.id} />;
      case "collective_poem":
        return <CollectivePoemPage {...commonProps} page={page} pageId={page.id} />;
      case "bottle_letter":
        return <BottleLetterPage {...commonProps} page={page} pageId={page.id} />;
      case "time_capture":
        return <TimeCapturePage {...commonProps} page={page} pageId={page.id} />;
      case "glow_grow":
        return <GlowGrowPage {...commonProps} page={page} pageId={page.id} />;
      case "word_ladder":
        return <WordLadderPage {...commonProps} page={page} pageId={page.id} />;
      case "hope_fear":
        return <HopeFearPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "number_guess":
        return <NumberGuessPage {...commonProps} page={page} pageId={page.id} />;
      case "never_have_i_ever":
        return <NeverHaveIEverPage {...commonProps} page={page} pageId={page.id} />;
      case "reaction_wall":
        return <ReactionWallPage {...commonProps} page={page} pageId={page.id} />;
      case "desert_island":
        return <DesertIslandPage {...commonProps} page={page} pageId={page.id} />;
      case "category_challenge":
        return <CategoryChallengePage {...commonProps} page={page} pageId={page.id} />;
      case "word_bid":
        return <WordBidPage {...commonProps} page={page} pageId={page.id} />;
      case "memory_lane":
        return <MemoryLanePage {...commonProps} page={page} pageId={page.id} />;
      case "emoji_story":
        return <EmojiStoryPage {...commonProps} page={page} pageId={page.id} />;
      case "mind_sync":
        return <MindSyncPage {...commonProps} page={page} pageId={page.id} />;
      case "color_pulse":
        return <ColorPulsePage {...commonProps} page={page} pageId={page.id} />;
      case "celebration_wall":
        return <CelebrationWallPage {...commonProps} page={page} pageId={page.id} />;
      case "group_contract":
        return <GroupContractPage {...commonProps} page={page} pageId={page.id} />;
      case "silent_debate":
        return <SilentDebatePage {...commonProps} page={page} pageId={page.id} />;
      case "points_auction":
        return <PointsAuctionPage {...commonProps} page={page} pageId={page.id} />;
      case "emoji_reaction":
        return <EmojiReactionPage {...commonProps} page={page} pageId={page.id} />;
      case "confirm_it":
        return <ConfirmItPage {...commonProps} page={page} pageId={page.id} />;
      case "rate_idea":
        return <RateIdeaPage {...commonProps} page={page} pageId={page.id} />;
      case "clue_reveal":
        return <ClueRevealPage {...commonProps} page={page} pageId={page.id} />;
      case "group_mood":
        return <GroupMoodPage {...commonProps} page={page} pageId={page.id} />;
      case "daily_intention":
        return <DailyIntentionPage {...commonProps} page={page} pageId={page.id} />;
      case "freeze_frame":
        return <FreezeFramePage {...commonProps} page={page} pageId={page.id} />;
      case "two_column":
        return <TwoColumnPage {...commonProps} page={page} pageId={page.id} />;
      case "kudos_wall":
        return <KudosWallPage {...commonProps} page={page} pageId={page.id} />;
      case "progress_check":
        return <ProgressCheckPage {...commonProps} page={page} pageId={page.id} />;
      case "aha_board":
        return <AhaBoardPage {...commonProps} page={page} pageId={page.id} />;
      case "one_line_story":
        return <OneLineStoryPage {...commonProps} page={page} pageId={page.id} />;
      case "heat_map":
        return <HeatMapPage {...commonProps} page={page} pageId={page.id} />;
      case "energy_boost":
        return <EnergyBoostPage {...commonProps} page={page} pageId={page.id} />;
      case "role_play_card":
        return <RolePlayCardPage {...commonProps} page={page} pageId={page.id} />;
      case "group_decision":
        return <GroupDecisionPage {...commonProps} page={page} pageId={page.id} />;
      case "quote_wall":
        return <QuoteWallPage {...commonProps} page={page} pageId={page.id} />;
      case "action_item":
        return <ActionItemPage {...commonProps} page={page} pageId={page.id} />;
      case "table_group":
        return <TableGroupPage {...commonProps} page={page} pageId={page.id} />;
      case "feedback_form":
        return <FeedbackFormPage {...commonProps} page={page} pageId={page.id} />;
      case "speed_typing":
        return <SpeedTypingPage {...commonProps} page={page} pageId={page.id} />;
      case "skill_swap":
        return <SkillSwapPage {...commonProps} page={page} pageId={page.id} />;
      case "anonymous_voice":
        return <AnonymousVoicePage {...commonProps} page={page} pageId={page.id} />;
      case "pitch_vote":
        return <PitchVotePage {...commonProps} page={page} pageId={page.id} />;
      case "prediction_poll":
        return <PredictionPollPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "audience_q":
        return <AudienceQPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "tasting_notes":
        return <TastingNotesPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "time_vault":
        return <TimeVaultPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "idea_market":
        return <IdeaMarketPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "personal_fact":
        return <PersonalFactPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "quiz_blitz":
        return <QuizBlitzPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "word_cloud":
        return <PlayerWordCloudPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "spin_wheel":
        return <SpinWheelPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "open_mic":
        return <OpenMicPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "fast_buzz":
        return <FastBuzzPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "crowd_answer":
        return <CrowdAnswerPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "emoji_slider":
        return <EmojiSliderPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "scene_vote":
        return <SceneVotePage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "timed_challenge":
        return <TimedChallengePage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "rank_choice":
        return <RankChoicePage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "story_branch":
        return <StoryBranchPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "mood_map":
        return <MoodMapPage gameId={commonProps.gameId} sessionId={commonProps.sessionId} page={page} pageId={page.id} />;
      case "pair_share":
        return <PairSharePage {...commonProps} page={page} pageId={page.id} />;
      case "team_snapshot":
        return <TeamSnapshotPage {...commonProps} page={page} pageId={page.id} />;
      case "song_wall":
        return <SongWallPage {...commonProps} page={page} pageId={page.id} />;
      case "personal_compass":
        return <PersonalCompassPage {...commonProps} page={page} pageId={page.id} />;
      case "brain_dump":
        return <BrainDumpPage {...commonProps} page={page} pageId={page.id} />;
      case "checkbox_vote":
        return <CheckboxVotePage {...commonProps} page={page} pageId={page.id} />;
      case "success_story":
        return <SuccessStoryPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "future_idea":
        return <FutureIdeaPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "value_card":
        return <ValueCardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "thank_you_note":
        return <ThankYouNotePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "skill_map":
        return <SkillMapPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "mood_board":
        return <MoodBoardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "learning_check":
        return <LearningCheckPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "stand_point":
        return <StandPointPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "consensus_map":
        return <ConsensusMapPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "speed_round":
        return <SpeedRoundPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "scale_vote":
        return <ScaleVotePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "wish_bucket":
        return <WishBucketPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "quick_poll":
        return <QuickPollPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "emoji_wall":
        return <EmojiWallPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "random_pick":
        return <RandomPickPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "personal_score":
        return <PersonalScorePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "time_check":
        return <TimeCheckPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "token_vote":
        return <TokenVotePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "gallery_vote":
        return <GalleryVotePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "sentence_stem":
        return <SentenceStemPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "pixel_mood":
        return <PixelMoodPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "cascade_vote":
        return <CascadeVotePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "team_manifesto":
        return <TeamManifestoPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "curiosity_map":
        return <CuriosityMapPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "vibe_check":
        return <VibeCheckPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "collab_canvas":
        return <CollabCanvasPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "number_line":
        return <NumberLinePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "two_by_two":
        return <TwoByTwoPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "countdown_pledge":
        return <CountdownPledgePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "star_map":
        return <StarMapPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "flash_card":
        return <FlashCardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "speed_brainstorm":
        return <SpeedBrainstormPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "signal_map":
        return <SignalMapPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "team_time_capsule":
        return <TeamTimeCapsulePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "warm_cool":
        return <WarmCoolPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "give_get":
        return <GiveGetPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "ask_me_anything":
        return <AskMeAnythingPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "rose_bud_thorn":
        return <RoseBudThornPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "event_timeline":
        return <EventTimelinePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "yes_no_maybe":
        return <YesNoMaybePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "group_norm":
        return <GroupNormPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "story_wall":
        return <StoryWallPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "quick_reaction":
        return <QuickReactionPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "personal_highlight":
        return <PersonalHighlightPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "kpt_retro":
        return <KptRetroPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "confidence_vote":
        return <ConfidenceVotePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "team_goal":
        return <TeamGoalPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "start_stop_continue":
        return <StartStopContinuePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "plus_even_better":
        return <PlusEvenBetterPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "meeting_check":
        return <MeetingCheckPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "headline_news":
        return <HeadlineNewsPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "risk_radar":
        return <RiskRadarPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "two_words":
        return <TwoWordsPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "win_win":
        return <WinWinPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "impact_card":
        return <ImpactCardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "open_quiz":
        return <OpenQuizPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "micro_bio":
        return <MicroBioPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "after_action":
        return <AfterActionPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "team_animal":
        return <TeamAnimalPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "reverse_brainstorm":
        return <ReverseBrainstormPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "four_ls":
        return <FourLsPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "wonder_board":
        return <WonderBoardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "obstacle_map":
        return <ObstacleMapPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "common_ground":
        return <CommonGroundPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "survey_block":
        return <SurveyBlockPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "thought_bubble":
        return <ThoughtBubblePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "energy_level":
        return <EnergyLevelPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "team_vision":
        return <TeamVisionPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "future_me":
        return <FutureMePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "growth_edge":
        return <GrowthEdgePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "values_card":
        return <ValuesCardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "opinion_slider":
        return <OpinionSliderPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "strength_spot":
        return <StrengthSpotPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "challenge_flag":
        return <ChallengeFlagPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "question_jar":
        return <QuestionJarPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "work_style":
        return <WorkStylePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "reflection_card":
        return <ReflectionCardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "peak_moment":
        return <PeakMomentPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "safety_check":
        return <SafetyCheckPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "expectation_board":
        return <ExpectationBoardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "satisfaction_meter":
        return <SatisfactionMeterPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "team_flag":
        return <TeamFlagPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "learning_objective":
        return <LearningObjectivePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "appreciation_note":
        return <AppreciationNotePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "meeting_rating":
        return <MeetingRatingPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "skill_showcase":
        return <SkillShowcasePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "habit_tracker":
        return <HabitTrackerPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "career_highlight":
        return <CareerHighlightPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "superpower_card":
        return <SuperpowerCardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "origin_story":
        return <OriginStoryPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "wisdom_pool":
        return <WisdomPoolPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "blind_spot":
        return <BlindSpotPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "life_line":
        return <LifeLinePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "talent_swap":
        return <TalentSwapPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "gift_box":
        return <GiftBoxPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "time_capsule":
        return <TimeCapsulePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "team_pact":
        return <TeamPactPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "energy_map":
        return <EnergyMapPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "challenge_map":
        return <ChallengeMapPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "action_plan":
        return <ActionPlanPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "vision_board":
        return <VisionBoardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "conflict_style":
        return <ConflictStylePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "peer_mirror":
        return <PeerMirrorPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "motivation_map":
        return <MotivationMapPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "hero_story":
        return <HeroStoryPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "learning_style":
        return <LearningStylePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "stress_signal":
        return <StressSignalPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "decision_style":
        return <DecisionStylePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "three_words":
        return <ThreeWordsPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "team_radar":
        return <TeamRadarPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "today_feel":
        return <TodayFeelPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "speed_fact":
        return <SpeedFactPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "color_vibe":
        return <ColorVibePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "good_news":
        return <GoodNewsPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "love_advice":
        return <LoveAdvicePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "fav_memory":
        return <FavMemoryPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "dream_trip":
        return <DreamTripPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "book_rec":
        return <BookRecPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "motto_board":
        return <MottoBoardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "time_capacity":
        return <TimeCapacityPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "wish_list":
        return <WishListPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "strength_map":
        return <StrengthMapPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "secret_talent":
        return <SecretTalentPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "life_lesson":
        return <LifeLessonPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "animal_spirit":
        return <AnimalSpiritPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "childhood_game":
        return <ChildhoodGamePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "mood_weather":
        return <MoodWeatherPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "movie_genre":
        return <MovieGenrePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "food_mood":
        return <FoodMoodPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "dream_job":
        return <DreamJobPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "travel_style":
        return <TravelStylePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "season_person":
        return <SeasonPersonPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "color_personality":
        return <ColorPersonalityPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "hero_type":
        return <HeroTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "pet_personality":
        return <PetPersonalityPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "music_genre":
        return <MusicGenrePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "elemental_type":
        return <ElementalTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "coffee_order":
        return <CoffeeOrderPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "plant_type":
        return <PlantTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "city_type":
        return <CityTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "sport_vibes":
        return <SportVibesPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "movie_role":
        return <MovieRolePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "gem_stone":
        return <GemStonePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "myth_animal":
        return <MythAnimalPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "tea_type":
        return <TeaTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "planet_type":
        return <PlanetTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "vehicle_type":
        return <VehicleTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "weather_type":
        return <WeatherTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "book_genre":
        return <BookGenrePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "flower_type":
        return <FlowerTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "coffee_type":
        return <CoffeeTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "tree_type":
        return <TreeTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "ocean_creature":
        return <OceanCreaturePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "candy_type":
        return <CandyTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "spice_type":
        return <SpiceTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "board_game":
        return <BoardGamePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "landscape_type":
        return <LandscapeTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "art_style":
        return <ArtStylePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "insect_type":
        return <InsectTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "gemstone_type":
        return <GemstoneTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "music_type":
        return <MusicTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "book_type":
        return <BookTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
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
      case "anchor_point":
        return <AnchorPointPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "first_word":
        return <FirstWordPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "legacy_word":
        return <LegacyWordPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "safety_level":
        return <SafetyLevelPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "spark_capture":
        return <SparkCapturePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "micro_commit":
        return <MicroCommitPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "closing_thought":
        return <ClosingThoughtPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "gift_to_team":
        return <GiftToTeamPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "mythical_creature":
        return <MythicalCreaturePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "dance_style":
        return <DanceStylePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "architecture_style":
        return <ArchitectureStylePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "cheese_type":
        return <CheeseTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "mushroom_type":
        return <MushroomTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "pasta_type":
        return <PastaTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "sushi_type":
        return <SushiTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "material_type":
        return <MaterialTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "fruit_type":
        return <FruitTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "chocolate_type":
        return <ChocolateTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "bird_type":
        return <BirdTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "fish_type":
        return <FishTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "ice_cream_type":
        return <IceCreamTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "pizza_type":
        return <PizzaTypePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "ability_badge":
        return <AbilityBadgePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "power_word":
        return <PowerWordPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "today_win":
        return <TodayWinPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "mind_shift":
        return <MindShiftPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "support_circle":
        return <SupportCirclePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "why_card":
        return <WhyCardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "resilience_card":
        return <ResilienceCardPage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
      case "moon_phase":
        return <MoonPhasePage {...commonProps} pageId={page.id} config={page.config as Record<string, unknown>} />;
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
