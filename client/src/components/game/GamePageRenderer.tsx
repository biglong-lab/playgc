// 遊戲頁面渲染器 - 根據 pageType 渲染對應元件
// 使用 React.lazy 動態載入，避免 GamePlay chunk 過大
import { lazy, Suspense, useMemo } from "react";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

const TextCardPage = lazy(() => import("@/components/game/TextCardPage"));
const DialoguePage = lazy(() => import("@/components/game/DialoguePage"));
const VideoPage = lazy(() => import("@/components/game/VideoPage"));
const ButtonPage = lazy(() => import("@/components/game/ButtonPage"));
const TextVerifyPage = lazy(() => import("@/components/game/TextVerifyPage"));
const ChoiceVerifyPage = lazy(() => import("@/components/game/ChoiceVerifyPage"));
const ConditionalVerifyPage = lazy(() => import("@/components/game/ConditionalVerifyPage"));
const ShootingMissionPage = lazy(() => import("@/components/game/ShootingMissionPage"));
const PhotoMissionPage = lazy(() => import("@/components/game/PhotoMissionPage"));
const GpsMissionPage = lazy(() => import("@/components/game/GpsMissionPage"));
const QrScanPage = lazy(() => import("@/components/game/QrScanPage"));
const TimeBombPage = lazy(() => import("@/components/game/TimeBombPage"));
const LockPage = lazy(() => import("@/components/game/LockPage"));
const MotionChallengePage = lazy(() => import("@/components/game/MotionChallengePage"));
const VotePage = lazy(() => import("@/components/game/VotePage"));

function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          />
        );
      case "shooting_mission":
        return <ShootingMissionPage {...commonProps} />;
      case "photo_mission":
        return <PhotoMissionPage {...commonProps} />;
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

  return (
    <Suspense fallback={<PageLoadingFallback />}>
      {renderPage()}
    </Suspense>
  );
}
