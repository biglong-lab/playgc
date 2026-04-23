// 🌐 CHITO · 平台首頁（場域總入口）
//
// 網址：/f （不帶 fieldCode）與 /（PlatformHome 轉送來）
// 職責：
//   1. CHITO 品牌介紹
//   2. 列出所有 active 場域讓玩家選擇
//   3. 管理員登入 / 申請開通場域 入口
//
// 點場域卡片 → 進入 /f/:fieldCode 該場域 Landing

import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight, Gamepad2, MapPin, Sparkles, Users, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import OptimizedImage from "@/components/shared/OptimizedImage";

/** 同步讀取 localStorage 的上次場域 code（只在元件初始化時算一次） */
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

interface FieldItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  status: string;
}

export default function FieldEntry() {
  const [, setLocation] = useLocation();

  // 公開端點：只回 active 場域（後端未來可加 visible_on_landing 欄位）
  const { data: fields, isLoading } = useQuery<FieldItem[]>({
    queryKey: ["/api/fields/public"],
    queryFn: async () => {
      const res = await fetch("/api/fields/public");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // 最近玩過的場域（從 localStorage 讀）— 快捷入口，不強制跳轉
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
      {/* ═══ CHITO 品牌 Hero ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background border-b border-border">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03]" />
        <div className="relative container mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-display uppercase tracking-wider text-primary">
              Walk · Play · Local
            </span>
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-black mb-4 tracking-tight">
            CHITO
          </h1>
          <p className="text-lg md:text-xl text-primary font-semibold mb-3 tracking-wide">
            Play the Place
          </p>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            在地場域的實境遊戲平台<br className="md:hidden" />
            <span className="hidden md:inline"> · </span>
            串聯景點、市集、文化空間的沉浸式體驗
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary/70" />
              <span>多場域獨立營運</span>
            </div>
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-primary/70" />
              <span>QR · GPS · 拍照 · 射擊任務</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary/70" />
              <span>團隊 · 競賽 · 接力</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 場域列表 ═══ */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">
              選擇場域
            </h2>
            <p className="text-sm md:text-base text-muted-foreground">
              每個場域有獨立的遊戲、排行榜與主題風格
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
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
              {/* 🆕 繼續上次場域 — 快捷卡片（不強制跳轉，使用者自己點） */}
              {lastField && (
                <div className="mb-5">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    繼續上次場域
                  </p>
                  <Card
                    className="cursor-pointer hover-elevate transition-all group border-2 border-primary/40 bg-primary/5"
                    onClick={() => setLocation(`/f/${lastField.code}`)}
                    data-testid={`field-recent-${lastField.code}`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center gap-4">
                        {lastField.logoUrl ? (
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-primary/10 shrink-0">
                            <OptimizedImage
                              src={lastField.logoUrl}
                              alt={lastField.name}
                              preset="thumbnail"
                              className="w-full h-full object-contain p-1"
                              loading="eager"
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="w-7 h-7 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-bold text-lg mb-0.5 truncate">
                            {lastField.name}
                          </h3>
                          <p className="text-xs text-muted-foreground font-mono">
                            {lastField.code}
                          </p>
                        </div>
                        <Button size="sm" className="gap-1.5 shrink-0">
                          進入 <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 其他場域 */}
              {otherFields && otherFields.length > 0 && (
                <>
                  {lastField && (
                    <p className="text-xs text-muted-foreground mb-2">
                      其他場域
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {otherFields.map((f) => (
                      <Card
                        key={f.id}
                        className="cursor-pointer hover-elevate transition-all group border-2"
                        onClick={() => setLocation(`/f/${f.code}`)}
                        data-testid={`field-card-${f.code}`}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            {f.logoUrl ? (
                              <div className="w-14 h-14 rounded-xl overflow-hidden bg-primary/10 shrink-0">
                                <OptimizedImage
                                  src={f.logoUrl}
                                  alt={f.name}
                                  preset="thumbnail"
                                  className="w-full h-full object-contain p-1"
                                  loading="eager"
                                />
                              </div>
                            ) : (
                              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Building2 className="w-7 h-7 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-display font-bold text-xl mb-1 truncate">
                                {f.name}
                              </h3>
                              <p className="text-xs text-muted-foreground font-mono mb-2">
                                {f.code}
                              </p>
                              {f.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {f.description}
                                </p>
                              )}
                            </div>
                            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                          </div>
                        </CardContent>
                      </Card>
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

      {/* ═══ 次要入口：申請場域 / 管理員登入 ═══ */}
      <section className="border-t border-border bg-muted/20">
        <div className="container mx-auto px-4 py-10">
          <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <Card className="cursor-pointer hover-elevate transition-all h-full" data-testid="link-admin-login">
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

      {/* ═══ Footer ═══ */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            &copy; 2024 CHITO — Play the Place
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            Powered by 大哉實業有限公司
          </p>
        </div>
      </footer>
    </div>
  );
}
