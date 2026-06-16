// 🎬 W22DemoSection — Phase 6 W22 新元件展示（BingoBoard + BlessingWall）
//
// 設計依據：避免動到 971 行的 ShowcaseHub.tsx、抽出獨立 section 元件
// 用途：業務 / 客戶可即時試玩 W22 新加的 2 個 host 元件
//
// 模式：自管 demoMode state + 自渲染 Dialog + 自定義 cards

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BingoBoard, { type BingoTask } from "@/components/game/host/BingoBoard";
import BlessingWall from "@/components/game/host/BlessingWall";
import InteractiveDemo from "@/components/showcase/InteractiveDemo";

type W22Demo =
  | "bingo-host" | "bingo-player"
  | "blessing-host" | "blessing-player"
  | `interactive:${string}`;

const BINGO_DEMO_TASKS: BingoTask[] = [
  { id: "t1", label: "找穿紅衣賓客", emoji: "👗" },
  { id: "t2", label: "與新郎合照", emoji: "🤵" },
  { id: "t3", label: "與新娘合照", emoji: "👰" },
  { id: "t4", label: "拍 5 個 emoji", emoji: "📸" },
  { id: "t5", label: "找小朋友合影", emoji: "👶" },
  { id: "t6", label: "舉杯敬酒", emoji: "🥂" },
  { id: "t7", label: "找穿綠衣賓客", emoji: "🟢" },
  { id: "t8", label: "跟主桌合照", emoji: "🍽️" },
  { id: "t9", label: "找姓林賓客", emoji: "🔍" },
  { id: "t10", label: "拍捧花特寫", emoji: "💐" },
  { id: "t11", label: "找司儀合照", emoji: "🎤" },
  { id: "t12", label: "拍蛋糕特寫", emoji: "🎂" },
  { id: "t13", label: "找台北來的賓客", emoji: "🚄" },
  { id: "t14", label: "與新人父母合照", emoji: "👨‍👩‍👧" },
  { id: "t15", label: "找穿西裝賓客", emoji: "👔" },
  { id: "t16", label: "拍鮮花裝飾", emoji: "🌸" },
  { id: "t17", label: "錄一段祝福", emoji: "🎥" },
  { id: "t18", label: "拍婚紗照展示", emoji: "🖼️" },
  { id: "t19", label: "拍當天車隊", emoji: "🚗" },
  { id: "t20", label: "找朋友合照", emoji: "🫂" },
  { id: "t21", label: "拍彩虹樓拍立得", emoji: "🌈" },
  { id: "t22", label: "找新人國中同學", emoji: "🎓" },
  { id: "t23", label: "與司機合照", emoji: "🚕" },
  { id: "t24", label: "錄花童影片", emoji: "🌷" },
  { id: "t25", label: "拍大合照", emoji: "📷" },
];

const BINGO_DEMO_STATE = {
  completed: { t1: 1, t2: 1, t3: 1, t6: 1, t10: 1, t12: 1, t13: 1, t15: 1 },
  claimedLines: [],
  totalParticipants: 8,
};

const BLESSING_DEMO_STATE = {
  blessings: [
    { id: "b1", name: "明哥", message: "新婚快樂！", emoji: "💕", addedAt: Date.now() },
    { id: "b2", name: "小美", message: "百年好合", emoji: "💝", addedAt: Date.now() - 1000 },
    { id: "b3", name: "Alice", message: "幸福美滿", emoji: "🌟", addedAt: Date.now() - 2000 },
  ],
  recentFlying: [
    { id: "f1", name: "明哥", message: "新婚快樂！", emoji: "💕", x: 30, addedAt: Date.now(), startedAt: Date.now() - 1500 },
    { id: "f2", name: "小美", message: "百年好合", emoji: "💝", x: 60, addedAt: Date.now(), startedAt: Date.now() - 500 },
  ],
};

interface CardProps {
  title: string;
  desc: string;
  highlight: string;
  icon: string;
  hostDemo: W22Demo;
  playerDemo: W22Demo;
  onOpen: (demo: W22Demo) => void;
}

function W22DemoCard({ title, desc, highlight, icon, hostDemo, playerDemo, onOpen }: CardProps) {
  return (
    <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800/40 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-3">
        <div className="text-3xl">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-amber-900 dark:text-amber-100">{title}</h3>
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 font-semibold">W22 NEW</span>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-1">{desc}</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 opacity-80">{highlight}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          onClick={() => onOpen(hostDemo)}
          data-testid={`w22-${hostDemo}-btn`}
          className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
        >
          📺 大螢幕版
        </button>
        <button
          onClick={() => onOpen(playerDemo)}
          data-testid={`w22-${playerDemo}-btn`}
          className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition-colors"
        >
          📱 玩家手機版
        </button>
      </div>
    </div>
  );
}

export default function W22DemoSection() {
  const [demoMode, setDemoMode] = useState<W22Demo | null>(null);
  const isHost = demoMode?.endsWith("-host");

  return (
    <section className="space-y-4 my-12">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-display font-bold">
          ✨ Phase 6 W22 — 2 個全新元件即時試玩
        </h2>
        <p className="text-sm text-muted-foreground">
          BingoBoard 5 大市場通用集章板 + BlessingWall 交誼類祝福瀑布牆
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
        <W22DemoCard
          title="🎯 Bingo 集章板"
          desc="BingoBoard — 5×5 任務板、12 條連線判定"
          highlight="園遊會 + 商圈集章 + 員工旅遊 + 婚禮 Bingo"
          icon="🎯"
          hostDemo="bingo-host"
          playerDemo="bingo-player"
          onOpen={setDemoMode}
        />
        <W22DemoCard
          title="💝 祝福瀑布牆"
          desc="BlessingWall — 訊息漂浮 8s、5 種主題色系"
          highlight="婚禮 + 生日 + 同學會 + 頒獎主視覺"
          icon="💝"
          hostDemo="blessing-host"
          playerDemo="blessing-player"
          onOpen={setDemoMode}
        />
      </div>

      <p className="text-xs text-center text-muted-foreground">
        （Demo 模式靜態預覽 — 真實活動由 admin 建 host session 後產生網址、賓客互動會即時更新）
      </p>

      <Dialog open={demoMode !== null} onOpenChange={(open) => !open && setDemoMode(null)}>
        <DialogContent
          className={isHost ? "max-w-5xl h-[80vh] p-0 overflow-hidden" : "max-w-md p-0 max-h-[80vh] overflow-y-auto"}
        >
          <DialogHeader className={isHost ? "px-6 py-3 bg-zinc-900 text-white" : "p-4"}>
            <DialogTitle>
              {isHost ? "📺 大螢幕版型 (Demo)" : "📱 玩家手機版型 (Demo)"}
            </DialogTitle>
          </DialogHeader>
          <div className={isHost ? "flex-1 overflow-y-auto" : "overflow-y-auto"}>
            {demoMode === "bingo-host" && (
              <BingoBoard
                config={{
                  title: "💍 王小明 & 林小美的婚禮 Bingo",
                  subtitle: "找賓客、合照、互動 — 集滿連線換獎",
                  tasks: BINGO_DEMO_TASKS,
                }}
                hostMode={true}
                state={BINGO_DEMO_STATE}
              />
            )}
            {demoMode === "bingo-player" && (
              <BingoBoard
                config={{
                  title: "🎯 完成任務集章",
                  subtitle: "點擊已完成的任務",
                  tasks: BINGO_DEMO_TASKS.slice(0, 8),
                }}
                hostMode={false}
                state={BINGO_DEMO_STATE}
              />
            )}
            {demoMode === "blessing-host" && (
              <BlessingWall
                config={{
                  title: "💝 給新人的祝福牆",
                  subtitle: "賓客留言即時飛上螢幕",
                  theme: "wedding",
                }}
                hostMode={true}
                state={BLESSING_DEMO_STATE}
              />
            )}
            {demoMode === "blessing-player" && (
              <BlessingWall
                config={{
                  title: "💝 留下你的祝福",
                  subtitle: "訊息會出現在大螢幕上",
                  theme: "wedding",
                }}
                hostMode={false}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
