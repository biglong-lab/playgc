// 遊戲頁面渲染器 - 根據 pageType 渲染對應元件
import type { Page } from "@shared/schema";

import TextCardPage from "@/components/game/TextCardPage";
import DialoguePage from "@/components/game/DialoguePage";
import VideoPage from "@/components/game/VideoPage";
import ButtonPage from "@/components/game/ButtonPage";
import TextVerifyPage from "@/components/game/TextVerifyPage";
import ChoiceVerifyPage from "@/components/game/ChoiceVerifyPage";
import ConditionalVerifyPage from "@/components/game/ConditionalVerifyPage";
import ShootingMissionPage from "@/components/game/ShootingMissionPage";
import PhotoMissionPage from "@/components/game/PhotoMissionPage";
import GpsMissionPage from "@/components/game/GpsMissionPage";
import QrScanPage from "@/components/game/QrScanPage";
import TimeBombPage from "@/components/game/TimeBombPage";
import LockPage from "@/components/game/LockPage";
import MotionChallengePage from "@/components/game/MotionChallengePage";
import VotePage from "@/components/game/VotePage";

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
  // 各頁面元件有各自的 config 型別，統一使用 runtime config 傳遞
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = page.config as any;
  const commonProps = {
    config,
    onComplete,
    onVariableUpdate,
    sessionId,
    gameId,
    variables,
  };

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
}
