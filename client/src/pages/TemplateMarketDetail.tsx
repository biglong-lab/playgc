// 🎯 TemplateMarketDetail — 單一情境詳情頁
//
// 路徑：/template-market/:scenarioId
// 用途：完整介紹單一情境、列出元件、提供試玩入口、銷售 CTA

import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, CheckCircle, Tv, Smartphone, Zap, Copy, ExternalLink, Loader2 } from "lucide-react";
import { getScenarioById, type ScenarioComponent } from "@shared/scenario-templates";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

interface ScenarioInstance {
  sessionId: string;
  gameId: string;
  pageType: string;
  label: string;
  hostUrl: string;
  playUrl: string;
  hostToken: string;
}

interface InstantiateResponse {
  scenario: { id: string; name: string; tagline: string };
  displayName: string;
  expiresAt: string;
  instances: ScenarioInstance[];
  totalCreated: number;
}

export default function TemplateMarketDetail() {
  const [, params] = useRoute("/template-market/:scenarioId");
  const [, navigate] = useLocation();
  const { admin } = useAdminAuth();
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<InstantiateResponse | null>(null);

  const scenarioId = params?.scenarioId;
  const scenario = scenarioId ? getScenarioById(scenarioId) : undefined;

  const isPureHost = scenario?.components.every((c) => c.axis === "host") ?? false;

  const handleLaunch = async () => {
    if (!scenarioId) return;
    setLaunching(true);
    try {
      const res = await apiRequest("POST", `/api/admin/scenarios/${scenarioId}/instantiate`, {});
      const data: InstantiateResponse = await res.json();
      setLaunchResult(data);
      toast({
        title: "✅ 建立成功",
        description: `為「${data.scenario.name}」建立了 ${data.totalCreated} 個大螢幕場次`,
      });
    } catch (err) {
      toast({
        title: "❌ 建立失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    } finally {
      setLaunching(false);
    }
  };

  if (!scenario) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-display font-bold">情境不存在</h1>
          <p className="text-sm text-muted-foreground">
            找不到 ID 為 {scenarioId} 的情境模板
          </p>
          <Link href="/template-market">
            <Button>回情境模板市集</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b safe-top">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="p-2 hover:bg-muted rounded-lg"
              onClick={() => navigate("/template-market")}
              data-testid="btn-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display font-bold text-lg" data-testid="text-scenario-name">
                {scenario.name}
              </h1>
              <p className="text-xs text-muted-foreground">{scenario.tagline}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        {/* Hero */}
        <Card className={`bg-gradient-to-br ${scenario.gradient} border-0`}>
          <CardContent className="p-6 md:p-8 space-y-4">
            <h2 className="text-2xl md:text-4xl font-display font-bold">
              {scenario.name}
            </h2>
            <p className="text-base md:text-lg whitespace-pre-line leading-relaxed">
              {scenario.description}
            </p>
            <div className="flex gap-2 pt-2 flex-wrap">
              <Badge variant="secondary">👥 {scenario.estimatedPlayers}</Badge>
              <Badge variant="secondary">⏱ {scenario.estimatedDuration}</Badge>
              <Badge
                variant="secondary"
                data-testid={`badge-status-${scenario.status}`}
              >
                {scenario.status === "live"
                  ? "✅ 可用"
                  : scenario.status === "preview"
                    ? "👀 預覽"
                    : "🚧 規劃中"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 適用情境 */}
        <section className="space-y-3">
          <h3 className="font-display font-bold text-lg">📍 適用情境</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {scenario.useCases.map((useCase, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-3 rounded-lg bg-card border"
                data-testid={`use-case-${i}`}
              >
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm">{useCase}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 元件組合 */}
        <section className="space-y-3">
          <h3 className="font-display font-bold text-lg">
            🧩 含 {scenario.components.length} 個元件
          </h3>
          <div className="space-y-2">
            {scenario.components.map((component) => (
              <ComponentRow key={component.pageType} component={component} />
            ))}
          </div>
        </section>

        {/* 商業價值 */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-5 space-y-2">
            <h3 className="font-display font-bold flex items-center gap-2">
              💼 商業價值
            </h3>
            <p className="text-sm leading-relaxed">{scenario.valueProposition}</p>
          </CardContent>
        </Card>

        {/* Admin 一鍵建場（W6 D2）*/}
        {admin && isPureHost && (
          <Card className="bg-emerald-500/10 border-emerald-500/30">
            <CardContent className="p-6 space-y-3 text-center">
              <h3 className="font-display font-bold text-lg flex items-center justify-center gap-2">
                <Zap className="w-5 h-5 text-emerald-600" />
                Admin 一鍵建場
              </h3>
              <p className="text-sm text-muted-foreground">
                為這個情境的 {scenario.components.length} 個元件，一次建好所有大螢幕場次。<br />
                每個場次都會有獨立的 hostUrl + playUrl，12 小時內有效。
              </p>
              <Button
                size="lg"
                onClick={handleLaunch}
                disabled={launching}
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="btn-launch-scenario"
              >
                {launching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    建立中...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-1" />
                    立即建立 {scenario.components.length} 個場次
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {!admin && isPureHost && (
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="p-5 text-center space-y-2">
              <p className="text-sm">
                💡 Admin 登入後可看到「一鍵建場」按鈕，自動為這個情境建好所有大螢幕場次
              </p>
              <Link href="/admin/login">
                <Button size="sm" variant="outline">
                  Admin 登入
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <section className="text-center space-y-4 py-6">
          <h3 className="font-display font-bold text-lg">看好了？開始建一個</h3>
          <p className="text-sm text-muted-foreground">
            {isPureHost
              ? "上方一鍵建場（admin 限定），或自訂內容後手動建立"
              : "此情境含多軸線元件，需手動建 game + 配合 host session（W7 補上自動化）"}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/showcase">
              <Button variant="outline" data-testid="btn-try-components">
                <Smartphone className="w-4 h-4 mr-1" />
                先試玩元件
              </Button>
            </Link>
            <Link href="/admin/host-sessions">
              <Button data-testid="btn-create-host-session">
                <Tv className="w-4 h-4 mr-1" />
                手動建大螢幕場次
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* 一鍵建場結果 Dialog */}
      <Dialog open={launchResult !== null} onOpenChange={(open) => !open && setLaunchResult(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              ✅ {launchResult?.scenario.name} 已建立
            </DialogTitle>
          </DialogHeader>
          {launchResult && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                建立了 <span className="font-bold text-foreground">{launchResult.totalCreated}</span> 個大螢幕場次
                ，{new Date(launchResult.expiresAt).toLocaleString("zh-TW")} 前有效
              </div>
              <div className="space-y-2">
                {launchResult.instances.map((inst) => (
                  <InstanceRow key={inst.sessionId} instance={inst} />
                ))}
              </div>
              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setLaunchResult(null)}>
                  關閉
                </Button>
                <Button
                  onClick={() => navigate("/admin/host-sessions")}
                  data-testid="btn-go-host-sessions"
                >
                  到管理後台 <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InstanceRow({ instance }: { instance: ScenarioInstance }) {
  const fullHostUrl = `${window.location.origin}${instance.hostUrl}`;
  const fullPlayUrl = `${window.location.origin}${instance.playUrl}`;

  const handleCopy = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: `✅ 已複製 ${label} 網址` });
    } catch {
      toast({ title: "❌ 複製失敗", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2" data-testid={`instance-${instance.pageType}`}>
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">📺 {instance.label}</div>
        <Badge variant="outline" className="text-xs">{instance.pageType}</Badge>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground w-12 flex-shrink-0">大螢幕</span>
          <code className="text-xs flex-1 truncate bg-muted px-2 py-1 rounded">{fullHostUrl}</code>
          <Button size="sm" variant="ghost" onClick={() => handleCopy(fullHostUrl, "大螢幕")}>
            <Copy className="w-3 h-3" />
          </Button>
          <a href={instance.hostUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost">
              <ExternalLink className="w-3 h-3" />
            </Button>
          </a>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground w-12 flex-shrink-0">玩家</span>
          <code className="text-xs flex-1 truncate bg-muted px-2 py-1 rounded">{fullPlayUrl}</code>
          <Button size="sm" variant="ghost" onClick={() => handleCopy(fullPlayUrl, "玩家")}>
            <Copy className="w-3 h-3" />
          </Button>
          <a href={instance.playUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost">
              <ExternalLink className="w-3 h-3" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

function ComponentRow({ component }: { component: ScenarioComponent }) {
  const axisStyle = {
    host: { bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", label: "📺 大螢幕" },
    multi: { bg: "bg-purple-500/10", text: "text-purple-700 dark:text-purple-400", label: "👥 多人" },
    solo: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", label: "👤 個人" },
    shared: { bg: "bg-zinc-500/10", text: "text-zinc-700 dark:text-zinc-400", label: "🧩 通用" },
  }[component.axis];

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg bg-card border"
      data-testid={`component-${component.pageType}`}
    >
      <Badge className={`${axisStyle.bg} ${axisStyle.text} flex-shrink-0`}>
        {axisStyle.label}
      </Badge>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{component.label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{component.role}</div>
      </div>
      {component.demoMode && (
        <Link href={`/showcase?demo=${component.demoMode}`}>
          <Button size="sm" variant="ghost" className="text-xs flex-shrink-0">
            試玩
          </Button>
        </Link>
      )}
    </div>
  );
}
