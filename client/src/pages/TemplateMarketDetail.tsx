// 🎯 TemplateMarketDetail — 單一情境詳情頁
//
// 路徑：/template-market/:scenarioId
// 用途：完整介紹單一情境、列出元件、提供試玩入口、銷售 CTA

import { Link, useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, CheckCircle, Tv, Smartphone } from "lucide-react";
import { getScenarioById, type ScenarioComponent } from "@shared/scenario-templates";

export default function TemplateMarketDetail() {
  const [, params] = useRoute("/template-market/:scenarioId");
  const [, navigate] = useLocation();

  const scenarioId = params?.scenarioId;
  const scenario = scenarioId ? getScenarioById(scenarioId) : undefined;

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

        {/* CTA */}
        <section className="text-center space-y-4 py-6">
          <h3 className="font-display font-bold text-lg">看好了？開始建一個</h3>
          <p className="text-sm text-muted-foreground">
            建立 host session 後，將產生大螢幕投影網址 + 玩家手機端網址
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
                建立大螢幕場次
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
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
