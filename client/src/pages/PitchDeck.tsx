// 🎤 PitchDeck — 客戶銷售簡報頁（W7 D4）
//
// 路徑：/pitch（公開）
// 用途：業務拿手機 / 平板 / 桌機點開即可講解 — 客戶看完直接跳轉到 wizard / 詳情頁
//
// 設計原則：
//   - 一頁式 scroll narrative，重點清楚
//   - 大字、大 CTA、適合手機展示
//   - 4 個關鍵章節：問題 → 解決方案 → 情境組合 → 收費

import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ArrowRight, Sparkles, Zap, Heart, PartyPopper,
  Building2, Briefcase, Home, CheckCircle, X, Tv, Users,
  Smartphone, Trophy, MapPin, Camera,
} from "lucide-react";
import { SCENARIO_TEMPLATES, SCENARIO_CATEGORY_LABELS, type ScenarioCategory } from "@shared/scenario-templates";

const CATEGORY_ICONS: Record<ScenarioCategory, typeof Heart> = {
  social: Heart,
  event: PartyPopper,
  public: Building2,
  corporate: Briefcase,
  venue: Home,
};

export default function PitchDeck() {
  const stats = {
    scenarios: SCENARIO_TEMPLATES.length,
    components: 25, // 約略：HostScreen 10 + Multi 13 + 2 通用代表
    liveScenarios: SCENARIO_TEMPLATES.filter((s) => s.status === "live").length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      {/* Sticky toolbar（列印時隱藏）*/}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b safe-top print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="p-2 hover:bg-muted rounded-lg" data-testid="btn-back-home">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="font-display font-bold text-lg">🎤 我們能幫你的場域做什麼</h1>
              <p className="text-xs text-muted-foreground">CHITO 平台介紹簡報</p>
            </div>
          </div>
          <Link href="/find-scenario">
            <Button size="sm" data-testid="btn-find-scenario-pitch">
              <Sparkles className="w-4 h-4 mr-1" />
              開始
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-16">
        {/* ════════ Section 1: Hero Problem ════════ */}
        <section className="text-center space-y-6 py-10">
          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 mb-2">
            活動主辦方常見痛點
          </Badge>
          <h1 className="text-3xl md:text-5xl font-display font-bold">
            場地有了、人來了
            <br />
            <span className="text-rose-600">但氣氛不對、沒互動、沒紀念</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            園遊會冷場 / 婚禮乾巴巴只剩拍照 / 街區走馬看花 / 員工內訓昏昏欲睡<br />
            <span className="text-foreground font-medium">問題不是內容差，是缺一個「讓全場參與的工具」</span>
          </p>
        </section>

        {/* ════════ Section 2: Solution ════════ */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              我們的解法
            </Badge>
            <h2 className="text-2xl md:text-4xl font-display font-bold">
              一個平台，<span className="text-primary">所有場合都能用</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureCard
              icon={Tv}
              title="📺 大螢幕主控"
              desc="投影機接上、玩家手機掃 QR、全場互動實時更新 — 投票、emoji、應援、排行"
              accent="from-blue-500/20 to-cyan-500/20"
            />
            <FeatureCard
              icon={Users}
              title="👥 隊伍協作"
              desc="拼圖、尋寶、GPS 任務、角色扮演 — 親子家庭、企業團建、劇本殺都適用"
              accent="from-purple-500/20 to-indigo-500/20"
            />
            <FeatureCard
              icon={Trophy}
              title="🏆 紀念回顧"
              desc="拍立得牆、簽名簿、合照集 — 活動結束後仍是新人 / 主辦方珍藏的紀念"
              accent="from-amber-500/20 to-orange-500/20"
            />
          </div>
        </section>

        {/* ════════ Section 3: 12 Scenarios Stats ════════ */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <Badge className="bg-primary/10 text-primary">情境模板</Badge>
            <h2 className="text-2xl md:text-4xl font-display font-bold">
              {stats.scenarios} 個預組情境，覆蓋 5 大市場
            </h2>
            <p className="text-sm md:text-base text-muted-foreground">
              選一個適合你的場合，10 分鐘搞定建場 + QR 列印
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(["social", "event", "public", "corporate", "venue"] as ScenarioCategory[]).map(
              (cat) => {
                const scenarios = SCENARIO_TEMPLATES.filter((s) => s.category === cat);
                const Icon = CATEGORY_ICONS[cat];
                return (
                  <Link key={cat} href="/template-market">
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {scenarios.length} 個情境
                          </div>
                        </div>
                        <div className="font-semibold text-sm">
                          {SCENARIO_CATEGORY_LABELS[cat].replace(/^[🏛💼🎉🏠💝]\s*/, "")}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {scenarios.map((s) => s.name).join(" / ")}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              },
            )}
          </div>
        </section>

        {/* ════════ Section 4: 流程示意 ════════ */}
        <section className="space-y-8 bg-muted/30 -mx-4 px-4 py-12 rounded-2xl">
          <div className="text-center space-y-2">
            <Badge>How it works</Badge>
            <h2 className="text-2xl md:text-4xl font-display font-bold">
              主辦方流程：<span className="text-primary">10 分鐘搞定</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <FlowStep n="1" title="3 問找情境" desc="不知道選什麼？答 3 題推薦" link="/find-scenario" />
            <FlowStep n="2" title="看詳情" desc="情境組合 + 商業價值" link="/template-market" />
            <FlowStep n="3" title="一鍵建場" desc="自動建 game + session" />
            <FlowStep n="4" title="列印 QR" desc="A4 印好貼現場" />
            <FlowStep n="5" title="現場執行" desc="全場互動實時更新" />
          </div>
        </section>

        {/* ════════ Section 5: 收費 ════════ */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <Badge>收費區間</Badge>
            <h2 className="text-2xl md:text-4xl font-display font-bold">
              彈性收費，依情境規模
            </h2>
            <p className="text-sm text-muted-foreground">
              一次性活動 / 長期訂閱皆可，依場域規模議價
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PriceCard
              tier="一次性活動"
              priceRange="NT$ 3,000-30,000"
              perWhat="/ 場"
              examples={["婚禮派對", "破冰熱場", "員工旅遊", "頒獎典禮"]}
              highlight={false}
            />
            <PriceCard
              tier="長期訂閱"
              priceRange="NT$ 1,500-5,000"
              perWhat="/ 月"
              examples={["民宿故事館", "親子主題館", "企業內訓 SaaS", "商圈聯合"]}
              highlight={true}
            />
            <PriceCard
              tier="季度委辦"
              priceRange="NT$ 80,000-200,000"
              perWhat="/ 季"
              examples={["公部門活化", "觀光局街區", "教育單位"]}
              highlight={false}
            />
          </div>
        </section>

        {/* ════════ Section 6: 對比 ════════ */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <Badge variant="outline">為什麼選 CHITO</Badge>
            <h2 className="text-2xl md:text-4xl font-display font-bold">
              對比其他做法
            </h2>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-3 font-semibold">需求</th>
                      <th className="text-center p-3">自己手作</th>
                      <th className="text-center p-3">客製外包</th>
                      <th className="text-center p-3 bg-primary/10 text-primary font-semibold">
                        CHITO 平台
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-xs md:text-sm">
                    <CompareRow label="開發時間" self="2-4 週" custom="4-8 週" us="< 10 分鐘" />
                    <CompareRow label="開發成本" self="人力 N×小時" custom="NT$ 50,000+" us="月費 / 場費" />
                    <CompareRow label="可重用性" self="✗ 一次性" custom="✗ 客製化" us="✓ 11 情境通用" />
                    <CompareRow label="維護負擔" self="✗ 自己處理" custom="✗ 外包改一次又一次" us="✓ 平台維護" />
                    <CompareRow label="情境覆蓋" self="窄" custom="窄" us="廣（5 大市場）" />
                    <CompareRow label="現場可用性" self="✗ 通常 demo 不穩定" custom="✗ 修 bug 緩慢" us="✓ 生產級穩定" />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ════════ Section 7: CTA ════════ */}
        <section className="text-center space-y-6 py-10 bg-gradient-to-br from-primary/10 to-primary/5 -mx-4 px-4 rounded-2xl">
          <h2 className="text-2xl md:text-4xl font-display font-bold">
            開始辦一場<span className="text-primary">記得住的活動</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            從 3 問找情境開始，5 分鐘決定方案、10 分鐘建好場、現場開玩
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/find-scenario">
              <Button size="lg" data-testid="cta-pitch-find-scenario">
                <Sparkles className="w-4 h-4 mr-1" />
                3 問找情境
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link href="/template-market">
              <Button size="lg" variant="outline" data-testid="cta-pitch-templates">
                看 12 個情境模板
              </Button>
            </Link>
            <Link href="/showcase">
              <Button size="lg" variant="ghost" data-testid="cta-pitch-showcase">
                先試玩元件
              </Button>
            </Link>
            <Link href="/faq">
              <Button size="lg" variant="ghost" data-testid="cta-pitch-faq">
                常見問題
              </Button>
            </Link>
            <Link href="/roi">
              <Button size="lg" variant="ghost" data-testid="cta-pitch-roi">
                💰 ROI 試算
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        CHITO · 數位遊戲平台 · 5 大市場、12 情境、25 元件
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  accent,
}: {
  icon: typeof Heart;
  title: string;
  desc: string;
  accent: string;
}) {
  return (
    <Card className={`bg-gradient-to-br ${accent} border-0`}>
      <CardContent className="p-5 space-y-3">
        <div className="w-12 h-12 rounded-xl bg-white/40 dark:bg-black/20 flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="font-display font-bold text-lg">{title}</h3>
        <p className="text-sm leading-relaxed">{desc}</p>
      </CardContent>
    </Card>
  );
}

function FlowStep({
  n,
  title,
  desc,
  link,
}: {
  n: string;
  title: string;
  desc: string;
  link?: string;
}) {
  const inner = (
    <Card
      className={`bg-card text-center h-full transition-all ${link ? "cursor-pointer hover:shadow-md hover:border-primary/40" : ""}`}
    >
      <CardContent className="p-4 space-y-2">
        <div className="text-2xl font-display font-bold text-primary">{n}</div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </CardContent>
    </Card>
  );
  return link ? <Link href={link}>{inner}</Link> : inner;
}

function PriceCard({
  tier,
  priceRange,
  perWhat,
  examples,
  highlight,
}: {
  tier: string;
  priceRange: string;
  perWhat: string;
  examples: string[];
  highlight: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary border-2 shadow-lg relative" : ""}>
      <CardContent className="p-5 space-y-3">
        {highlight && (
          <Badge className="absolute -top-2 -right-2 bg-primary">推薦</Badge>
        )}
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          {tier}
        </div>
        <div>
          <div className="text-xl md:text-2xl font-display font-bold text-primary">
            {priceRange}
          </div>
          <div className="text-xs text-muted-foreground">{perWhat}</div>
        </div>
        <div className="space-y-1.5 pt-2 border-t">
          {examples.map((ex) => (
            <div key={ex} className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span>{ex}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CompareRow({
  label,
  self,
  custom,
  us,
}: {
  label: string;
  self: string;
  custom: string;
  us: string;
}) {
  return (
    <tr className="border-b">
      <td className="p-3 font-medium">{label}</td>
      <td className="p-3 text-center text-muted-foreground">{self}</td>
      <td className="p-3 text-center text-muted-foreground">{custom}</td>
      <td className="p-3 text-center bg-primary/5 font-semibold text-primary">
        {us}
      </td>
    </tr>
  );
}
