// 🆘 排解中心首頁（2026-05-19 Phase E）
//
// 取代 /admin/troubleshoot 佔位頁。
// 三大區塊：
//   1. 4 大快速入口（重置 / 退款 / 改梯次 / 補償）
//   2. 今日異常清單（cancelled-paid / no_show-paid / 卡住的 sessions）
//   3. 最近排解操作（過濾 audit_logs）

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Receipt,
  Calendar,
  Users,
  LifeBuoy,
  AlertTriangle,
  Clock,
  ScrollText,
  User,
  ExternalLink,
} from "lucide-react";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface DashboardResp {
  stats: {
    abnormalBookings: number;
    resetSessions: number;
    stuckSessions: number;
    recentTroubleshootActions: number;
  };
  abnormalBookings: Array<{
    id: number;
    bookingCode: string;
    displayName: string | null;
    phone: string | null;
    slotStart: string;
    status: string;
    paymentStatus: string;
    paidAt: string | null;
    amountCents: number;
    checkedInAt: string | null;
  }>;
  resetSessions: Array<{
    id: string;
    teamName: string | null;
    playerName: string | null;
    status: string;
    resetCount: number;
    startedAt: string;
    gameName: string | null;
  }>;
  stuckSessions: Array<{
    id: string;
    teamName: string | null;
    playerName: string | null;
    startedAt: string;
    gameName: string | null;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    adminUsername: string | null;
    adminDisplayName: string | null;
  }>;
}

const ACTION_LABELS: Record<string, string> = {
  "pos:force_checkin": "強制核銷",
  "booking:reschedule": "改梯次",
  "booking:cancel_admin": "業主取消預約",
  "booking:mark_no_show_admin": "標記未到",
  "session:reset": "重置場次",
  "session:bulk_abandon": "批次清理場次",
  "purchase:refund": "撤銷購買",
  "reward:manual_issue": "手動發券",
  "activity:deactivate": "停用活動",
  "redeem_code:delete": "刪除兌換碼",
};

export default function TroubleshootDashboard() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<DashboardResp>({
    queryKey: ["/api/admin/troubleshoot/dashboard"],
    queryFn: () => fetchWithAdminAuth("/api/admin/troubleshoot/dashboard"),
    refetchInterval: 30_000, // 每 30 秒刷新異常清單
  });

  return (
    <UnifiedAdminLayout title="🆘 排解中心">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header 卡 */}
        <Card className="border-red-200 dark:border-red-900/50">
          <CardContent className="py-4 flex items-start gap-3">
            <LifeBuoy className="w-8 h-8 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-lg">客人現場出問題？從這裡處理</h2>
              <p className="text-sm text-muted-foreground mt-1">
                所有操作都會留時間 + 操作者紀錄、可在「最近操作」查閱
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4 大入口 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionCard
            icon={<RefreshCw className="w-6 h-6" />}
            title="遊戲重置"
            desc="斷網 / 卡 bug / 中斷"
            color="red"
            onClick={() => navigate("/admin/troubleshoot/reset")}
            badge={data?.stats.resetSessions ? `${data.stats.resetSessions} 次` : null}
          />
          <ActionCard
            icon={<Receipt className="w-6 h-6" />}
            title="退款處理"
            desc="爭議 / 取消 / 沒到（cash）"
            color="amber"
            onClick={() => navigate("/admin/troubleshoot/refund")}
          />
          <ActionCard
            icon={<Calendar className="w-6 h-6" />}
            title="預約調整"
            desc="改梯次 / 強制核銷"
            color="blue"
            onClick={() => navigate("/pos/scan")}
          />
          <ActionCard
            icon={<Users className="w-6 h-6" />}
            title="玩家補償"
            desc="補券 / 補進度"
            color="violet"
            onClick={() => navigate("/admin/troubleshoot/compensation")}
            comingSoon
          />
        </div>

        {/* 統計列 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="異常預約" value={data?.stats.abnormalBookings ?? 0} tone={data?.stats.abnormalBookings ? "red" : "neutral"} />
          <StatCard label="近 7 天重置場次" value={data?.stats.resetSessions ?? 0} tone="amber" />
          <StatCard label="卡住的場次" value={data?.stats.stuckSessions ?? 0} tone={data?.stats.stuckSessions ? "red" : "neutral"} />
          <StatCard label="近期排解操作" value={data?.stats.recentTroubleshootActions ?? 0} tone="neutral" />
        </div>

        {/* 異常預約清單 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              異常預約（近 7 天）
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              已取消但已付款、未到但已付款、過時段未報到 — 可能需退款處理
            </p>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">載入中...</p>}
            {data?.abnormalBookings.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">✓ 沒有異常預約</p>
            )}
            {data?.abnormalBookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                onClick={() => navigate("/pos/scan")}
              >
                <Badge variant="outline" className="font-mono text-xs">
                  {b.bookingCode}
                </Badge>
                <span className="text-sm font-medium flex-1 truncate">{b.displayName ?? "—"}</span>
                <span className="text-xs text-muted-foreground hidden md:inline">
                  {new Date(b.slotStart).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                {b.paidAt && (
                  <Badge variant="default" className="text-[10px]">
                    已收 NT${(b.amountCents / 100).toFixed(0)}
                  </Badge>
                )}
                <Badge
                  variant={b.status === "cancelled" || b.status === "no_show" ? "destructive" : "secondary"}
                  className="text-[10px]"
                >
                  {b.status}
                </Badge>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 卡住的 sessions */}
        {(data?.stuckSessions.length ?? 0) > 0 && (
          <Card className="border-red-200 dark:border-red-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-600" />
                卡住的場次（playing 超過 24 小時）
              </CardTitle>
              <p className="text-xs text-muted-foreground">建議重置 或 用 /admin/sessions 批次清理</p>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {data?.stuckSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/admin/troubleshoot/reset?session=${s.id}`)}
                >
                  <code className="text-xs">{s.id.slice(0, 8)}…</code>
                  <span className="text-sm flex-1 truncate">
                    {s.gameName ?? "—"} · {s.teamName ?? s.playerName ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Math.floor((Date.now() - new Date(s.startedAt).getTime()) / (1000 * 60 * 60))}h 前
                  </span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 最近排解操作 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-blue-600" />
              最近排解操作（近 50 筆）
            </CardTitle>
            <p className="text-xs text-muted-foreground">含強制核銷 / 改梯次 / 重置 / 退款 / 手動發券</p>
          </CardHeader>
          <CardContent className="space-y-1">
            {data?.recentAudit.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">尚無排解紀錄</p>
            )}
            {data?.recentAudit.map((log) => (
              <div key={log.id} className="text-xs border-l-2 border-blue-300 dark:border-blue-700 pl-2 py-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {log.adminDisplayName ?? log.adminUsername ?? "—"}
                  </span>
                  {log.targetId && (
                    <code className="text-[10px] text-muted-foreground">
                      {log.targetId.slice(0, 12)}
                    </code>
                  )}
                </div>
                {log.metadata && (log.metadata as { reason?: string }).reason && (
                  <p className="mt-0.5 text-foreground">
                    原因：{(log.metadata as { reason: string }).reason}
                  </p>
                )}
              </div>
            ))}
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/audit-logs")}>
                看完整 audit logs →
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </UnifiedAdminLayout>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  color,
  onClick,
  badge,
  comingSoon,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: "red" | "amber" | "blue" | "violet";
  onClick: () => void;
  badge?: string | null;
  comingSoon?: boolean;
}) {
  const colorClasses: Record<typeof color, string> = {
    red: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 border-red-200",
    amber:
      "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 border-amber-200",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-blue-200",
    violet:
      "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 border-violet-200",
  };
  return (
    <button
      onClick={onClick}
      className={`${colorClasses[color]} border rounded-lg px-4 py-4 text-left transition-colors relative`}
    >
      <div className="flex items-start justify-between mb-2">
        {icon}
        {badge && (
          <Badge variant="default" className="text-[10px]">
            {badge}
          </Badge>
        )}
        {comingSoon && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 leading-none">
            規劃中
          </Badge>
        )}
      </div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs opacity-80 mt-0.5">{desc}</p>
    </button>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "neutral";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="py-3 px-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
