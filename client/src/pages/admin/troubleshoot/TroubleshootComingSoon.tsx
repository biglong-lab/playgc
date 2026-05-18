// 🆘 排解中心子頁 — Coming Soon 佔位（2026-05-19）
// Phase A 重組選單時、新群「排解」需要可點擊路由、但實際功能還在 Phase B-E
// 此頁顯示 coming-soon 訊息、避免 404 + 給業主預期感

import { useLocation } from "wouter";
import { LifeBuoy, ArrowLeft, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PAGE_INFO: Record<string, { title: string; desc: string; phase: string }> = {
  "/admin/troubleshoot": {
    title: "排解中心首頁",
    desc: "整合「遊戲重置 / 退款 / 預約調整 / 玩家補償」+ 今日異常 + 最近操作紀錄",
    phase: "Phase E",
  },
  "/admin/troubleshoot/reset": {
    title: "遊戲重置",
    desc: "客人遊戲過程出問題時、現場讓他重新來一次；需填原因、留紀錄、推 LINE 通知玩家",
    phase: "Phase C",
  },
  "/admin/troubleshoot/refund": {
    title: "退款處理",
    desc: "現場退款（現金）/ 線上退款（待金流帳號）；需填原因 + 退款方式 + 留 audit 紀錄",
    phase: "Phase D（等業主商戶帳號）",
  },
  "/admin/troubleshoot/booking": {
    title: "預約調整",
    desc: "改梯次 / 取消預約 / 強制核銷 — POS 已可用、此頁是 admin 端整合視圖",
    phase: "Phase E",
  },
  "/admin/troubleshoot/compensation": {
    title: "玩家補償",
    desc: "補券 / 補積分 / 補進度；給遊戲出狀況的玩家做事後補償",
    phase: "Phase E",
  },
  "/admin/troubleshoot/logs": {
    title: "排解紀錄",
    desc: "篩選 audit_logs 只顯示「排解類」操作（重置 / 退款 / 強制核銷 / 改梯次 / 補償）",
    phase: "Phase B+E",
  },
};

export default function TroubleshootComingSoon() {
  const [location, navigate] = useLocation();
  const info = PAGE_INFO[location] ?? {
    title: "排解功能",
    desc: "此頁正在規劃中",
    phase: "規劃中",
  };

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4 -ml-2">
        <ArrowLeft className="w-4 h-4 mr-1" />
        回儀表板
      </Button>

      <Card>
        <CardContent className="py-8 space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
            <LifeBuoy className="w-8 h-8 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>

          <h1 className="text-2xl font-bold">{info.title}</h1>

          <p className="text-muted-foreground max-w-md mx-auto">{info.desc}</p>

          <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 px-4 py-2 rounded-full text-sm text-amber-700 dark:text-amber-300">
            <Wrench className="w-4 h-4" />
            <span>實作階段：{info.phase}</span>
          </div>

          <div className="pt-4 text-xs text-muted-foreground space-y-1">
            <p>📋 業主 5/19 提出「整體選單重構 + 排解中心」需求</p>
            <p>✅ Phase A：選單重組（本頁）</p>
            <p>⏳ Phase B：審計覆蓋（所有現場操作留紀錄）</p>
            <p>⏳ Phase C：遊戲重置 API + UI</p>
            <p>⏳ Phase D：退款 API + UI（等金流）</p>
            <p>⏳ Phase E：排解中心整合首頁</p>
          </div>

          <div className="pt-4 flex gap-2 justify-center flex-wrap">
            <Button variant="outline" onClick={() => navigate("/pos")}>
              先去 POS 工作站
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin/audit-logs")}>
              看現有操作記錄
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
