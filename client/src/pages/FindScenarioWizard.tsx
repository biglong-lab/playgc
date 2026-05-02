// 🧭 FindScenarioWizard — 3 問找情境（W7 D3）
//
// 路徑：/find-scenario（公開頁）
// 用途：客戶不知道要選哪個情境時的引導工具 — 3 題答完推薦 Top 3
//
// 演算法（簡單 score-based）：
//   - 答案 1（活動類型）→ category 完全匹配 +5、相鄰 +1
//   - 答案 2（人數）→ 與情境 estimatedPlayers 比對 +3
//   - 答案 3（重點）→ 與情境特定元件對應 +2
// 取分數最高 Top 3

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ArrowRight, Sparkles, Users, Target, Compass,
  Heart, PartyPopper, Building2, Briefcase, Home,
} from "lucide-react";
import {
  SCENARIO_TEMPLATES,
  type ScenarioTemplate,
  type ScenarioCategory,
} from "@shared/scenario-templates";

type SizeBucket = "small" | "medium" | "large";
type Focus = "memory" | "engagement" | "trivia" | "exploration";

interface WizardAnswers {
  category: ScenarioCategory | null;
  size: SizeBucket | null;
  focus: Focus | null;
}

interface ScoredScenario {
  scenario: ScenarioTemplate;
  score: number;
  reasons: string[];
}

const CATEGORIES: Array<{
  value: ScenarioCategory;
  label: string;
  icon: typeof Heart;
  desc: string;
}> = [
  { value: "social", label: "交誼活動", icon: Heart, desc: "婚禮 / 生日 / 同學會 / 親子" },
  { value: "event", label: "公開活動", icon: PartyPopper, desc: "園遊會 / 破冰 / 頒獎" },
  { value: "public", label: "公部門 / 商圈", icon: Building2, desc: "街區走讀 / 商圈打卡" },
  { value: "corporate", label: "企業內部", icon: Briefcase, desc: "內訓 / 員工旅遊" },
  { value: "venue", label: "空間場域", icon: Home, desc: "民宿 / 主題館 / 博物館" },
];

const SIZES: Array<{ value: SizeBucket; label: string; desc: string; emoji: string }> = [
  { value: "small", label: "小型", desc: "30 人以下、親密聚會", emoji: "👥" },
  { value: "medium", label: "中型", desc: "30-100 人、企業 / 班級規模", emoji: "🎉" },
  { value: "large", label: "大型", desc: "100 人以上、公開活動", emoji: "🎪" },
];

const FOCUSES: Array<{ value: Focus; label: string; desc: string; icon: typeof Heart }> = [
  { value: "memory", label: "紀念回憶", desc: "拍立得、簽名簿、合照", icon: Heart },
  { value: "engagement", label: "全場互動", desc: "投票、emoji 池、應援", icon: Sparkles },
  { value: "trivia", label: "知識競賽", desc: "搶答、排行榜、跑馬燈", icon: Target },
  { value: "exploration", label: "場域探索", desc: "GPS、尋寶、地圖", icon: Compass },
];

/** 推薦演算法 */
function scoreScenarios(answers: WizardAnswers): ScoredScenario[] {
  return SCENARIO_TEMPLATES.map((s) => {
    let score = 0;
    const reasons: string[] = [];

    // 1️⃣ 分類匹配
    if (answers.category && s.category === answers.category) {
      score += 5;
      reasons.push(`✅ 分類符合（${s.category}）`);
    }

    // 2️⃣ 人數匹配
    if (answers.size) {
      const players = s.estimatedPlayers;
      const matched =
        (answers.size === "small" && (/\b(\d+)-?\d*/.exec(players)?.[1] ?? "100") <= "50") ||
        (answers.size === "medium" && /50-100|30-|100|80/.test(players)) ||
        (answers.size === "large" && /100-|200|500|1000|大型|觀眾/.test(players));
      if (matched) {
        score += 3;
        reasons.push(`✅ 人數規模匹配`);
      }
    }

    // 3️⃣ 重點匹配（用 components 中的 pageType 推導）
    if (answers.focus) {
      const pageTypes = s.components.map((c) => c.pageType);
      const focusMatch: Record<Focus, (pt: string) => boolean> = {
        memory: (pt) =>
          /polaroid|guestbook|photo/.test(pt),
        engagement: (pt) =>
          /emoji_react|wave_response|poll_live|crowd_gather/.test(pt),
        trivia: (pt) =>
          /trivia|leaderboard|scoreboard|choice_verify_race/.test(pt),
        exploration: (pt) =>
          /gps|treasure|knowledge_map|territory/.test(pt),
      };
      const hits = pageTypes.filter(focusMatch[answers.focus]).length;
      if (hits > 0) {
        score += 2 * hits;
        reasons.push(`✅ ${hits} 個元件符合「${FOCUSES.find((f) => f.value === answers.focus)?.label}」`);
      }
    }

    // 預設加分：live 狀態優先
    if (s.status === "live") score += 0.5;

    return { scenario: s, score, reasons };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

export default function FindScenarioWizard() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<WizardAnswers>({
    category: null,
    size: null,
    focus: null,
  });

  const recommendations = step === 4 ? scoreScenarios(answers).slice(0, 3) : [];

  const reset = () => {
    setStep(1);
    setAnswers({ category: null, size: null, focus: null });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b safe-top">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/template-market">
              <button className="p-2 hover:bg-muted rounded-lg" data-testid="btn-back">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="font-display font-bold text-lg">🧭 3 問找情境</h1>
              <p className="text-xs text-muted-foreground">
                {step <= 3 ? `第 ${step} / 3 題` : "推薦結果"}
              </p>
            </div>
          </div>
          {step <= 3 && (
            <div className="flex gap-1">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className={`w-2 h-2 rounded-full ${
                    s < step ? "bg-primary" : s === step ? "bg-primary/50" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {step === 1 && (
          <Question
            stepLabel="第 1 / 3 題"
            title="你要辦什麼類型的活動？"
            options={CATEGORIES.map((c) => ({
              value: c.value,
              label: c.label,
              desc: c.desc,
              icon: c.icon,
            }))}
            selected={answers.category}
            onSelect={(v) => {
              setAnswers({ ...answers, category: v as ScenarioCategory });
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
          <Question
            stepLabel="第 2 / 3 題"
            title="預估參與人數？"
            options={SIZES.map((s) => ({
              value: s.value,
              label: `${s.emoji} ${s.label}`,
              desc: s.desc,
            }))}
            selected={answers.size}
            onSelect={(v) => {
              setAnswers({ ...answers, size: v as SizeBucket });
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <Question
            stepLabel="第 3 / 3 題"
            title="這場活動最重要的是？"
            options={FOCUSES.map((f) => ({
              value: f.value,
              label: f.label,
              desc: f.desc,
              icon: f.icon,
            }))}
            selected={answers.focus}
            onSelect={(v) => {
              setAnswers({ ...answers, focus: v as Focus });
              setStep(4);
            }}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <Sparkles className="w-12 h-12 mx-auto text-primary" />
              <h2 className="text-2xl md:text-3xl font-display font-bold">
                為你推薦 {recommendations.length} 個情境
              </h2>
              <p className="text-sm text-muted-foreground">
                依你的答案計算最合適的組合
              </p>
            </div>

            {recommendations.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center space-y-3">
                  <p className="text-sm">沒找到完全匹配的情境</p>
                  <Button onClick={reset} variant="outline">
                    重新回答
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-3">
                  {recommendations.map((rec, idx) => (
                    <Card
                      key={rec.scenario.id}
                      className={`bg-gradient-to-br ${rec.scenario.gradient} border-0 cursor-pointer hover:shadow-lg transition-shadow`}
                      onClick={() => navigate(`/template-market/${rec.scenario.id}`)}
                      data-testid={`recommendation-${rec.scenario.id}`}
                    >
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <Badge className="mb-1 bg-primary/20 text-primary">
                              {idx === 0 ? "🥇 最佳匹配" : idx === 1 ? "🥈 次選" : "🥉 第三推薦"}
                            </Badge>
                            <h3 className="text-lg md:text-xl font-display font-bold">
                              {rec.scenario.name}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {rec.scenario.tagline}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-xl font-bold text-primary">
                              {rec.score.toFixed(0)}
                            </div>
                            <div className="text-xs text-muted-foreground">分</div>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs">
                          {rec.reasons.map((reason, i) => (
                            <div key={i}>{reason}</div>
                          ))}
                        </div>

                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          {rec.scenario.estimatedPlayers} · {rec.scenario.estimatedDuration}
                        </div>

                        <Button size="sm" variant="default" className="w-full">
                          查看完整介紹 <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={reset} data-testid="btn-restart">
                    重新回答
                  </Button>
                  <Link href="/template-market">
                    <Button variant="outline" data-testid="btn-all-scenarios">
                      看全部 12 情境
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

interface QuestionOption {
  value: string;
  label: string;
  desc: string;
  icon?: typeof Heart;
}

function Question({
  stepLabel,
  title,
  options,
  selected,
  onSelect,
  onBack,
}: {
  stepLabel: string;
  title: string;
  options: QuestionOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  onBack?: () => void;
}) {
  return (
    <div className="space-y-6" data-testid={`step-${stepLabel}`}>
      <div className="text-center space-y-2">
        <p className="text-xs font-display uppercase tracking-wider text-muted-foreground">
          {stepLabel}
        </p>
        <h2 className="text-2xl md:text-3xl font-display font-bold">{title}</h2>
      </div>

      <div className="space-y-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.value;
          return (
            <Card
              key={opt.value}
              className={`cursor-pointer transition-all ${
                isSelected ? "border-primary shadow-md" : "hover:border-primary/40"
              }`}
              onClick={() => onSelect(opt.value)}
              data-testid={`option-${opt.value}`}
            >
              <CardContent className="p-4 flex items-center gap-3">
                {Icon && (
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {onBack && (
        <div className="flex justify-start">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            上一題
          </Button>
        </div>
      )}
    </div>
  );
}
