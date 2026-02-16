import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";
import { useLoginHandlers } from "@/hooks/useLoginHandlers";
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
} from "lucide-react";

export default function Landing() {
  const { isLoading, isSignedIn } = useAuth();
  const { t } = useI18n();
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const loginHandlers = useLoginHandlers(() => setShowLoginDialog(false));

  const features = [
    {
      icon: Target,
      title: t("landing.features.shooting"),
      description: t("landing.features.shooting.desc"),
    },
    {
      icon: MapPin,
      title: t("landing.features.gps"),
      description: t("landing.features.gps.desc"),
    },
    {
      icon: Camera,
      title: t("landing.features.photo"),
      description: t("landing.features.photo.desc"),
    },
    {
      icon: Users,
      title: t("landing.features.team"),
      description: t("landing.features.team.desc"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      <EmbeddedBrowserWarning />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-tactical-gradient" />
        <div className="absolute inset-0 bg-radial-glow opacity-50" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />

        <div className="relative z-10 container px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-8">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-display uppercase tracking-wider text-primary">
              Tactical Experience
            </span>
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 text-glow">
            {t("landing.hero.title")}
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-4 font-chinese">
            {t("app.subtitle")}
          </p>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-12 font-chinese">
            {t("landing.hero.subtitle")}
          </p>

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
            &copy; 2024 賈村競技體驗場. All rights reserved.
          </p>
          <Link href="/admin-staff/login">
            <span
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground cursor-pointer mt-4 inline-block transition-colors"
              data-testid="link-admin-login"
            >
              管理員登入
            </span>
          </Link>
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
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      {isLoading ? (
        <Button size="lg" disabled className="min-w-[200px]">
          <span className="animate-pulse">{t("common.loading")}</span>
        </Button>
      ) : (
        <>
          {isSignedIn ? (
            <Link href="/home">
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

      <Link href="/leaderboard">
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
