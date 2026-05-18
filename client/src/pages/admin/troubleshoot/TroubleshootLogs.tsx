// 🆘 排解中心 — 排解紀錄（2026-05-19 Phase E remainder）
//
// 預過濾 audit_logs 只顯示「排解類」action：強制核銷 / 改梯次 / 重置 / 退款 / 補償等
// 完整 audit logs 還是用 /admin/audit-logs

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ScrollText, User, Clock, ExternalLink, Search } from "lucide-react";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface AuditLog {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  fieldId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  adminUsername: string | null;
  adminDisplayName: string | null;
}

interface DashboardResp {
  recentAudit: AuditLog[];
}

const ACTION_LABELS: Record<string, string> = {
  "pos:force_checkin": "🆘 強制核銷",
  "booking:reschedule": "🆘 改梯次",
  "booking:cancel_admin": "業主取消預約",
  "booking:mark_no_show_admin": "標記未到",
  "session:reset": "🆘 重置場次",
  "session:bulk_abandon": "🆘 批次清理場次",
  "purchase:refund": "撤銷購買",
  "refund:create": "🆘 建立退款",
  "reward:manual_issue": "🆘 手動發券",
  "activity:deactivate": "停用活動",
  "redeem_code:delete": "刪除兌換碼",
};

export default function TroubleshootLogs() {
  const [, navigate] = useLocation();
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<DashboardResp>({
    queryKey: ["/api/admin/troubleshoot/dashboard"],
    queryFn: () => fetchWithAdminAuth("/api/admin/troubleshoot/dashboard"),
    refetchInterval: 30_000,
  });

  const filtered = (data?.recentAudit ?? []).filter((log) => {
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const reason = (log.metadata as { reason?: string } | null)?.reason ?? "";
      const matched =
        log.targetId?.toLowerCase().includes(q) ||
        log.adminUsername?.toLowerCase().includes(q) ||
        log.adminDisplayName?.toLowerCase().includes(q) ||
        reason.toLowerCase().includes(q);
      if (!matched) return false;
    }
    return true;
  });

  return (
    <UnifiedAdminLayout title="🆘 排解紀錄">
      <div className="max-w-5xl mx-auto space-y-4">
        <Button variant="ghost" onClick={() => navigate("/admin/troubleshoot")} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" />
          回排解中心
        </Button>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="w-5 h-5 text-blue-600" />
              排解類操作紀錄
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              只顯示排解相關的 audit logs（強制核銷 / 改梯次 / 重置 / 退款 / 手動發券…）。
              完整紀錄請看{" "}
              <button onClick={() => navigate("/admin/audit-logs")} className="underline">
                操作記錄
              </button>
              。
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">action 過濾</label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部排解類</SelectItem>
                    {Object.entries(ACTION_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">搜尋（target / 操作員 / 原因）</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="關鍵字..."
                    className="pl-7"
                  />
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground mb-2">
              共 {filtered.length} 筆（最多顯示最近 50 筆）
            </div>

            <div className="space-y-1.5">
              {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">載入中...</p>}
              {!isLoading && filtered.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {actionFilter === "all" && !search ? "尚無排解紀錄" : "沒有符合條件的紀錄"}
                </p>
              )}
              {filtered.map((log) => (
                <LogEntry key={log.id} log={log} onNavigate={navigate} />
              ))}
            </div>

            <div className="pt-3 mt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/audit-logs")}>
                <ScrollText className="w-3 h-3 mr-1" />
                看完整 audit logs
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </UnifiedAdminLayout>
  );
}

function LogEntry({
  log,
  onNavigate,
}: {
  log: AuditLog;
  onNavigate: (path: string) => void;
}) {
  const reason = (log.metadata as { reason?: string } | null)?.reason;
  // 提取相關 targetId 跳轉
  const handleClick = () => {
    if (log.action === "session:reset" && log.targetId) {
      onNavigate(`/admin/troubleshoot/reset?session=${log.targetId}`);
      return;
    }
    if (
      log.action.startsWith("pos:") ||
      log.action === "booking:reschedule" ||
      log.action === "booking:cancel_admin"
    ) {
      onNavigate(`/pos/scan`);
      return;
    }
    if (log.action === "refund:create") {
      onNavigate(`/admin/troubleshoot/refund`);
      return;
    }
  };

  const isClickable =
    log.action === "session:reset" ||
    log.action.startsWith("pos:") ||
    log.action === "booking:reschedule" ||
    log.action === "booking:cancel_admin" ||
    log.action === "refund:create";

  return (
    <div
      className={`border-l-2 border-blue-300 dark:border-blue-700 pl-2 py-1.5 text-xs space-y-0.5 ${
        isClickable ? "cursor-pointer hover:bg-muted/50 rounded-r" : ""
      }`}
      onClick={isClickable ? handleClick : undefined}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="text-[10px]">
          {ACTION_LABELS[log.action] ?? log.action}
        </Badge>
        <span className="text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(log.createdAt).toLocaleString("zh-TW", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span className="text-muted-foreground flex items-center gap-1">
          <User className="w-3 h-3" />
          {log.adminDisplayName ?? log.adminUsername ?? "—"}
        </span>
        {log.targetId && (
          <code className="text-[10px] text-muted-foreground">
            {log.targetId.length > 12 ? `${log.targetId.slice(0, 12)}…` : log.targetId}
          </code>
        )}
        {isClickable && <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto" />}
      </div>
      {reason && <p className="text-foreground">原因：{reason}</p>}
    </div>
  );
}
