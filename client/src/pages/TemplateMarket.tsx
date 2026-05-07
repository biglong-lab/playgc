// 🎯 TemplateMarket — 12 情境模板市集（W6 D1）
//
// 路徑：/template-market（公開頁）
// 用途：客戶銷售工具、業務簡報、讓使用者一眼看到「這個場景要怎麼組合」
//
// 與 /showcase 的分工：
//   - /showcase：單一元件試玩（雙版型、demo 用本地 state）
//   - /template-market：完整情境組合（多元件）+ 商業價值描述

import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Sparkles, Tv, Users, Gift } from "lucide-react";
import {
  SCENARIO_TEMPLATES,
  SCENARIO_CATEGORY_LABELS,
  type ScenarioCategory,
  type ScenarioTemplate,
} from "@shared/scenario-templates";

const CATEGORIES: ScenarioCategory[] = [
  "social",
  "event",
  "public",
  "corporate",
  "venue",
];

export default function TemplateMarket() {
  const [, navigate] = useLocation();

  const liveCount = SCENARIO_TEMPLATES.filter((s) => s.status === "live").length;
  const previewCount = SCENARIO_TEMPLATES.filter((s) => s.status === "preview").length;
  const plannedCount = SCENARIO_TEMPLATES.filter((s) => s.status === "planned").length;

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
              <h1 className="font-display font-bold text-lg">🎯 12 情境模板市集</h1>
              <p className="text-xs text-muted-foreground">
                {liveCount} 個可用 · {previewCount} 預覽 · {plannedCount} 規劃中
              </p>
            </div>
          </div>
          <Link href="/showcase">
            <Button size="sm" variant="outline" data-testid="link-showcase">
              <Sparkles className="w-4 h-4 mr-1" />
              元件試玩
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-12">
        {/* Hero */}
        <section className="text-center space-y-4 py-8">
          <h2 className="text-3xl md:text-5xl font-display font-bold">
            一個情境，<span className="text-primary">一鍵變活動</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            12 個預組好的情境模板 — 婚禮、園遊會、街區、企業、空間
            <br />
            選一個適合你的場合，套用後即可上線
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Badge variant="secondary" className="gap-1.5">
              <Tv className="w-3 h-3" />
              大螢幕
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              <Users className="w-3 h-3" />
              玩家手機
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              <Gift className="w-3 h-3" />
              紀念回顧
            </Badge>
          </div>

          {/* 3 問找情境 CTA（W7 D3）*/}
          <div className="pt-4">
            <Link href="/find-scenario">
              <Button size="lg" variant="outline" className="border-primary/40" data-testid="btn-find-scenario-cta">
                <Sparkles className="w-4 h-4 mr-1" />
                不知道選哪個？3 問找情境
              </Button>
            </Link>
          </div>
        </section>

        {/* 5 大分類 */}
        {CATEGORIES.map((category) => {
          const scenarios = SCENARIO_TEMPLATES.filter((s) => s.category === category);
          if (scenarios.length === 0) return null;
          return (
            <section key={category} className="space-y-4" data-testid={`section-${category}`}>
              <h2 className="text-xl md:text-2xl font-display font-bold">
                {SCENARIO_CATEGORY_LABELS[category]}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{/* 🆕 RWD：sm 兩欄、lg 三欄 */}
                {scenarios.map((scenario) => (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    onClick={() => navigate(`/template-market/${scenario.id}`)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* 收尾 */}
        <section className="text-center py-10 space-y-4 border-t mt-12">
          <h3 className="text-2xl font-display font-bold">看完情境，準備來建一個？</h3>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            目前情境模板提供「視覺與元件組合預覽」，正式上線後可直接套用建立 host session +
            玩家入口 — Phase 2 W7 完成自動化建場功能。
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/showcase">
              <Button variant="outline">
                <Sparkles className="w-4 h-4 mr-1" />
                先看單一元件試玩
              </Button>
            </Link>
            <Link href="/admin/host-sessions">
              <Button>
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

interface ScenarioCardProps {
  scenario: ScenarioTemplate;
  onClick: () => void;
}

function ScenarioCard({ scenario, onClick }: ScenarioCardProps) {
  const statusColor =
    scenario.status === "live"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : scenario.status === "preview"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400";

  const statusLabel =
    scenario.status === "live" ? "可用" : scenario.status === "preview" ? "預覽" : "規劃中";

  return (
    <Card
      className={`bg-gradient-to-br ${scenario.gradient} border-0 hover:shadow-lg transition-shadow cursor-pointer`}
      onClick={onClick}
      data-testid={`card-scenario-${scenario.id}`}
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="font-display font-bold text-lg">{scenario.name}</h3>
            <p className="text-sm text-muted-foreground">{scenario.tagline}</p>
          </div>
          <Badge className={`${statusColor} flex-shrink-0`}>{statusLabel}</Badge>
        </div>

        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>👥 {scenario.estimatedPlayers}</div>
          <div>⏱ {scenario.estimatedDuration}</div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {scenario.components.slice(0, 4).map((c) => (
            <Badge key={c.pageType} variant="outline" className="text-xs">
              {c.label}
            </Badge>
          ))}
          {scenario.components.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{scenario.components.length - 4}
            </Badge>
          )}
        </div>

        <div className="text-xs text-muted-foreground italic line-clamp-2">
          💼 {scenario.valueProposition}
        </div>

        <Button size="sm" className="w-full" variant="default">
          看詳情 + 試玩元件 <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
