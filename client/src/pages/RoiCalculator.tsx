// 💰 ROI Calculator — 公開 ROI 試算頁（W17 D3）
//
// 路徑：/roi
// 用途：客戶填參數試算「省下時間 / 互動率提升 / ROI」、業務殺手級工具
//
// 計算依據：
//   - 籌備時間：手動 5-10h vs 平台 1h
//   - 互動率：純致詞 30% vs 互動環節 75%（業界研究）
//   - 傳播率：純拍照 IG 發 10% vs 互動內容 40%
//   - ROI = 產出 / 投入

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  TrendingUp,
  Clock,
  Users,
  Sparkles,
  ArrowRight,
  Calculator,
} from "lucide-react";

type ActivityType = "wedding" | "reunion" | "corporate" | "district" | "icebreaker";

interface ActivityProfile {
  label: string;
  emoji: string;
  /** 手動籌備時間（小時）*/
  manualHours: number;
  /** 平台建場時間（小時）*/
  platformHours: number;
  /** 純活動互動率（%）*/
  baselineEngagement: number;
  /** 用平台互動率（%）*/
  platformEngagement: number;
  /** 每位來賓互動價值（元）*/
  perGuestValue: number;
}

const ACTIVITY_PROFILES: Record<ActivityType, ActivityProfile> = {
  wedding: {
    label: "婚禮",
    emoji: "💒",
    manualHours: 8,
    platformHours: 1,
    baselineEngagement: 35,
    platformEngagement: 80,
    perGuestValue: 150,
  },
  reunion: {
    label: "同學會 / 聚會",
    emoji: "🎓",
    manualHours: 5,
    platformHours: 1,
    baselineEngagement: 40,
    platformEngagement: 75,
    perGuestValue: 100,
  },
  corporate: {
    label: "企業內訓 / 員工旅遊",
    emoji: "💼",
    manualHours: 10,
    platformHours: 1.5,
    baselineEngagement: 30,
    platformEngagement: 75,
    perGuestValue: 200,
  },
  district: {
    label: "街區 / 商圈活動",
    emoji: "🏛",
    manualHours: 15,
    platformHours: 2,
    baselineEngagement: 20,
    platformEngagement: 65,
    perGuestValue: 80,
  },
  icebreaker: {
    label: "破冰 / 熱場",
    emoji: "❄️",
    manualHours: 4,
    platformHours: 0.5,
    baselineEngagement: 45,
    platformEngagement: 85,
    perGuestValue: 80,
  },
};

const HOURLY_RATE = 500; // 籌備時薪估值

export default function RoiCalculator() {
  const [activityType, setActivityType] = useState<ActivityType>("wedding");
  const [guestCount, setGuestCount] = useState(50);
  const [budget, setBudget] = useState(8000);

  const profile = ACTIVITY_PROFILES[activityType];

  const result = useMemo(() => {
    const timeSaved = profile.manualHours - profile.platformHours;
    const timeSavedValue = timeSaved * HOURLY_RATE;

    const engagementGain = profile.platformEngagement - profile.baselineEngagement;
    const engagementGuests = Math.round(guestCount * (engagementGain / 100));
    const engagementValue = engagementGuests * profile.perGuestValue;

    const totalGain = timeSavedValue + engagementValue;
    const roi = budget > 0 ? totalGain / budget : 0;
    const roiText = roi >= 1 ? `1 : ${roi.toFixed(1)}` : "投資回報期內";

    return {
      timeSaved,
      timeSavedValue,
      engagementGain,
      engagementGuests,
      engagementValue,
      totalGain,
      roi,
      roiText,
    };
  }, [profile, guestCount, budget]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              首頁
            </Button>
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-amber-600" />
            ROI 試算
          </h1>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">這場活動值得用平台嗎？</h2>
          <p className="text-slate-600">
            填 3 個參數、即時試算節省時間 / 互動價值 / ROI
          </p>
        </div>

        {/* Inputs */}
        <Card className="mb-6">
          <CardContent className="p-6 space-y-6">
            {/* 活動類型 */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                活動類型
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {(Object.entries(ACTIVITY_PROFILES) as [ActivityType, ActivityProfile][]).map(
                  ([key, p]) => (
                    <button
                      key={key}
                      onClick={() => setActivityType(key)}
                      className={`p-3 rounded-lg border-2 text-sm transition-all ${
                        activityType === key
                          ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                      data-testid={`roi-activity-${key}`}
                    >
                      <div className="text-2xl mb-1">{p.emoji}</div>
                      <div className="font-medium">{p.label}</div>
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* 人數 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">
                  <Users className="w-4 h-4 inline mr-1" />
                  預估人數
                </label>
                <Badge variant="secondary" className="text-base">
                  {guestCount} 人
                </Badge>
              </div>
              <Slider
                min={10}
                max={500}
                step={10}
                value={[guestCount]}
                onValueChange={(v) => setGuestCount(v[0])}
                data-testid="roi-guest-slider"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>10</span>
                <span>500</span>
              </div>
            </div>

            {/* 預算 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">
                  💰 預算（含活動費）
                </label>
                <Badge variant="secondary" className="text-base">
                  NT$ {budget.toLocaleString()}
                </Badge>
              </div>
              <Slider
                min={3000}
                max={200000}
                step={1000}
                value={[budget]}
                onValueChange={(v) => setBudget(v[0])}
                data-testid="roi-budget-slider"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>NT$ 3,000</span>
                <span>NT$ 200,000</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        <Card className="mb-6 border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <Badge className="bg-amber-600 mb-2">即時試算結果</Badge>
              <h3 className="text-2xl font-bold text-amber-900">
                {profile.emoji} {profile.label}（{guestCount} 人）
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 border">
                <div className="flex items-center gap-2 text-slate-700 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">節省時間</span>
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  {result.timeSaved} 小時
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  ≈ NT$ {result.timeSavedValue.toLocaleString()}
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border">
                <div className="flex items-center gap-2 text-slate-700 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="font-medium">互動率提升</span>
                </div>
                <div className="text-3xl font-bold text-green-600">
                  +{result.engagementGain}%
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  ≈ {result.engagementGuests} 位來賓更投入
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border">
                <div className="flex items-center gap-2 text-slate-700 mb-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <span className="font-medium">互動價值</span>
                </div>
                <div className="text-3xl font-bold text-purple-600">
                  NT$ {result.engagementValue.toLocaleString()}
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  記憶 / 傳播 / 品牌延伸
                </div>
              </div>
            </div>

            {/* 總結 */}
            <div className="bg-amber-100 rounded-lg p-6 text-center">
              <div className="text-sm text-amber-900 mb-2">總價值產出</div>
              <div className="text-4xl font-bold text-amber-900 mb-1">
                NT$ {result.totalGain.toLocaleString()}
              </div>
              <div className="text-sm text-amber-800 mb-3">
                vs 投入 NT$ {budget.toLocaleString()}
              </div>
              <div className="inline-block bg-amber-600 text-white text-2xl font-bold px-4 py-2 rounded-lg">
                ROI {result.roiText}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 來源說明 */}
        <Card className="mb-6 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-700 mb-2">📊 試算依據</p>
            <ul className="space-y-1 text-xs">
              <li>• 籌備時間：手動辦活動需 4-15h 設計遊戲環節 + 印製物 + 音效安排；用平台模板 0.5-2h 建好</li>
              <li>• 互動率：純致詞 / 餐宴 30-45%；加互動環節 65-85%（業界研究 + 我們實驗數據）</li>
              <li>• 籌備時薪：估 NT$ 500（含時間 + 心力 + 出錯成本）</li>
              <li>• 互動價值：每位來賓 NT$ 80-200（含記憶 + 口碑傳播 + 後續曝光）</li>
            </ul>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-bold mb-2">數字看起來不錯？</h3>
            <p className="text-slate-600 mb-4">
              下一步：找情境 → 看價格 → 開始第一場活動
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/find-scenario">
                <Button size="lg">
                  <Sparkles className="w-4 h-4 mr-1" />
                  3 問找情境
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline">
                  查看價格
                </Button>
              </Link>
              <Link href="/faq">
                <Button size="lg" variant="ghost">
                  常見問題
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
