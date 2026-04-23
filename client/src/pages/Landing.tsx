import { Link } from "wouter";
import { useState } from "react";
import AnnouncementBanner from "@/components/shared/AnnouncementBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";
import { useLoginHandlers } from "@/hooks/useLoginHandlers";
import { useCurrentField } from "@/providers/FieldThemeProvider";
import { useFieldLink } from "@/hooks/useFieldLink";
import {
  EmbeddedBrowserWarning,
  isEmbeddedBrowser,
} from "@/components/landing/EmbeddedBrowserWarning";
import { LoginDialog } from "@/components/landing/LoginDialog";
import {
  Target,
  MapPin,
  Camera,
  Users,
  Gamepad2,
  Trophy,
  Zap,
  Shield,
  Swords,
  Landmark,
  ShoppingBag,
  Coffee,
  Puzzle,
  QrCode,
  Compass,
  Sparkles,
  Star,
  Clock,
  type LucideIcon,
} from "lucide-react";

// ═══════════ 動態 icon 對應（給後台 highlights 用）═══════════
const ICON_MAP: Record<string, LucideIcon> = {
  Target, MapPin, Camera, Users, Gamepad2, Trophy, Zap, Shield,
  Swords, Landmark, ShoppingBag, Coffee, Puzzle, QrCode, Compass,
  Sparkles, Star, Clock,
};

function resolveIcon(name?: string): LucideIcon {
  if (name && ICON_MAP[name]) return ICON_MAP[name];
  return Sparkles; // fallback
}

export default function Landing() {
  const { isLoading, isSignedIn } = useAuth();
  const { t } = useI18n();
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const loginHandlers = useLoginHandlers(() => setShowLoginDialog(false));

  // 🆕 當前場域資料（含 tagline / highlights / modules / announcement）
  const currentField = useCurrentField();
  const fieldCoverUrl = currentField?.theme?.coverImageUrl || null;
  const fieldLogoUrl = currentField?.logoUrl || null;
  const fieldName = currentField?.name;
  const welcomeMessage = currentField?.welcomeMessage || null;
  const fieldTagline = currentField?.tagline || null;
  const announcement = currentField?.announcement || null;

  // 🆕 場域特色：優先讀後台設定的 highlights，沒有則 fallback 到 i18n 預設
  // 🛡️ 防禦：舊 API / PWA 快取可能沒回 highlights，保底空陣列
  const fieldHighlights = Array.isArray(currentField?.highlights) ? currentField.highlights : [];
  const hasCustomHighlights = fieldHighlights.length > 0;
  const features = hasCustomHighlights
    ? fieldHighlights.map((h) => ({
        icon: resolveIcon(h.icon),
        title: h.title,
        description: h.description || "",
      }))
    : [
        { icon: MapPin, title: t("landing.features.gps"), description: t("landing.features.gps.desc") },
        { icon: Camera, title: t("landing.features.photo"), description: t("landing.features.photo.desc") },
        { icon: Users, title: t("landing.features.team"), description: t("landing.features.team.desc") },
        { icon: QrCode, title: "互動任務", description: "QR、地點、解謎、團隊協作等多元任務" },
      ];

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      <EmbeddedBrowserWarning />

      {/* 🆕 場域公告 banner — 玩家可關當次 session */}
      <AnnouncementBanner announcement={announcement} />


      {/* Hero Section — 場域有 coverImageUrl 時優先用，否則用預設 gradient */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {fieldCoverUrl ? (
          <>
            <img
              src={fieldCoverUrl}
              alt={fieldName || "場域"}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/40" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-tactical-gradient" />
            <div className="absolute inset-0 bg-radial-glow opacity-50" />
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />
          </>
        )}

        <div className="relative z-10 container px-4 py-20 text-center">
          {/* 場域 Logo（若有） */}
          {fieldLogoUrl && (
            <img
              src={fieldLogoUrl}
              alt={fieldName || ""}
              className="w-20 h-20 mx-auto mb-6 rounded-2xl object-contain bg-white/10 backdrop-blur p-2"
            />
          )}

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-8">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-display uppercase tracking-wider text-primary">
              Tactical Experience
            </span>
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 text-glow">
            {fieldName || t("landing.hero.title")}
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-4 font-chinese">
            {welcomeMessage || fieldTagline || t("app.subtitle")}
          </p>

          {!welcomeMessage && !fieldTagline && (
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-12 font-chinese">
              {t("landing.hero.subtitle")}
            </p>
          )}

          <HeroButtons
            isLoading={isLoading}
            isSignedIn={isSignedIn}
            t={t}
            onLoginClick={() => setShowLoginDialog(true)}
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-4 text-glow">
            <span className="text-primary">MISSION</span> TYPES
          </h2>
          <p className="text-muted-foreground text-center mb-12 font-chinese">
            多元任務類型，挑戰你的極限
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="bg-card border-border hover-elevate group"
              >
                <CardContent className="p-6">
                  <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-display font-bold mb-2 uppercase tracking-wide">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm font-chinese">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-card/50">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-8 text-glow">
            準備好了嗎?
          </h2>
          <p className="text-muted-foreground mb-8 font-chinese max-w-xl mx-auto">
            登入開始你的戰術體驗之旅
          </p>
          {!isSignedIn && (
            <Button
              size="lg"
              className="gap-2"
              data-testid="button-start-adventure"
              onClick={() => setShowLoginDialog(true)}
            >
              <Zap className="w-5 h-5" />
              開始冒險
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto text-center">
          <p className="text-sm text-muted-foreground font-chinese">
            &copy; 2024 CHITO — Play the Place
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Link href="/apply">
              <span className="text-xs text-muted-foreground/70 hover:text-primary cursor-pointer transition-colors">
                🌐 申請開通場域
              </span>
            </Link>
            <span className="text-muted-foreground/30">·</span>
            <Link href="/admin/login">
              <span
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground cursor-pointer transition-colors"
                data-testid="link-admin-login"
              >
                管理員登入
              </span>
            </Link>
          </div>
        </div>
      </footer>

      {/* 登入 Dialog */}
      <LoginDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
        isEmbeddedBrowser={isEmbeddedBrowser()}
        handlers={loginHandlers}
      />
    </div>
  );
}

/** Hero 區域的 CTA 按鈕群組 */
function HeroButtons({
  isLoading,
  isSignedIn,
  t,
  onLoginClick,
}: {
  isLoading: boolean;
  isSignedIn: boolean;
  t: (key: string) => string;
  onLoginClick: () => void;
}) {
  const link = useFieldLink();
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      {isLoading ? (
        <Button size="lg" disabled className="min-w-[200px]">
          <span className="animate-pulse">{t("common.loading")}</span>
        </Button>
      ) : (
        <>
          {isSignedIn ? (
            <Link href={link("/home")}>
              <Button
                size="lg"
                className="min-w-[200px] gap-2"
                data-testid="button-enter-game"
              >
                <Gamepad2 className="w-5 h-5" />
                {t("nav.games")}
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              className="min-w-[200px] gap-2"
              data-testid="button-login"
              onClick={onLoginClick}
            >
              <Zap className="w-5 h-5" />
              {t("nav.login")}
            </Button>
          )}
        </>
      )}

      <Link href={link("/leaderboard")}>
        <Button
          size="lg"
          variant="outline"
          className="min-w-[200px] gap-2"
          data-testid="button-leaderboard"
        >
          <Trophy className="w-5 h-5" />
          {t("nav.leaderboard")}
        </Button>
      </Link>
    </div>
  );
}
