// 遊戲頁面渲染器 - 根據 pageType 渲染對應元件
// 使用 React.lazy 動態載入，避免 GamePlay chunk 過大
import { lazy, Suspense, useMemo } from "react";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/feedback/PageTransition";
import { PageLocationMiniMap, shouldShowMiniMap } from "@/components/game/PageLocationMiniMap";

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
const PhotoBeforeAfterFlow = lazy(() => import("@/components/game/PhotoBeforeAfterFlow"));
const PhotoBurstFlow = lazy(() => import("@/components/game/PhotoBurstFlow"));
const PhotoArStickerFlow = lazy(() => import("@/components/game/PhotoArStickerFlow"));
const PhotoTeamFlow = lazy(() => import("@/components/game/PhotoTeamFlow"));
const PhotoOcrFlow = lazy(() => import("@/components/game/PhotoOcrFlow"));
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

  // 🎁 統一補完 rewardItems / rewardPoints — 修「道具獎勵發不出來」bug
  //
  // 背景：原本各頁面元件自己處理 rewardItems，導致 8+ 個頁面類型遺漏
  // （TextCard / Dialogue / Video / Button / Vote / TimeBomb / Lock / MotionChallenge）
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
  const wrappedOnComplete = useMemo(() => {
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
  }, [config, onComplete]);

  // 記憶化 commonProps 避免每次渲染都建立新物件
  const commonProps = useMemo(() => ({
    config,
    onComplete: wrappedOnComplete, // 🎁 統一處理 rewardItems
    onVariableUpdate,
    sessionId,
    gameId,
    variables,
  }), [config, wrappedOnComplete, onVariableUpdate, sessionId, gameId, variables]);

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
        return <PhotoTeamFlow {...commonProps} />;
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
  // 適用於 text_card / dialogue / qr_scan / choice_verify / video / vote 等
  // 已內建 GPS 任務（gps_mission）等地圖類型不重複顯示
  const skipMiniMapTypes = new Set([
    "gps_mission",  // 已有自己的地圖
    "photo_spot",   // 已有 GPS 引導
    "flow_router",  // 純路由
  ]);
  const showMiniMap = shouldShowMiniMap(config) && !skipMiniMapTypes.has(page.pageType);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={page.id} variant={variant} className="h-full">
        <Suspense fallback={<PageLoadingFallback />}>
          {showMiniMap && (
            <div className="px-4 pt-4">
              <PageLocationMiniMap settings={config.locationSettings} />
            </div>
          )}
          {renderPage()}
        </Suspense>
      </PageTransition>
    </AnimatePresence>
  );
}
