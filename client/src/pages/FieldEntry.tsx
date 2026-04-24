// 🌐 CHITO · 平台首頁（場域總入口）
//
// 網址：/f （不帶 fieldCode）與 /（PlatformHome 轉送來）
// 職責：
//   1. CHITO 品牌介紹 + 給誰用 + 如何運作
//   2. 列出所有 active 場域（帶封面、遊戲數）
//   3. 管理員登入 / 申請開通場域 入口

import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ArrowRight,
  Gamepad2,
  MapPin,
  Sparkles,
  Users,
  History,
  QrCode,
  Landmark,
  ShoppingBag,
  Coffee,
  Rocket,
  Compass,
  Layers,
  Sun,
  Sunset,
  Moon,
  Megaphone,
  AlertCircle,
  Copy,
  Check,
  ArrowUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import OptimizedImage from "@/components/shared/OptimizedImage";
import GenericCoverFallback from "@/components/shared/GenericCoverFallback";
import { daysUntilDate, formatRemainingDays } from "@/lib/date-utils";

interface FieldItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  status: string;
  // 🆕 marketing（舊 API 可能沒回這些，全部 optional）
  tagline?: string | null;
  coverImageUrl?: string | null;
  highlights?: Array<{ icon?: string; title: string; description?: string }>;
  /** 🆕 公告（API 已過濾時效外），顯示於場域卡 */
  announcement?: string | null;
  /** 🆕 公告嚴重程度 — 決定場域卡公告指示顏色 */
  announcementSeverity?: "info" | "urgent";
  /** 🆕 公告結束日 — 顯示倒數用 */
  announcementEndAt?: string | null;
  // 🆕 stats（舊 API 可能沒回這些）
  gameCount?: number;
  topGameCovers?: Array<{ id: string; title: string; coverImageUrl: string }>;
}

/** 🆕 依當前時段回傳 Hero 視覺 — 白天/黃昏/夜晚三種氛圍 */
type TimeOfDay = "day" | "sunset" | "night";
function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 6 && h < 17) return "day";
  if (h >= 17 && h < 19) return "sunset";
  return "night";
}

const TIME_THEMES: Record<TimeOfDay, {
  overlayClass: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  day: {
    overlayClass: "bg-gradient-to-br from-sky-400/10 via-transparent to-transparent",
    label: "早安，走踏時光",
    icon: Sun,
  },
  sunset: {
    overlayClass: "bg-gradient-to-br from-orange-500/15 via-pink-500/10 to-transparent",
    label: "黃昏好時分",
    icon: Sunset,
  },
  night: {
    overlayClass: "bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent",
    label: "夜遊尋寶",
    icon: Moon,
  },
};

/** 同步讀取 localStorage 的上次場域 code */
function readLastFieldCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem("lastFieldCode");
    if (v && /^[A-Z0-9_-]{2,50}$/i.test(v)) return v.toUpperCase();
  } catch {
    /* ignore */
  }
  return null;
}

export default function FieldEntry() {
  const [, setLocation] = useLocation();
  // 🆕 依時段決定 Hero 氛圍（每分鐘 re-evaluate，午夜自動換）
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => getTimeOfDay());
  useEffect(() => {
    const interval = setInterval(() => setTimeOfDay(getTimeOfDay()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const timeTheme = TIME_THEMES[timeOfDay];
  const TimeIcon = timeTheme.icon;

  const { data: fields, isLoading } = useQuery<FieldItem[]>({
    queryKey: ["/api/fields/public"],
    queryFn: async () => {
      const res = await fetch("/api/fields/public");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // 最近玩過的場域 — 快捷入口，不強制跳轉
  const lastCode = useMemo(() => readLastFieldCode(), []);
  const lastField = useMemo(
    () => (lastCode && fields ? fields.find((f) => f.code === lastCode) : null),
    [lastCode, fields],
  );
  const otherFields = useMemo(
    () => (lastField && fields ? fields.filter((f) => f.code !== lastField.code) : fields),
    [lastField, fields],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* 🆕 回到頂部 FAB（滾動 > 400px 時顯示） */}
      <BackToTopButton />

      {/* ═══════════ Hero（時段動態背景）═══════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background border-b border-border">
        {/* 🆕 時段氛圍 overlay — 疊加在 primary gradient 上 */}
        <div className={`absolute inset-0 ${timeTheme.overlayClass} transition-opacity duration-1000`} />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03]" />
        <div className="relative container mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-display uppercase tracking-wider text-primary">
              Real-world · Local · Play
            </span>
          </div>
          {/* 🆕 時段問候 */}
          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mb-6" data-testid={`time-greeting-${timeOfDay}`}>
            <TimeIcon className="w-3.5 h-3.5" />
            <span>{timeTheme.label}</span>
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-black mb-4 tracking-tight">
            CHITO
          </h1>
          <p className="text-lg md:text-xl text-primary font-semibold mb-4 tracking-wide">
            Play the Place
          </p>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            在地場域的實境遊戲平台
            <br className="md:hidden" />
            <span className="hidden md:inline"> · </span>
            串聯景點、市集、文化空間的沉浸式體驗
          </p>

          {/* 🆕 Hero 下方 feature strip */}
          <div className="flex flex-wrap items-center justify-center gap-5 md:gap-6 text-xs md:text-sm text-muted-foreground mt-8">
            <div className="flex items-center gap-1.5 transition-colors hover:text-foreground cursor-default">
              <MapPin className="w-4 h-4 text-primary/70" />
              <span>多場域獨立</span>
            </div>
            <span className="text-muted-foreground/30">·</span>
            <div className="flex items-center gap-1.5 transition-colors hover:text-foreground cursor-default">
              <Gamepad2 className="w-4 h-4 text-primary/70" />
              <span>QR · GPS · 拍照</span>
            </div>
            <span className="text-muted-foreground/30">·</span>
            <div className="flex items-center gap-1.5 transition-colors hover:text-foreground cursor-default">
              <Users className="w-4 h-4 text-primary/70" />
              <span>團隊協作</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ 給誰用（What is CHITO） ═══════════ */}
      <section className="container mx-auto px-4 py-14 md:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-2">
              What is CHITO
            </p>
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">
              把實體場域變成可以玩的遊戲
            </h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              CHITO 是一個<span className="text-foreground font-medium">多場域實境遊戲 SaaS</span>。
              景點、市集、文化空間用 CHITO 打造專屬遊戲；玩家用手機走踏、掃 QR、解謎、拍照、完成任務，
              讓每一次到訪都變成一段有劇情的體驗。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-2">
              <CardContent className="p-6">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <Landmark className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-bold text-base mb-1.5">在地景點 · 文化觀光</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  把歷史、故事、地景變成遊戲任務，遊客不再只是「走馬看花」。
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="p-6">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-bold text-base mb-1.5">市集 · 商圈走踏</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  任務串聯店家，引流、加值、消費，讓走踏本身變成理由。
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="p-6">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <Coffee className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-bold text-base mb-1.5">活動 · 品牌體驗</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  一次性活動或常駐品牌館，快速上線、完賽即可查排行榜。
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ═══════════ 如何運作（3 步驟） ═══════════ */}
      <section className="bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 py-14 md:py-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-2">
                How it works
              </p>
              <h2 className="text-2xl md:text-3xl font-display font-bold">三步驟開始走踏</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StepCard
                step="1"
                icon={<Compass className="w-6 h-6 text-primary" />}
                title="選擇場域"
                description="從 CHITO 首頁選擇要去的場域，或直接掃場域 QR Code 進入。"
              />
              <StepCard
                step="2"
                icon={<Gamepad2 className="w-6 h-6 text-primary" />}
                title="選擇遊戲"
                description="每個場域有自己的遊戲 / 章節 / 任務，挑一款開始。"
              />
              <StepCard
                step="3"
                icon={<Rocket className="w-6 h-6 text-primary" />}
                title="走踏 · 完賽"
                description="沿途完成 QR、拍照、解謎、團隊任務，完賽查排行榜。"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ 場域列表 ═══════════ */}
      <section className="container mx-auto px-4 py-14 md:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-2">
              Active Venues
            </p>
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">選擇場域</h2>
            <p className="text-sm md:text-base text-muted-foreground">
              每個場域有獨立的遊戲、排行榜與主題風格
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : !fields || fields.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">目前沒有可用的場域</p>
                <Link href="/apply">
                  <Button variant="outline" size="sm">
                    申請開通場域
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 🆕 繼續上次場域 — 快捷卡片（不強制跳轉） */}
              {lastField && (
                <div className="mb-6">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    繼續上次場域
                  </p>
                  <FieldCard
                    field={lastField}
                    highlighted
                    onClick={() => setLocation(`/f/${lastField.code}`)}
                  />
                </div>
              )}

              {/* 其他場域 */}
              {otherFields && otherFields.length > 0 && (
                <>
                  {lastField && (
                    <p className="text-xs text-muted-foreground mb-2">其他場域</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {otherFields.map((f, idx) => (
                      <FieldCard
                        key={f.id}
                        field={f}
                        eager={!lastField && idx < 2}
                        onClick={() => setLocation(`/f/${f.code}`)}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <p className="text-center text-xs text-muted-foreground mt-8">
            或直接輸入場域網址：<span className="font-mono">game.homi.cc/f/YOUR_CODE</span>
          </p>
        </div>
      </section>

      {/* ═══════════ 次要入口 ═══════════ */}
      <section className="border-t border-border bg-muted/20">
        <div className="container mx-auto px-4 py-10">
          <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/apply">
              <Card className="cursor-pointer hover-elevate transition-all h-full">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">申請開通場域</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      把你的景點 / 市集 / 空間變成 CHITO 場域
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/login">
              <Card
                className="cursor-pointer hover-elevate transition-all h-full"
                data-testid="link-admin-login"
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">管理員登入</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      場域 / 平台管理後台入口
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ Footer ═══════════ */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto text-center">
          {/* 🆕 場域 + 遊戲總數統計（僅有場域時顯示） */}
          {fields && fields.length > 0 && (
            <p className="text-xs text-muted-foreground/70 mb-2 flex items-center justify-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                <span className="font-mono font-semibold text-foreground">{fields.length}</span>
                <span>個場域</span>
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span className="inline-flex items-center gap-1">
                <Gamepad2 className="w-3 h-3" />
                <span className="font-mono font-semibold text-foreground">
                  {fields.reduce((sum, f) => sum + (f.gameCount ?? 0), 0)}
                </span>
                <span>款遊戲</span>
              </span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {/* 🆕 © 年份自動跟著系統時鐘，跨年不用改 code */}
            &copy; {new Date().getFullYear()} CHITO — Play the Place
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            Powered by 大哉實業有限公司
          </p>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🆕 回到頂部 FAB — 滾動 > 400px 時淡入顯示
// ═══════════════════════════════════════════════════════════════
function BackToTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-300 ${
        show
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      aria-label="回到頂部"
      data-testid="btn-back-to-top"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🆕 場域 code + 分享按鈕（手機優先用 Web Share API，桌面 fallback 複製）
// ═══════════════════════════════════════════════════════════════
function CodeWithCopy({ code, fieldName }: { code: string; fieldName: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const shareUrl = `${window.location.origin}/f/${code}`;
    const shareData: ShareData = {
      title: `CHITO · ${fieldName}`,
      text: `${fieldName} — 走踏在地實境遊戲`,
      url: shareUrl,
    };

    // 🆕 優先用 Web Share API（手機支援較好，會叫系統分享選單：LINE、Messenger、AirDrop…）
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return; // 成功就結束（不需 toast，系統選單本身有回饋）
      } catch (err) {
        // 使用者取消分享 → 不做任何事；其他錯誤 → 退回複製
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }

    // Fallback：複製到剪貼簿
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "已複製分享連結",
        description: shareUrl,
      });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "複製失敗", variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center gap-1.5 group/code">
      <p className="text-[11px] text-muted-foreground font-mono">{code}</p>
      <button
        type="button"
        onClick={handleShare}
        className="text-muted-foreground/40 hover:text-primary transition-colors opacity-0 group-hover/code:opacity-100 focus:opacity-100"
        aria-label={`分享 ${fieldName} 場域連結`}
        title="分享場域連結"
        data-testid={`btn-share-field-${code}`}
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-600" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 子元件：步驟卡片
// ═══════════════════════════════════════════════════════════════
function StepCard({
  step,
  icon,
  title,
  description,
}: {
  step: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="relative border-2">
      <CardContent className="p-6">
        <span className="absolute top-3 right-4 text-4xl font-display font-black text-primary/10">
          {step}
        </span>
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
          {icon}
        </div>
        <h3 className="font-display font-bold text-lg mb-1.5">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 子元件：場域卡片（帶封面圖、遊戲數、tagline）
// ═══════════════════════════════════════════════════════════════
function FieldCard({
  field,
  highlighted = false,
  eager = false,
  onClick,
}: {
  field: FieldItem;
  highlighted?: boolean;
  /** 🆕 是否 eager 載入封面（highlighted 或第一張視為首屏） */
  eager?: boolean;
  onClick: () => void;
}) {
  // 🛡️ 防禦：舊 API / 快取可能沒 topGameCovers，保底空陣列
  const topCovers = field.topGameCovers ?? [];
  const gameCount = field.gameCount ?? 0;
  // 封面優先序：coverImageUrl > 第一款遊戲封面 > null
  const coverUrl = field.coverImageUrl || topCovers[0]?.coverImageUrl || null;
  // 🆕 首屏 eager，其餘 lazy，省頻寬
  const imgLoading: "eager" | "lazy" = highlighted || eager ? "eager" : "lazy";

  // 🆕 鍵盤觸發：Enter / Space
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      className={`cursor-pointer hover-elevate transition-all group overflow-hidden border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 ${
        highlighted ? "border-primary/50 bg-primary/5 shadow-lg" : ""
      }`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`進入 ${field.name} 場域`}
      data-testid={highlighted ? `field-recent-${field.code}` : `field-card-${field.code}`}
    >
      {/* 封面圖 */}
      {coverUrl ? (
        <div className="relative w-full aspect-[16/9] bg-muted overflow-hidden">
          <OptimizedImage
            src={coverUrl}
            alt={field.name}
            preset="card"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading={imgLoading}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          {/* 遊戲數 Badge */}
          {gameCount > 0 && (
            <div className="absolute top-3 right-3 bg-background/90 backdrop-blur px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Gamepad2 className="w-3 h-3" />
              {gameCount} 款遊戲
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full aspect-[16/9] overflow-hidden">
          <GenericCoverFallback
            name={field.name}
            badge={{ icon: <Building2 className="w-3 h-3" />, label: field.code }}
            hideOverlay
          />
          {gameCount > 0 && (
            <div className="absolute top-3 right-3 bg-background/90 backdrop-blur px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Gamepad2 className="w-3 h-3" />
              {gameCount} 款遊戲
            </div>
          )}
        </div>
      )}

      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-2">
          {field.logoUrl && (
            <div className="w-11 h-11 rounded-lg overflow-hidden bg-primary/10 shrink-0 -mt-10 border-4 border-background shadow-md">
              <OptimizedImage
                src={field.logoUrl}
                alt={field.name}
                preset="thumbnail"
                className="w-full h-full object-contain p-0.5"
                loading="eager"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-lg mb-0.5 truncate">
              {field.name}
            </h3>
            <CodeWithCopy code={field.code} fieldName={field.name} />

          </div>
          <Button
            size="sm"
            variant={highlighted ? "default" : "outline"}
            className="gap-1 shrink-0"
          >
            進入 <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* tagline 優先於 description */}
        {(field.tagline || field.description) && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
            {field.tagline || field.description}
          </p>
        )}

        {/* 🆕 公告提示（API 已過濾時效外，只會在生效中出現）+ 倒數 */}
        {field.announcement && (() => {
          const isUrgent = field.announcementSeverity === "urgent";
          const Icon = isUrgent ? AlertCircle : Megaphone;
          const remaining = formatRemainingDays(daysUntilDate(field.announcementEndAt));
          return (
            <div
              className={`flex items-start gap-1.5 mt-2 px-2 py-1.5 rounded-md text-xs ${
                isUrgent
                  ? "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30 font-medium"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30"
              }`}
              data-testid={`field-card-announcement-${field.code}`}
              title={field.announcement || ""}
            >
              <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-2 leading-snug flex-1">
                {isUrgent && "🚨 "}
                {field.announcement}
              </span>
              {remaining && (
                <span className="opacity-60 font-mono text-[10px] shrink-0 mt-0.5">
                  {remaining}
                </span>
              )}
            </div>
          );
        })()}

        {/* 其他遊戲封面小縮圖（最多 3 個）*/}
        {topCovers.length > 1 && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="flex -space-x-2">
              {topCovers.slice(0, 3).map((g) => (
                <div
                  key={g.id}
                  className="w-8 h-8 rounded-md overflow-hidden border-2 border-background bg-muted"
                  title={g.title}
                >
                  <OptimizedImage
                    src={g.coverImageUrl}
                    alt={g.title}
                    preset="thumbnail"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground ml-1">精選遊戲</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
