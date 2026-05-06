// 🎉 場域管理員首次登入引導
// ⚠️ 2026-04-24 hotfix: revert 到只用 localStorage 的版本（舊行為），
// 場域級標記 hasCompletedOnboarding 暫時停用，懷疑跟 React error #310 有關。
// 後端 GET /api/fields/:code/theme 仍回 hasCompletedOnboarding 欄位（無副作用），
// schema FieldSettings.hasCompletedOnboarding 也保留（未來可重新啟用）。
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  Sparkles,
  Gamepad2,
  Swords,
  DollarSign,
  Package,
  ArrowRight,
  Search,
  Store,
  Zap,
} from "lucide-react";

// 🆕 D2-b (2026-05-07)：bump 到 v2，加 30 分鐘建場捷徑步驟
//   舊使用者（v1 done）會再看一次新版 wizard，了解新流程
const STORAGE_KEY = "field_onboarding_done_v2";

interface Step {
  title: string;
  description: string;
  emoji: string;
  items?: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; desc: string }>;
  cta?: { label: string; href: string };
}

const STEPS: Step[] = [
  {
    title: "歡迎使用 CHITO SaaS",
    description: "讓我們用 4 步認識你的新管理後台",
    emoji: "🎉",
    items: [
      { icon: Gamepad2, label: "🎮 遊戲中心", desc: "建立、編輯、發布 QR Code 遊戲" },
      { icon: Swords, label: "⚔️ 對戰中心", desc: "水彈對戰場地與時段預約" },
      { icon: DollarSign, label: "💰 財務中心", desc: "收費、兌換碼、交易記錄" },
    ],
  },
  {
    title: "了解你的訂閱方案",
    description: "每個場域都有訂閱方案，決定可用的功能與配額",
    emoji: "💼",
    items: [
      { icon: Package, label: "我的方案", desc: "在「場域總部 → 我的方案」查看目前方案與用量" },
      { icon: DollarSign, label: "平台費用", desc: "訂閱費 + 交易抽成會在此結算" },
    ],
    cta: { label: "前往我的方案", href: "/admin/field/subscription" },
  },
  // 🆕 D2-b (2026-05-07)：30 分鐘建場捷徑 — 平台核心商業情境流程
  {
    title: "30 分鐘建一場活動 ⚡",
    description: "5 大商業情境（破冰／團建／婚禮／生日／頒獎）有現成模板，一鍵建場 + 列印 QR",
    emoji: "🚀",
    items: [
      { icon: Search, label: "1️⃣ 找情境", desc: "/find-scenario 用 3 個問題推薦最適合的情境模板" },
      { icon: Store, label: "2️⃣ 看模板", desc: "/template-market 瀏覽 12+ 個現成模板（婚禮、頒獎、破冰...）" },
      { icon: Zap, label: "3️⃣ 一鍵建場", desc: "點「使用此模板」自動建好 game + 場次、列印 QR 給玩家" },
    ],
    cta: { label: "🔍 3 問找情境", href: "/find-scenario" },
  },
  {
    title: "一切就緒！",
    description: "兩條建場路徑：用模板（30 分鐘）或從零開始（深度客製）",
    emoji: "✅",
    items: [
      { icon: Store, label: "推薦：模板市集", desc: "/template-market — 5 大情境一鍵建場、最快 30 分鐘 QR 上線" },
      { icon: Gamepad2, label: "進階：從零建立", desc: "/admin/games — 自己拖拉組合 60+ 種互動元件" },
      { icon: Sparkles, label: "按 ⌘K 快速跳轉", desc: "隨時搜尋任何功能頁面" },
    ],
    cta: { label: "📦 看模板市集", href: "/template-market" },
  },
];

export default function FieldOnboardingWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [, setLocation] = useLocation();
  const { isAuthenticated, admin } = useAdminAuth();

  useEffect(() => {
    if (!isAuthenticated || !admin) return;
    // 平台管理員 / super_admin 跳過（有自己的上手流程）
    if (admin.systemRole === "super_admin") return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // 略延遲 800ms 讓頁面先載入
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, admin]);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handleCTA = () => {
    const cta = STEPS[step].cta;
    if (cta) {
      handleClose();
      setLocation(cta.href);
    }
  };

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="text-center mb-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-rose-500 text-white text-2xl mb-3">
              {current.emoji}
            </div>
            <DialogTitle className="text-xl">{current.title}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {current.description}
            </p>
          </div>
          <Progress value={progress} className="h-1" />
        </DialogHeader>

        {/* 項目清單 */}
        {current.items && (
          <div className="space-y-2 py-4">
            {current.items.map((item, i) => {
              const Icon = item.icon;
              return (
                <Card key={i} className="p-3 border-0 bg-muted/50">
                  <div className="flex gap-3 items-start">
                    <div className="w-9 h-9 rounded-md bg-background flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 justify-between items-center pt-2">
          <span className="text-xs text-muted-foreground">
            {step + 1} / {STEPS.length}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              略過
            </Button>
            {current.cta && (
              <Button variant="outline" size="sm" onClick={handleCTA}>
                {current.cta.label}
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {step === STEPS.length - 1 ? "完成" : "下一步"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
