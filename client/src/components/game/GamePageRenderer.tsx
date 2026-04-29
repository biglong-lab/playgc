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
  // 適用於 text_card / dialogue / choice_verify / vote 等以文字為主的頁面
  //
  // 排除清單：
  //  - 已有自己地圖：gps_mission, photo_spot
  //  - 純路由：flow_router
  //  - 全螢幕互動類（注入 MiniMap 會擠壓核心 UI）：
  //    QR 相機、所有拍照流程、射擊任務、影片播放
  const skipMiniMapTypes = new Set([
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
  const showMiniMap = shouldShowMiniMap(config) && !skipMiniMapTypes.has(page.pageType);

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
        </Suspense>
      </PageTransition>
    </AnimatePresence>
  );
}
