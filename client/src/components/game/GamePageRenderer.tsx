// 遊戲頁面渲染器 - 根據 pageType 渲染對應元件
// 使用 React.lazy 動態載入，避免 GamePlay chunk 過大
import { lazy, Suspense, useMemo } from "react";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/feedback/PageTransition";

const TextCardPage = lazy(() => import("@/components/game/TextCardPage"));
const DialoguePage = lazy(() => import("@/components/game/DialoguePage"));
const VideoPage = lazy(() => import("@/components/game/VideoPage"));
const ButtonPage = lazy(() => import("@/components/game/ButtonPage"));
const TextVerifyPage = lazy(() => import("@/components/game/TextVerifyPage"));
const ChoiceVerifyPage = lazy(() => import("@/components/game/ChoiceVerifyPage"));
const ConditionalVerifyPage = lazy(() => import("@/components/game/ConditionalVerifyPage"));
const ShootingMissionPage = lazy(() => import("@/components/game/ShootingMissionPage"));
const PhotoMissionPage = lazy(() => import("@/components/game/PhotoMissionPage"));
// 🆕 v2 獨立拍照類元件（2026-04-24）
const PhotoSpotFlow = lazy(() => import("@/components/game/PhotoSpotFlow"));
const PhotoCompareFlow = lazy(() => import("@/components/game/PhotoCompareFlow"));
const GpsMissionPage = lazy(() => import("@/components/game/GpsMissionPage"));
const QrScanPage = lazy(() => import("@/components/game/QrScanPage"));
const TimeBombPage = lazy(() => import("@/components/game/TimeBombPage"));
const LockPage = lazy(() => import("@/components/game/LockPage"));
const MotionChallengePage = lazy(() => import("@/components/game/MotionChallengePage"));
const VotePage = lazy(() => import("@/components/game/VotePage"));
const FlowRouterPage = lazy(() => import("@/components/game/FlowRouterPage"));

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

  // 記憶化 commonProps 避免每次渲染都建立新物件
  const commonProps = useMemo(() => ({
    config,
    onComplete,
    onVariableUpdate,
    sessionId,
    gameId,
    variables,
  }), [config, onComplete, onVariableUpdate, sessionId, gameId, variables]);

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
  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={page.id} variant={variant} className="h-full">
        <Suspense fallback={<PageLoadingFallback />}>{renderPage()}</Suspense>
      </PageTransition>
    </AnimatePresence>
  );
}
