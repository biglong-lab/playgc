import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";
import { signInWithGoogle, signInWithApple, signInAnonymously, signInWithEmail, signUpWithEmail, resetPassword } from "@/lib/firebase";
import { Target, MapPin, Camera, Users, Gamepad2, Trophy, Zap, Shield, AlertTriangle, ExternalLink, Mail, User, Apple, Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

function isEmbeddedBrowser(): boolean {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || "";
  const embeddedBrowserPatterns = [
    /line\//i, /fbav/i, /fban/i, /fb_iab/i, /instagram/i, /twitter/i,
    /wechat/i, /micromessenger/i, /weibo/i, /qq\//i, /linkedinapp/i,
    /snapchat/i, /pinterest/i, /tiktok/i, /bytedance/i,
  ];
  for (const pattern of embeddedBrowserPatterns) {
    if (pattern.test(userAgent)) return true;
  }
  if (/android/i.test(userAgent) && /wv\)|\.0\.0\.0/i.test(userAgent)) return true;
  return false;
}

export default function Landing() {
  const { isLoading, isSignedIn } = useAuth();
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMethod, setLoginMethod] = useState<string | null>(null);
  
  // Email form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  useEffect(() => {
    setShowBrowserWarning(isEmbeddedBrowser());
  }, []);

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

  const handleLoginSuccess = () => {
    setShowLoginDialog(false);
    setIsLoggingIn(false);
    setLoginMethod(null);
    setLocation("/home");
  };

  const handleLoginError = (error: any) => {
    const errorMessage = error?.message || "登入失敗，請重試";
    setIsLoggingIn(false);
    setLoginMethod(null);
    toast({
      variant: "destructive",
      title: "登入失敗",
      description: errorMessage,
    });
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginMethod("google");
    try {
      const user = await signInWithGoogle();
      if (user) {
        handleLoginSuccess();
      }
    } catch (error: any) {
      handleLoginError(error);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoggingIn(true);
    setLoginMethod("apple");
    try {
      const user = await signInWithApple();
      if (user) {
        handleLoginSuccess();
      }
    } catch (error: any) {
      handleLoginError(error);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoggingIn(true);
    setLoginMethod("guest");
    try {
      const user = await signInAnonymously();
      if (user) {
        toast({
          title: "歡迎訪客！",
          description: "您可以稍後在設定中綁定正式帳號",
        });
        handleLoginSuccess();
      }
    } catch (error: any) {
      handleLoginError(error);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "請填寫完整",
        description: "請輸入電子郵件和密碼",
      });
      return;
    }
    
    setIsLoggingIn(true);
    setLoginMethod("email");
    try {
      const user = await signInWithEmail(email, password);
      if (user) {
        handleLoginSuccess();
      }
    } catch (error: any) {
      handleLoginError(error);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "請填寫完整",
        description: "請輸入電子郵件和密碼",
      });
      return;
    }
    
    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "密碼太短",
        description: "密碼至少需要 6 個字元",
      });
      return;
    }
    
    setIsLoggingIn(true);
    setLoginMethod("email");
    try {
      const user = await signUpWithEmail(email, password);
      if (user) {
        toast({
          title: "註冊成功！",
          description: "歡迎加入賈村競技體驗場",
        });
        handleLoginSuccess();
      }
    } catch (error: any) {
      handleLoginError(error);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "請輸入電子郵件",
        description: "請在上方輸入您的電子郵件",
      });
      return;
    }
    
    setIsLoggingIn(true);
    try {
      await resetPassword(email);
      toast({
        title: "已發送重設郵件",
        description: "請檢查您的電子郵件收件箱",
      });
      setShowForgotPassword(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "發送失敗",
        description: error?.message || "請重試",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const openLoginDialog = () => {
    setShowLoginDialog(true);
  };

  const handleOpenInBrowser = () => {
    const currentUrl = window.location.href;
    
    // Try to open in external browser using various methods
    const userAgent = navigator.userAgent.toLowerCase();
    
    // For LINE browser, try using line://app/xxxxx scheme
    if (/line\//i.test(userAgent)) {
      // Open in default browser via intent
      window.location.href = `intent://${window.location.host}${window.location.pathname}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
      setTimeout(() => {
        // Fallback to clipboard if intent doesn't work
        if (navigator.clipboard) {
          navigator.clipboard.writeText(currentUrl);
          toast({
            title: "請在瀏覽器中開啟",
            description: "已複製網址，請在 Safari 或 Chrome 貼上開啟",
          });
        }
      }, 500);
      return;
    }
    
    // For iOS, try Safari open
    if (/iphone|ipad|ipod/i.test(userAgent)) {
      // Try x-safari-https scheme for iOS
      const safariUrl = currentUrl.replace('https://', 'x-safari-https://');
      window.location.href = safariUrl;
      setTimeout(() => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(currentUrl);
          toast({
            title: "請在 Safari 中開啟",
            description: "已複製網址，請開啟 Safari 並貼上",
          });
        }
      }, 500);
      return;
    }
    
    // Default: copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      toast({
        title: "已複製網址",
        description: "請在 Safari 或 Chrome 中貼上此網址",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>
      
      {showBrowserWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-4 text-center shadow-lg">
          <div className="flex items-center justify-center gap-3 flex-wrap mb-2">
            <AlertTriangle className="w-6 h-6" />
            <span className="font-bold text-lg">無法使用 Google 登入</span>
          </div>
          <p className="text-sm mb-3">
            您正在使用 App 內建瀏覽器（如 LINE、Facebook），Google 不允許在此環境登入。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <Button 
              size="default" 
              variant="secondary"
              onClick={handleOpenInBrowser}
              className="gap-2 bg-white text-red-600 hover:bg-gray-100"
            >
              <ExternalLink className="w-5 h-5" />
              在瀏覽器中開啟
            </Button>
            <span className="text-xs opacity-80">或手動複製網址到 Safari / Chrome</span>
          </div>
        </div>
      )}
      
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
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isLoading ? (
              <Button size="lg" disabled className="min-w-[200px]">
                <span className="animate-pulse">{t("common.loading")}</span>
              </Button>
            ) : (
              <>
                {isSignedIn ? (
                  <Link href="/home">
                    <Button size="lg" className="min-w-[200px] gap-2" data-testid="button-enter-game">
                      <Gamepad2 className="w-5 h-5" />
                      {t("nav.games")}
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    size="lg" 
                    className="min-w-[200px] gap-2" 
                    data-testid="button-login"
                    onClick={openLoginDialog}
                  >
                    <Zap className="w-5 h-5" />
                    {t("nav.login")}
                  </Button>
                )}
              </>
            )}
            
            <Link href="/leaderboard">
              <Button size="lg" variant="outline" className="min-w-[200px] gap-2" data-testid="button-leaderboard">
                <Trophy className="w-5 h-5" />
                {t("nav.leaderboard")}
              </Button>
            </Link>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

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
              <Card key={index} className="bg-card border-border hover-elevate group">
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
              onClick={openLoginDialog}
            >
              <Zap className="w-5 h-5" />
              開始冒險
            </Button>
          )}
        </div>
      </section>

      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto text-center">
          <p className="text-sm text-muted-foreground font-chinese">
            &copy; 2024 賈村競技體驗場. All rights reserved.
          </p>
          <Link href="/admin-staff/login">
            <span className="text-xs text-muted-foreground/50 hover:text-muted-foreground cursor-pointer mt-4 inline-block transition-colors" data-testid="link-admin-login">
              管理員登入
            </span>
          </Link>
        </div>
      </footer>

      {/* Login Dialog */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-display text-2xl">登入遊戲</DialogTitle>
            <DialogDescription className="text-center">
              選擇您喜歡的登入方式
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {/* Quick Guest Login */}
            <Button
              variant="outline"
              className="w-full h-12 gap-3 text-base"
              onClick={handleGuestLogin}
              disabled={isLoggingIn}
              data-testid="button-guest-login"
            >
              {isLoggingIn && loginMethod === "guest" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <User className="w-5 h-5" />
              )}
              訪客快速體驗
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  或使用帳號登入
                </span>
              </div>
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-12 gap-2"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn || showBrowserWarning}
                data-testid="button-google-login"
              >
                {isLoggingIn && loginMethod === "google" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <SiGoogle className="w-5 h-5" />
                )}
                Google
              </Button>
              
              <Button
                variant="outline"
                className="h-12 gap-2"
                onClick={handleAppleLogin}
                disabled={isLoggingIn || showBrowserWarning}
                data-testid="button-apple-login"
              >
                {isLoggingIn && loginMethod === "apple" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Apple className="w-5 h-5" />
                )}
                Apple
              </Button>
            </div>

            {showBrowserWarning && (
              <p className="text-xs text-destructive text-center">
                您正在使用 App 內建瀏覽器，社群登入可能無法使用。請使用訪客登入或電子郵件登入。
              </p>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  電子郵件登入
                </span>
              </div>
            </div>

            {/* Email Login/Signup Tabs */}
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" data-testid="tab-email-login">登入</TabsTrigger>
                <TabsTrigger value="signup" data-testid="tab-email-signup">註冊</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-3 mt-3">
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="email-login">電子郵件</Label>
                    <Input
                      id="email-login"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoggingIn}
                      data-testid="input-email-login"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-login">密碼</Label>
                    <Input
                      id="password-login"
                      type="password"
                      placeholder="輸入密碼"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoggingIn}
                      data-testid="input-password-login"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={isLoggingIn}
                    data-testid="button-email-login-submit"
                  >
                    {isLoggingIn && loginMethod === "email" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    登入
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-sm"
                    onClick={handleForgotPassword}
                    disabled={isLoggingIn}
                    data-testid="button-forgot-password"
                  >
                    忘記密碼？
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-3 mt-3">
                <form onSubmit={handleEmailSignup} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="email-signup">電子郵件</Label>
                    <Input
                      id="email-signup"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoggingIn}
                      data-testid="input-email-signup"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-signup">密碼</Label>
                    <Input
                      id="password-signup"
                      type="password"
                      placeholder="至少 6 個字元"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoggingIn}
                      data-testid="input-password-signup"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={isLoggingIn}
                    data-testid="button-email-signup-submit"
                  >
                    {isLoggingIn && loginMethod === "email" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    建立帳號
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
