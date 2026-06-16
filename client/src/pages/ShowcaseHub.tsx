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
import W22DemoSection from "@/components/showcase/W22DemoSection";
import InteractiveDemo, { INTERACTIVE_DEMOS } from "@/components/showcase/InteractiveDemo";
import PollLive from "@/components/game/host/PollLive";
import EmojiReact from "@/components/game/host/EmojiReact";
import WaveResponse from "@/components/game/host/WaveResponse";
import CrowdGather from "@/components/game/host/CrowdGather";
import LiveLeaderboard from "@/components/game/host/LiveLeaderboard";
import PolaroidCollage from "@/components/game/host/PolaroidCollage";
import GuestbookDigital from "@/components/game/host/GuestbookDigital";
import TriviaShowdown from "@/components/game/host/TriviaShowdown";
import ScoreboardAnnouncement from "@/components/game/host/ScoreboardAnnouncement";
import KnowledgeMap from "@/components/game/host/KnowledgeMap";
import JigsawPuzzle from "@/components/game/multi/JigsawPuzzle";
import TreasureHunt from "@/components/game/multi/TreasureHunt";
import GpsCascade from "@/components/game/multi/GpsCascade";
import CollectiveScore from "@/components/game/multi/CollectiveScore";
import RoleAssign from "@/components/game/multi/RoleAssign";
import {
  ArrowLeft, Tv, Users, User as UserIcon, Sparkles,
  Vote, Camera, MapPin, Trophy, Flame, Lock,
  Smartphone, Image as ImageIcon, Award, Briefcase, Heart,
  GraduationCap, Building2, PartyPopper, ArrowRight,
} from "lucide-react";
import { getScenariosForPageType } from "@shared/scenario-templates";

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
  { name: "TriviaShowdown", zhName: "搶答秀", desc: "園遊會主舞台、多回合排行", status: "live", axis: "host" },
  { name: "LiveLeaderboard", zhName: "即時排行", desc: "活動全程動態排行投影", status: "live", axis: "host" },
  { name: "CrowdGather", zhName: "聚眾任務", desc: "簽到打卡達標解鎖", status: "live", axis: "host" },
  { name: "ScoreboardAnnouncement", zhName: "跑馬燈宣告", desc: "比賽插播得分", status: "live", axis: "host" },
  { name: "KnowledgeMap", zhName: "知識地圖", desc: "場域全景 + 進度視覺化", status: "live", axis: "host" },
  { name: "PolaroidCollage", zhName: "拍立得紀念牆", desc: "婚禮王牌 + 旋轉拍立得", status: "live", axis: "host" },
  { name: "GuestbookDigital", zhName: "數位簽名簿", desc: "婚禮配套 + 退休歡送", status: "live", axis: "host" },

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

// host 元件 + multi 元件 demo 預覽配置
type HostDemo =
  | "poll-host" | "poll-player"
  | "emoji-host" | "emoji-player"
  | "wave-host" | "wave-player"
  | "crowd-host" | "crowd-player"
  | "leaderboard-host" | "leaderboard-player"
  | "polaroid-host" | "polaroid-player"
  | "guestbook-host" | "guestbook-player"
  | "trivia-host" | "trivia-player"
  | "scoreboard-host" | "scoreboard-player"
  | "knowledgemap-host" | "knowledgemap-player"
  | "jigsaw" | "treasure" | "gps-cascade" | "collective" | "role-assign"
  | `interactive:${string}`;

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

        {/* ✨ Phase 6 W22 新增 2 元件（最新、置頂呈現）*/}
        <W22DemoSection />

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
              { id: "poll", title: "📊 即時民調", desc: "PollLive — 全場投票 + 長條圖", host: "poll-host", player: "poll-player", pageType: "host_poll_live" },
              { id: "emoji", title: "🎉 情緒池", desc: "EmojiReact — emoji 雨 + 計數", host: "emoji-host", player: "emoji-player", pageType: "host_emoji_react" },
              { id: "wave", title: "📣 人浪應援", desc: "WaveResponse — 強度脈動", host: "wave-host", player: "wave-player", pageType: "host_wave_response" },
              { id: "crowd", title: "👥 聚眾達標", desc: "CrowdGather — 簽到熱場", host: "crowd-host", player: "crowd-player", pageType: "host_crowd_gather" },
              { id: "leaderboard", title: "🏆 即時排行", desc: "LiveLeaderboard — Top 10 競賽榜", host: "leaderboard-host", player: "leaderboard-player", pageType: "host_live_leaderboard" },
            ].map((item) => (
              <DemoCard
                key={item.id}
                item={item}
                onDemoOpen={(demo) => setDemoMode(demo as HostDemo)}
                hasBoth
              />
            ))}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            （Demo 模式靜態預覽 — 真實活動由 admin 建 host session 後產生網址、玩家投票會即時更新）
          </p>
        </section>

        {/* 🎬 W5 紀念類 + 競賽類 5 元件即時試玩（W5 D5 擴充）*/}
        <section className="space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-display font-bold">📺 立即看 — Phase 2 W5 紀念與競賽 5 元件</h2>
            <p className="text-sm text-muted-foreground">
              拍立得牆、簽名簿、搶答、跑馬燈、場域地圖 — 適合婚禮、退休歡送、園遊會主舞台、街區商圈
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { id: "polaroid", title: "📸 拍立得紀念牆", desc: "PolaroidCollage — 婚禮王牌", host: "polaroid-host", player: "polaroid-player", pageType: "host_polaroid_collage" },
              { id: "guestbook", title: "✍️ 數位簽名簿", desc: "GuestbookDigital — 婚禮 / 退休", host: "guestbook-host", player: "guestbook-player", pageType: "host_guestbook_digital" },
              { id: "trivia", title: "🎯 搶答秀", desc: "TriviaShowdown — 園遊會主舞台", host: "trivia-host", player: "trivia-player", pageType: "host_trivia_showdown" },
              { id: "scoreboard", title: "📣 跑馬燈宣告", desc: "ScoreboardAnnouncement — 賽事播報", host: "scoreboard-host", player: "scoreboard-player", pageType: "host_scoreboard_announcement" },
              { id: "knowledgemap", title: "🗺️ 場域全景地圖", desc: "KnowledgeMap — 街區商圈打卡", host: "knowledgemap-host", player: "knowledgemap-player", pageType: "host_knowledge_map" },
            ].map((item) => (
              <DemoCard
                key={item.id}
                item={item}
                onDemoOpen={(demo) => setDemoMode(demo as HostDemo)}
                hasBoth
              />
            ))}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            （HostScreen 軸線 10/10 元件全部就位 — Phase 2 W5 收尾、進入 W6 情境模板）
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
              { id: "jigsaw", title: "🧩 拼圖協作", desc: "JigsawPuzzle — 親子家庭王牌", demo: "jigsaw", pageType: "jigsaw_puzzle" },
              { id: "treasure", title: "💎 藏寶尋找", desc: "TreasureHunt — 線索拼密碼", demo: "treasure", pageType: "treasure_hunt" },
              { id: "gps-cascade", title: "🗺 連鎖探索", desc: "GpsCascade — 強制動線", demo: "gps-cascade", pageType: "gps_cascade" },
              { id: "collective", title: "🎯 合作達標", desc: "CollectiveScore — 班際積分", demo: "collective", pageType: "collective_score" },
              { id: "role-assign", title: "🎭 角色分派", desc: "RoleAssign — 劇本殺王牌", demo: "role-assign", pageType: "role_assign" },
            ].map((item) => (
              <DemoCard
                key={item.id}
                item={{ ...item, host: item.demo, player: item.demo }}
                onDemoOpen={(demo) => setDemoMode(demo as HostDemo)}
                hasBoth={false}
              />
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
              demoMode?.startsWith("interactive:")
                ? "max-w-5xl h-[90vh] md:h-[85vh] p-0 bg-zinc-900 overflow-hidden"
                : demoMode?.endsWith("-host")
                ? "max-w-5xl h-[80vh] p-0 bg-black overflow-hidden"
                : "max-w-md p-0 max-h-[80vh] overflow-y-auto"
            }
          >
            <DialogHeader
              className={
                demoMode?.startsWith("interactive:") || demoMode?.endsWith("-host")
                  ? "px-6 py-3 bg-zinc-900 text-white"
                  : "p-4"
              }
            >
              <DialogTitle>
                {demoMode?.startsWith("interactive:")
                  ? "🎮 互動試玩 — 大螢幕 + 手機（點手機看大螢幕反應）"
                  : demoMode?.endsWith("-host")
                  ? "📺 大螢幕版型 (Demo)"
                  : "📱 玩家手機版型 (Demo)"}
              </DialogTitle>
            </DialogHeader>
            <div
              className={
                demoMode?.startsWith("interactive:")
                  ? "flex-1 overflow-y-auto"
                  : demoMode?.endsWith("-host")
                  ? "flex-1 overflow-y-auto"
                  : "overflow-y-auto"
              }
            >
              {demoMode?.startsWith("interactive:") && (
                <InteractiveDemo demo={demoMode.slice("interactive:".length)} />
              )}
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

              {/* W5 紀念類 + 競賽類 5 元件 demo */}
              {demoMode === "polaroid-host" && (
                <PolaroidCollage
                  config={{ title: "Hung & Anita 婚禮", subtitle: "請來賓留下祝福" }}
                  hostMode={true}
                  state={{
                    polaroids: [
                      { id: "1", author: "Alice", message: "新婚快樂、白頭偕老 💖", emoji: "💖", color: "#fef3c7", ts: Date.now() - 60000 },
                      { id: "2", author: "Bob", message: "祝福你們！", emoji: "🎉", color: "#fce7f3", ts: Date.now() - 40000 },
                      { id: "3", author: "Carol", message: "百年好合", emoji: "🥂", color: "#dbeafe", ts: Date.now() - 20000 },
                      { id: "4", author: "Dave", message: "永浴愛河", emoji: "💍", color: "#dcfce7", ts: Date.now() - 5000 },
                    ],
                  }}
                />
              )}
              {demoMode === "polaroid-player" && (
                <PolaroidCollage
                  config={{ title: "Hung & Anita 婚禮" }}
                  hostMode={false}
                  myUserName="我"
                  state={{ polaroids: [] }}
                />
              )}
              {demoMode === "guestbook-host" && (
                <GuestbookDigital
                  config={{ title: "婚宴簽名簿" }}
                  hostMode={true}
                  state={{
                    entries: [
                      { id: "1", name: "Alice", message: "新婚快樂！", ts: Date.now() - 60000 },
                      { id: "2", name: "Bob", message: "祝百年好合 🥂", ts: Date.now() - 30000 },
                      { id: "3", name: "Carol", message: "永浴愛河 💕", ts: Date.now() - 10000 },
                    ],
                  }}
                />
              )}
              {demoMode === "guestbook-player" && (
                <GuestbookDigital config={{}} hostMode={false} myUserName="我" />
              )}
              {demoMode === "trivia-host" && (
                <TriviaShowdown
                  config={{
                    title: "金門知識搶答",
                    questions: [
                      { id: "q1", prompt: "金門最大紀念日？", options: ["823 砲戰", "古寧頭戰役", "登島紀念日", "光復節"], correctIdx: 0, timeLimitSec: 15 },
                      { id: "q2", prompt: "金門特產飲品？", options: ["啤酒", "高粱酒", "葡萄酒", "梅酒"], correctIdx: 1, timeLimitSec: 15 },
                    ],
                  }}
                  hostMode={true}
                  state={{
                    currentQuestionIdx: 0,
                    status: "answering",
                    answered: { Alice: { choice: 0, ts: Date.now() }, Bob: { choice: 1, ts: Date.now() } },
                    scores: { Alice: 100, Bob: 75 },
                    questionStartedAt: Date.now() - 5000,
                  }}
                />
              )}
              {demoMode === "trivia-player" && (
                <TriviaShowdown
                  config={{
                    title: "金門知識搶答",
                    questions: [
                      { id: "q1", prompt: "金門最大紀念日？", options: ["823 砲戰", "古寧頭戰役", "登島紀念日", "光復節"], correctIdx: 0, timeLimitSec: 15 },
                    ],
                  }}
                  hostMode={false}
                  myUserName="我"
                  state={{
                    currentQuestionIdx: 0,
                    status: "answering",
                    answered: {},
                    scores: {},
                    questionStartedAt: Date.now(),
                  }}
                />
              )}
              {demoMode === "scoreboard-host" && (
                <ScoreboardAnnouncement
                  config={{ title: "📣 賽事即時播報", subtitle: "後浦盃聯賽" }}
                  hostMode={true}
                  state={{
                    announcements: [
                      { id: "1", text: "後浦小隊 +50 分", type: "score", ts: Date.now() - 30000 },
                      { id: "2", text: "下半場開始", type: "info", ts: Date.now() - 15000 },
                      { id: "3", text: "Alice 突破 1000 分！🎉", type: "celebrate", ts: Date.now() - 3000 },
                    ],
                  }}
                />
              )}
              {demoMode === "scoreboard-player" && (
                <ScoreboardAnnouncement
                  config={{ title: "📣 賽事公告" }}
                  hostMode={false}
                  state={{
                    announcements: [
                      { id: "1", text: "後浦小隊 +50 分", type: "score", ts: Date.now() - 30000 },
                      { id: "2", text: "下半場開始", type: "info", ts: Date.now() - 15000 },
                      { id: "3", text: "Alice 突破 1000 分！🎉", type: "celebrate", ts: Date.now() - 3000 },
                    ],
                  }}
                />
              )}
              {demoMode === "knowledgemap-host" && (
                <KnowledgeMap
                  config={{
                    title: "金門全景地圖",
                    subtitle: "5 個地標、邀來賓打卡足跡",
                    points: [
                      { id: "p1", name: "後浦老街", x: 25, y: 35, emoji: "🏛️", description: "歷史巷弄" },
                      { id: "p2", name: "莒光樓", x: 60, y: 25, emoji: "🏯", description: "戰地地標" },
                      { id: "p3", name: "翟山坑道", x: 75, y: 60, emoji: "🪖", description: "地下軍事" },
                      { id: "p4", name: "金門酒廠", x: 40, y: 70, emoji: "🍶", description: "高粱故鄉" },
                      { id: "p5", name: "水頭聚落", x: 15, y: 75, emoji: "🏘️", description: "古厝群" },
                    ],
                  }}
                  hostMode={true}
                  state={{
                    visits: [
                      { id: "v1", pointId: "p1", name: "Alice", message: "好棒的老街", ts: Date.now() - 60000 },
                      { id: "v2", pointId: "p1", name: "Bob", ts: Date.now() - 50000 },
                      { id: "v3", pointId: "p1", name: "Carol", message: "古色古香", ts: Date.now() - 40000 },
                      { id: "v4", pointId: "p2", name: "Dave", message: "風景超美", ts: Date.now() - 30000 },
                      { id: "v5", pointId: "p2", name: "Eve", ts: Date.now() - 20000 },
                      { id: "v6", pointId: "p4", name: "Frank", message: "高粱真香", ts: Date.now() - 10000 },
                    ],
                  }}
                />
              )}
              {demoMode === "knowledgemap-player" && (
                <KnowledgeMap
                  config={{
                    title: "金門全景地圖",
                    points: [
                      { id: "p1", name: "後浦老街", x: 25, y: 35, emoji: "🏛️", description: "歷史巷弄" },
                      { id: "p2", name: "莒光樓", x: 60, y: 25, emoji: "🏯" },
                      { id: "p3", name: "翟山坑道", x: 75, y: 60, emoji: "🪖" },
                    ],
                  }}
                  hostMode={false}
                  myUserName="我"
                  state={{ visits: [] }}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* 12 情境模板入口 — W6 D1 新增 */}
        <section className="space-y-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
            <CardContent className="p-6 md:p-8 text-center space-y-3">
              <h2 className="text-xl md:text-2xl font-display font-bold">
                🎯 看完元件，看情境組合
              </h2>
              <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
                元件不是工具，是「情境武器」 — 我們已預組好 12 個情境模板，
                <br className="hidden md:inline" />
                婚禮、園遊會、街區、企業、空間，看你的場合直接套用
              </p>
              <Link href="/template-market">
                <Button size="lg" data-testid="link-template-market">
                  <Sparkles className="w-4 h-4 mr-1" />
                  瀏覽 12 情境模板
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        {/* 5 大商業情境（簡介卡）*/}
        <section className="space-y-4">
          <h2 className="text-xl font-display font-bold">💼 5 大商業情境（簡介）</h2>
          <p className="text-sm text-muted-foreground">
            主要市場分類 — 詳細模板組合請看 <Link href="/template-market" className="text-primary underline">情境模板市集</Link>
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

// ════════════════════════════════════════════════════════════════════
// DemoCard — 抽出 demo 卡片以共用「適用情境」反向連結（W7 D2）
// ════════════════════════════════════════════════════════════════════

interface DemoCardItem {
  id: string;
  title: string;
  desc: string;
  pageType: string;
  host: string;
  player: string;
}

function DemoCard({
  item,
  onDemoOpen,
  hasBoth,
}: {
  item: DemoCardItem;
  onDemoOpen: (demo: string) => void;
  hasBoth: boolean;
}) {
  const scenarios = getScenariosForPageType(item.pageType);
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-bold">{item.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
        </div>

        {/* W7 D2 反向連結：適用情境 */}
        {scenarios.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 border-t">
            <span className="text-xs text-muted-foreground self-center">適用：</span>
            {scenarios.slice(0, 3).map((s) => (
              <Link key={s.id} href={`/template-market/${s.id}`}>
                <Badge
                  variant="outline"
                  className="text-xs hover:bg-primary/10 cursor-pointer"
                  data-testid={`scenario-link-${item.id}-${s.id}`}
                >
                  {s.name.replace(/情境包$/, "")}
                </Badge>
              </Link>
            ))}
            {scenarios.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{scenarios.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {hasBoth ? (
            <>
              <Button
                onClick={() => onDemoOpen(item.host)}
                size="sm"
                className="flex-1"
                data-testid={`btn-demo-${item.id}-host`}
              >
                📺 大螢幕
              </Button>
              <Button
                onClick={() => onDemoOpen(item.player)}
                size="sm"
                variant="outline"
                className="flex-1"
                data-testid={`btn-demo-${item.id}-player`}
              >
                📱 玩家
              </Button>
            </>
          ) : (
            <Button
              onClick={() => onDemoOpen(item.host)}
              size="sm"
              className="w-full"
              data-testid={`btn-demo-${item.id}`}
            >
              📱 看玩家版型
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
