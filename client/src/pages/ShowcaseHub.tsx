// 🎬 ShowcaseHub — 元件展示館（W1 D5 MVP）
//
// 路徑：/showcase（公開，無需登入）
// 用途：銷售工具、業務簡報、讓客戶看到「組合就能變成各種玩法」
//
// 設計依據：docs/changes/2026-05-02-multiplayer-component-platform.md B1
//
// 後續迭代：
//   - W2: 加 PollLive demo 試玩
//   - Phase 2: 12 情境模板入口
//   - Phase 3: 30 秒 demo 影片整合

import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PollLive from "@/components/game/host/PollLive";
import EmojiReact from "@/components/game/host/EmojiReact";
import WaveResponse from "@/components/game/host/WaveResponse";
import CrowdGather from "@/components/game/host/CrowdGather";
import LiveLeaderboard from "@/components/game/host/LiveLeaderboard";
import JigsawPuzzle from "@/components/game/multi/JigsawPuzzle";
import TreasureHunt from "@/components/game/multi/TreasureHunt";
import GpsCascade from "@/components/game/multi/GpsCascade";
import CollectiveScore from "@/components/game/multi/CollectiveScore";
import RoleAssign from "@/components/game/multi/RoleAssign";
import {
  ArrowLeft, Tv, Users, User as UserIcon, Sparkles,
  Vote, Camera, MapPin, Trophy, Flame, Lock,
  Smartphone, Image as ImageIcon, Award, Briefcase, Heart,
  GraduationCap, Building2, PartyPopper,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════
// 元件清單（依軸線分類）
// ════════════════════════════════════════════════════════════════════

interface ComponentItem {
  name: string;
  zhName: string;
  desc: string;
  status: "live" | "planned" | "scaffold";
  axis: "shared" | "solo" | "multi" | "host";
}

const COMPONENTS: ComponentItem[] = [
  // 第三軸線 host（規劃 8 個）
  { name: "PollLive", zhName: "即時民調", desc: "全場投票，大螢幕長條圖動態", status: "live", axis: "host" },
  { name: "EmojiReact", zhName: "情緒池", desc: "全場 emoji 雨，演講即時回饋", status: "live", axis: "host" },
  { name: "WaveResponse", zhName: "人浪應援", desc: "連點按鈕觸發場域熱力", status: "live", axis: "host" },
  { name: "TriviaShowdown", zhName: "搶答秀", desc: "園遊會主舞台、多回合排行", status: "planned", axis: "host" },
  { name: "LiveLeaderboard", zhName: "即時排行", desc: "活動全程動態排行投影", status: "live", axis: "host" },
  { name: "CrowdGather", zhName: "聚眾任務", desc: "簽到打卡達標解鎖", status: "live", axis: "host" },
  { name: "ScoreboardAnnouncement", zhName: "跑馬燈宣告", desc: "比賽插播得分", status: "planned", axis: "host" },
  { name: "KnowledgeMap", zhName: "知識地圖", desc: "場域全景 + 進度視覺化", status: "planned", axis: "host" },

  // 第二軸線 multi（已 8 個 + 規劃 5 個）
  { name: "PhotoTeam", zhName: "團體合影", desc: "九宮格自動合成", status: "live", axis: "multi" },
  { name: "VoteTeam", zhName: "隊伍投票", desc: "majority/unanimous/display", status: "live", axis: "multi" },
  { name: "ShootingTeam", zhName: "隊伍射擊", desc: "MQTT 硬體靶機累計分", status: "live", axis: "multi" },
  { name: "GpsTeamMission", zhName: "GPS 隊伍任務", desc: "any/all 觸發模式", status: "live", axis: "multi" },
  { name: "LockCoop", zhName: "協作解鎖", desc: "不對稱線索分配", status: "live", axis: "multi" },
  { name: "ChoiceVerifyRace", zhName: "選擇題搶答", desc: "server 權威時間", status: "live", axis: "multi" },
  { name: "RelayMission", zhName: "接力任務", desc: "段落穩定分配", status: "live", axis: "multi" },
  { name: "TerritoryCapture", zhName: "地盤戰", desc: "多隊爭奪 GPS 點", status: "live", axis: "multi" },
  { name: "JigsawPuzzle", zhName: "拼圖協作", desc: "拍照拼圖（破冰王牌）", status: "live", axis: "multi" },
  { name: "TreasureHunt", zhName: "藏寶圖", desc: "線索拼密碼", status: "live", axis: "multi" },
  { name: "GpsCascade", zhName: "GPS 連鎖解鎖", desc: "依序連動", status: "live", axis: "multi" },
  { name: "CollectiveScore", zhName: "全體累計分", desc: "達標才贏", status: "live", axis: "multi" },
  { name: "RoleAssign", zhName: "角色分派", desc: "隊伍隨機指派角色", status: "live", axis: "multi" },

  // 第一軸線 solo（已 18 個）— 摘要列幾個代表
  { name: "PhotoMission", zhName: "拍照任務", desc: "AI 驗證指定物", status: "live", axis: "solo" },
  { name: "PhotoArSticker", zhName: "AR 貼紙", desc: "Cloudinary AR 整合", status: "live", axis: "solo" },
  { name: "GpsMission", zhName: "GPS 任務", desc: "個人定點打卡", status: "live", axis: "solo" },
  { name: "QrScan", zhName: "QR 掃描", desc: "場域 QR 解鎖", status: "live", axis: "solo" },
  { name: "ShootingMission", zhName: "個人射擊", desc: "硬體靶機", status: "live", axis: "solo" },
  { name: "ChoiceVerify", zhName: "選擇題", desc: "知識答題", status: "live", axis: "solo" },
  { name: "TextVerify", zhName: "文字答題", desc: "AI 比對", status: "live", axis: "solo" },
  { name: "Lock", zhName: "密碼解鎖", desc: "個人解謎", status: "live", axis: "solo" },
  { name: "TimeBomb", zhName: "拆彈", desc: "限時挑戰", status: "live", axis: "solo" },
  { name: "MotionChallenge", zhName: "搖手機挑戰", desc: "感應器計數", status: "live", axis: "solo" },

  // shared（4 個）
  { name: "TextCard", zhName: "文字卡", desc: "劇情/提示/過場", status: "live", axis: "shared" },
  { name: "Dialogue", zhName: "NPC 對話", desc: "角色對話", status: "live", axis: "shared" },
  { name: "Video", zhName: "影片播放", desc: "場域素材", status: "live", axis: "shared" },
  { name: "FlowRouter", zhName: "流程路由", desc: "純邏輯分支", status: "live", axis: "shared" },
];

// ════════════════════════════════════════════════════════════════════
// 商業情境（5 大市場）
// ════════════════════════════════════════════════════════════════════

interface Scenario {
  id: string;
  title: string;
  market: string;
  desc: string;
  components: string[];  // 代表元件
  icon: typeof Briefcase;
  color: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "public",
    title: "公部門｜街區商圈活化",
    market: "景點串聯、空間故事化",
    desc: "靜態景點 → 玩家來互動、留紀念、自動分享",
    components: ["GpsCascade", "TreasureHunt", "PhotoStorytelling", "KnowledgeMap"],
    icon: Building2,
    color: "from-emerald-500/20 to-teal-500/20",
  },
  {
    id: "corporate",
    title: "私部門｜企業團建",
    market: "內訓、員工旅遊、團隊互動",
    desc: "破冰、競賽、角色扮演、活動報告",
    components: ["TriviaShowdown", "RoleAssign", "JigsawPuzzle", "CompanyReport"],
    icon: Briefcase,
    color: "from-blue-500/20 to-indigo-500/20",
  },
  {
    id: "event",
    title: "活動｜園遊會 / 破冰 / 熱場",
    market: "群體互動、即時氛圍、大螢幕投影",
    desc: "全場投票答題、emoji 池、即時排行，場域氣氛瞬間引爆",
    components: ["PollLive", "TriviaShowdown", "EmojiReact", "LiveLeaderboard"],
    icon: PartyPopper,
    color: "from-orange-500/20 to-red-500/20",
  },
  {
    id: "wedding",
    title: "交誼｜婚禮 / 派對 / 聚會",
    market: "紀念製造、情感連結",
    desc: "破冰、合照、自動剪 highlight 影片",
    components: ["EmojiReact", "PolaroidCollage", "GuestbookDigital", "VideoMontage"],
    icon: Heart,
    color: "from-rose-500/20 to-pink-500/20",
  },
  {
    id: "edu",
    title: "教育｜校外教學 / 班際競賽",
    market: "分組學習、競賽機制",
    desc: "老師後台、知識搶答、成果報告",
    components: ["ChoiceVerifyRace", "TeacherConsole", "GroupReport", "RelayMission"],
    icon: GraduationCap,
    color: "from-purple-500/20 to-fuchsia-500/20",
  },
];

// ════════════════════════════════════════════════════════════════════
// UI
// ════════════════════════════════════════════════════════════════════

function getStatusBadge(status: ComponentItem["status"]) {
  const map = {
    live: { label: "已上線", variant: "default" as const, color: "bg-emerald-500" },
    planned: { label: "規劃中", variant: "outline" as const, color: "" },
    scaffold: { label: "骨架", variant: "secondary" as const, color: "" },
  };
  return map[status];
}

function getAxisIcon(axis: ComponentItem["axis"]) {
  switch (axis) {
    case "host": return Tv;
    case "multi": return Users;
    case "solo": return UserIcon;
    case "shared": return Sparkles;
  }
}

function getAxisLabel(axis: ComponentItem["axis"]) {
  switch (axis) {
    case "host": return "📺 主控大螢幕";
    case "multi": return "👥 隊伍協作";
    case "solo": return "🎯 個人挑戰";
    case "shared": return "✨ 通用";
  }
}

// PollLive demo 模擬資料（給 ShowcaseHub 預覽用，無 WS）
const POLLLIVE_DEMO_CONFIG = {
  question: "你最喜歡金門哪個古蹟？",
  subtitle: "（PollLive 即時民調 — Demo 模式）",
  options: [
    { id: "a", label: "後浦老街" },
    { id: "b", label: "賈村牌坊" },
    { id: "c", label: "古寧頭戰史館" },
    { id: "d", label: "莒光樓" },
  ],
};

const POLLLIVE_DEMO_HOST_STATE = {
  question: POLLLIVE_DEMO_CONFIG.question,
  options: POLLLIVE_DEMO_CONFIG.options,
  votes: { a: 47, b: 32, c: 51, d: 18 },
  totalVotes: 148,
  status: "open" as const,
  revealResults: false,
};

const POLLLIVE_DEMO_PLAYER_STATE = {
  question: POLLLIVE_DEMO_CONFIG.question,
  options: POLLLIVE_DEMO_CONFIG.options,
  votes: { a: 47, b: 32, c: 51, d: 18 },
  totalVotes: 148,
  status: "revealed" as const,
  revealResults: true,
};

// 5 個 host 元件 + 5 個 multi 元件 demo 預覽配置
type HostDemo =
  | "poll-host" | "poll-player"
  | "emoji-host" | "emoji-player"
  | "wave-host" | "wave-player"
  | "crowd-host" | "crowd-player"
  | "leaderboard-host" | "leaderboard-player"
  | "jigsaw" | "treasure" | "gps-cascade" | "collective" | "role-assign";

export default function ShowcaseHub() {
  const liveCount = COMPONENTS.filter((c) => c.status === "live").length;
  const plannedCount = COMPONENTS.filter((c) => c.status === "planned").length;
  const [demoMode, setDemoMode] = useState<HostDemo | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b safe-top">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="p-2 hover:bg-muted rounded-lg" data-testid="btn-back-home">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="font-display font-bold text-lg">🎬 元件展示館</h1>
              <p className="text-xs text-muted-foreground">
                {liveCount} 個已上線 · {plannedCount} 個規劃中 · 持續擴增
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-12">
        {/* Hero */}
        <section className="text-center space-y-4 py-8">
          <h2 className="text-3xl md:text-5xl font-display font-bold">
            讓每一個場域，都變成<span className="text-primary">遊樂場</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            從個人闖關到大螢幕主控，從隊伍協作到全場互動 — 一個平台、無限想像
          </p>
        </section>

        {/* 🎬 5 個 host 元件即時試玩（W3 D5 擴充）*/}
        <section className="space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-display font-bold">📺 立即看 — HostScreen 5 元件</h2>
            <p className="text-sm text-muted-foreground">
              主控大螢幕投影 + 玩家手機互動 — 適合園遊會、企業內訓、課堂互動、開幕熱場、競賽結算
            </p>
          </div>

          {/* 5 個元件對照卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { id: "poll", title: "📊 即時民調", desc: "PollLive — 全場投票 + 長條圖", host: "poll-host", player: "poll-player" },
              { id: "emoji", title: "🎉 情緒池", desc: "EmojiReact — emoji 雨 + 計數", host: "emoji-host", player: "emoji-player" },
              { id: "wave", title: "📣 人浪應援", desc: "WaveResponse — 強度脈動", host: "wave-host", player: "wave-player" },
              { id: "crowd", title: "👥 聚眾達標", desc: "CrowdGather — 簽到熱場", host: "crowd-host", player: "crowd-player" },
              { id: "leaderboard", title: "🏆 即時排行", desc: "LiveLeaderboard — Top 10 競賽榜", host: "leaderboard-host", player: "leaderboard-player" },
            ].map((item) => (
              <Card key={item.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setDemoMode(item.host as HostDemo)}
                      size="sm"
                      className="flex-1"
                      data-testid={`btn-demo-${item.id}-host`}
                    >
                      📺 大螢幕
                    </Button>
                    <Button
                      onClick={() => setDemoMode(item.player as HostDemo)}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      data-testid={`btn-demo-${item.id}-player`}
                    >
                      📱 玩家
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            （Demo 模式靜態預覽 — 真實活動由 admin 建 host session 後產生網址、玩家投票會即時更新）
          </p>
        </section>

        {/* 🎬 5 個 multi 元件 demo（W4 D4 新增）*/}
        <section className="space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-display font-bold">👥 立即看 — Multi 隊伍協作 5 元件</h2>
            <p className="text-sm text-muted-foreground">
              玩家分頭協作完成任務 — 適合親子家庭、企業團建、景點探秘、劇本殺
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { id: "jigsaw", title: "🧩 拼圖協作", desc: "JigsawPuzzle — 親子家庭王牌", demo: "jigsaw" },
              { id: "treasure", title: "💎 藏寶尋找", desc: "TreasureHunt — 線索拼密碼", demo: "treasure" },
              { id: "gps-cascade", title: "🗺 連鎖探索", desc: "GpsCascade — 強制動線", demo: "gps-cascade" },
              { id: "collective", title: "🎯 合作達標", desc: "CollectiveScore — 班際積分", demo: "collective" },
              { id: "role-assign", title: "🎭 角色分派", desc: "RoleAssign — 劇本殺王牌", demo: "role-assign" },
            ].map((item) => (
              <Card key={item.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <Button
                    onClick={() => setDemoMode(item.demo as HostDemo)}
                    size="sm"
                    className="w-full"
                    data-testid={`btn-demo-${item.id}`}
                  >
                    📱 看玩家版型
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            （Multi 元件玩家共同操作 — Demo 用本地 state 模擬、真實活動 WS 同步）
          </p>
        </section>

        {/* Demo Dialog（依 demoMode 渲染對應元件）*/}
        <Dialog open={demoMode !== null} onOpenChange={(open) => !open && setDemoMode(null)}>
          <DialogContent
            className={
              demoMode?.endsWith("-host")
                ? "max-w-5xl h-[80vh] p-0 bg-black overflow-hidden"
                : "max-w-md p-0 max-h-[80vh] overflow-y-auto"
            }
          >
            <DialogHeader
              className={demoMode?.endsWith("-host") ? "px-6 py-3 bg-zinc-900 text-white" : "p-4"}
            >
              <DialogTitle>
                {demoMode?.endsWith("-host") ? "📺 大螢幕版型 (Demo)" : "📱 玩家手機版型 (Demo)"}
              </DialogTitle>
            </DialogHeader>
            <div className={demoMode?.endsWith("-host") ? "flex-1 overflow-y-auto" : "overflow-y-auto"}>
              {demoMode === "poll-host" && (
                <PollLive config={POLLLIVE_DEMO_CONFIG} hostMode={true} state={POLLLIVE_DEMO_HOST_STATE} />
              )}
              {demoMode === "poll-player" && (
                <PollLive config={POLLLIVE_DEMO_CONFIG} hostMode={false} state={POLLLIVE_DEMO_PLAYER_STATE} />
              )}
              {demoMode === "emoji-host" && (
                <EmojiReact
                  config={{ title: "演講互動", subtitle: "點 emoji 表達感受" }}
                  hostMode={true}
                  state={{
                    counts: { "❤️": 47, "👍": 89, "🎉": 31, "🔥": 22, "😍": 18, "👏": 65, "😂": 14, "🙌": 9 },
                    totalReacts: 295,
                    recentFlying: [],
                  }}
                />
              )}
              {demoMode === "emoji-player" && <EmojiReact config={{}} hostMode={false} />}
              {demoMode === "wave-host" && (
                <WaveResponse
                  config={{ title: "全場應援", subtitle: "GO! GO! GO!" }}
                  hostMode={true}
                  state={{ totalTaps: 1248, bucketBySec: { [Math.floor(Date.now() / 1000)]: 12 } }}
                />
              )}
              {demoMode === "wave-player" && (
                <WaveResponse
                  config={{ title: "為主隊加油！", buttonLabel: "GO!" }}
                  hostMode={false}
                />
              )}
              {demoMode === "crowd-host" && (
                <CrowdGather
                  config={{ title: "歡迎加入活動", targetCount: 30, celebrationText: "🎉 全員到齊！" }}
                  hostMode={true}
                  state={{
                    registered: [
                      { name: "阿鬨", ts: Date.now() - 5000 },
                      { name: "Alice", ts: Date.now() - 4000 },
                      { name: "Bob", ts: Date.now() - 3000 },
                      { name: "小明", ts: Date.now() - 2000 },
                    ],
                    totalCount: 18,
                    isReached: false,
                  }}
                />
              )}
              {demoMode === "crowd-player" && (
                <CrowdGather
                  config={{ title: "我來了！", targetCount: 30 }}
                  hostMode={false}
                  state={{ registered: [], totalCount: 18, isReached: false }}
                />
              )}
              {demoMode === "leaderboard-host" && (
                <LiveLeaderboard
                  config={{ title: "🏆 競賽排行榜", subtitle: "本場結算" }}
                  hostMode={true}
                  state={{
                    entries: [
                      { id: "1", name: "後浦小隊", score: 1280 },
                      { id: "2", name: "賈村英雄", score: 1145 },
                      { id: "3", name: "古寧連線", score: 980 },
                      { id: "4", name: "莒光戰隊", score: 875 },
                      { id: "5", name: "金門勇者", score: 720 },
                    ],
                    lastUpdated: Date.now(),
                  }}
                />
              )}
              {demoMode === "leaderboard-player" && (
                <LiveLeaderboard
                  config={{ topN: 10 }}
                  hostMode={false}
                  myId="2"
                  state={{
                    entries: [
                      { id: "1", name: "後浦小隊", score: 1280 },
                      { id: "2", name: "賈村英雄", score: 1145 },
                      { id: "3", name: "古寧連線", score: 980 },
                      { id: "4", name: "莒光戰隊", score: 875 },
                      { id: "5", name: "金門勇者", score: 720 },
                    ],
                  }}
                />
              )}

              {/* Multi 元件 demos */}
              {demoMode === "jigsaw" && (
                <JigsawPuzzle
                  config={{ title: "金門景點拼圖", rows: 2, cols: 2, prompts: ["紅磚牆", "白色廟宇", "綠色稻田", "藍色海岸"] }}
                  state={{
                    slots: [
                      { id: "r0c0", row: 0, col: 0, prompt: "紅磚牆", filledBy: "Alice", text: "紅色古厝", color: "#ef4444" },
                      { id: "r0c1", row: 0, col: 1, prompt: "白色廟宇", filledBy: "Bob", text: "城隍廟", color: "#f9fafb" },
                      { id: "r1c0", row: 1, col: 0, prompt: "綠色稻田", filledBy: "Carol", text: "稻浪", color: "#10b981" },
                      { id: "r1c1", row: 1, col: 1, prompt: "藍色海岸", filledBy: "Dave", text: "夕陽海景", color: "#3b82f6" },
                    ],
                    isComplete: true,
                  }}
                  myUserId="me"
                  myUserName="我"
                  onFillSlot={() => {}}
                />
              )}
              {demoMode === "treasure" && (
                <TreasureHunt
                  config={{
                    title: "金門尋寶",
                    finalReward: "🏆 800",
                    clues: [
                      { id: "c1", prompt: "金門最大紀念日？", answer: "823砲戰", reward: "8" },
                      { id: "c2", prompt: "金門特產之一（飲品）？", answer: "高粱酒", reward: "0" },
                      { id: "c3", prompt: "金門地標建築？", answer: "莒光樓", reward: "0" },
                    ],
                  }}
                  state={{ unlockedClueIds: ["c1"] }}
                  onUnlockClue={() => {}}
                />
              )}
              {demoMode === "gps-cascade" && (
                <GpsCascade
                  config={{
                    title: "金門古蹟巡禮",
                    points: [
                      { id: "p1", name: "後浦老街", hint: "找入口的牌樓", story: "後浦是金門最早的商業聚落。" },
                      { id: "p2", name: "賈村牌坊", hint: "從後浦往南 200m" },
                      { id: "p3", name: "莒光樓", hint: "南方海岸地標" },
                    ],
                  }}
                  state={{ reachedPointIds: ["p1"] }}
                  onReachPoint={() => {}}
                />
              )}
              {demoMode === "collective" && (
                <CollectiveScore
                  config={{
                    title: "🎯 班際合作達標",
                    targetScore: 1000,
                  }}
                  state={{
                    totalScore: 720,
                    contributors: [
                      { name: "Alice", total: 320 },
                      { name: "Bob", total: 250 },
                      { name: "Carol", total: 150 },
                    ],
                    isReached: false,
                  }}
                  myUserName="Bob"
                  onContribute={() => {}}
                />
              )}
              {demoMode === "role-assign" && (
                <RoleAssign
                  config={{
                    title: "🎭 推理之夜",
                    subtitle: "你扮演誰？",
                    roles: [
                      {
                        id: "detective",
                        name: "偵探",
                        emoji: "🕵️",
                        description: "你是案件的偵探。\n仔細聽嫌犯與證人的描述，找出真相。",
                        color: "#3b82f6",
                      },
                      {
                        id: "suspect",
                        name: "嫌犯",
                        emoji: "🎭",
                        description: "你被懷疑了！\n但你是無辜的（也可能不是）。",
                        color: "#ef4444",
                        isSecret: true,
                      },
                      {
                        id: "witness",
                        name: "證人",
                        emoji: "👁",
                        description: "你看到事發經過。\n誠實回答偵探的問題。",
                        color: "#10b981",
                      },
                    ],
                  }}
                  state={{ assignments: { 我: "detective" } }}
                  myUserName="我"
                  onAssign={() => {}}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* 5 大商業情境 */}
        <section className="space-y-4">
          <h2 className="text-xl font-display font-bold">💼 5 大商業情境</h2>
          <p className="text-sm text-muted-foreground">
            元件不是工具，是「情境武器」 — 看到就知道能用在哪
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SCENARIOS.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.id} className={`bg-gradient-to-br ${s.color} border-0`}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/30 dark:bg-black/30 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold">{s.title}</h3>
                        <p className="text-xs opacity-80">{s.market}</p>
                      </div>
                    </div>
                    <p className="text-sm">{s.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.components.map((c) => (
                        <Badge key={c} variant="outline" className="bg-white/40 dark:bg-black/40 border-0 text-xs">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* 元件武器庫（依軸線分類）*/}
        {(["host", "multi", "solo", "shared"] as const).map((axis) => {
          const items = COMPONENTS.filter((c) => c.axis === axis);
          if (items.length === 0) return null;
          const Icon = getAxisIcon(axis);
          return (
            <section key={axis} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-display font-bold">{getAxisLabel(axis)}</h2>
                <Badge variant="outline">{items.length} 個</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((item) => {
                  const status = getStatusBadge(item.status);
                  return (
                    <Card key={item.name} className="hover:border-primary/40 transition-colors">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">{item.zhName}</h3>
                            <p className="text-xs text-muted-foreground font-mono">{item.name}</p>
                          </div>
                          <Badge variant={status.variant} className="shrink-0 text-xs">
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* 路徑說明 */}
        <section className="space-y-4 py-8 border-t">
          <h2 className="text-xl font-display font-bold">🚀 12 週路徑</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <Badge>Phase 1（W1-4）</Badge>
                <h3 className="font-semibold">基礎拓寬</h3>
                <p className="text-xs text-muted-foreground">
                  HostScreen 軸線首發 + 公私部門補強，13 個元件上線
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <Badge variant="outline">Phase 2（W5-8）</Badge>
                <h3 className="font-semibold">情境制成</h3>
                <p className="text-xs text-muted-foreground">
                  紀念類 / 接力類 + 12 個情境模板，啟動商業變現
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <Badge variant="outline">Phase 3（W9-12）</Badge>
                <h3 className="font-semibold">自助平台</h3>
                <p className="text-xs text-muted-foreground">
                  GameWizard + 客戶自助後台，SaaS 訂閱啟動
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 立即試用 */}
        <section className="bg-primary/5 rounded-2xl p-8 text-center space-y-4">
          <h2 className="text-2xl font-display font-bold">想要打造你的活動？</h2>
          <p className="text-sm text-muted-foreground">
            場域訂閱、單場活動、客製方案都可以 — 直接從這裡開始
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/admin/login">
              <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
                場域管理員登入
              </button>
            </Link>
            <Link href="/apply">
              <button className="px-6 py-3 border rounded-lg font-medium hover:bg-muted">
                申請新場域
              </button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        ADR-0004 · HostScreen 第三軸線 · 文件機制 v1.0
      </footer>
    </div>
  );
}
