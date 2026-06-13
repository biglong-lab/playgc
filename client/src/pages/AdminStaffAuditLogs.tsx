import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, User, Shield, Clock, Globe, Monitor } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { fetchWithAdminAuth } from "./admin-staff/types";

interface AuditLog {
  id: string;
  actorAdminId: string | null;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  fieldId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actorAdmin: {
    username: string;
    displayName: string | null;
  } | null;
  field: {
    code: string;
    name: string;
  } | null;
}


const ACTION_LABELS: Record<string, string> = {
  "admin:login": "管理員登入",
  "admin:logout": "管理員登出",
  "admin:create_account": "建立帳號",
  "admin:update_account": "更新帳號",
  "admin:reset_password": "重設密碼",
  "field:create": "建立場域",
  "field:update": "更新場域",
  "role:create": "建立角色",
  "role:update": "更新角色",
  "role:delete": "刪除角色",
  "game:create": "建立遊戲",
  "game:update": "更新遊戲",
  "game:delete": "刪除遊戲",
  "game:publish": "發布遊戲",
  // 🆕 2026-05-19 Phase B：POS / 預約 / 券核銷 audit action
  "pos:scan_lookup": "POS 掃描查詢",
  "pos:checkin": "預約報到",
  "pos:force_checkin": "🆘 強制核銷",
  "pos:checkout": "POS 收款",
  "booking:no_show": "標記未到",
  "booking:reschedule": "🆘 改梯次",
  "voucher:redeem": "券核銷",
  // 🆕 2026-05-19 Phase B 第二批：admin-bookings + admin-activities
  "booking:cancel_admin": "業主取消預約",
  "booking:mark_completed": "標記預約完成",
  "booking:mark_no_show_admin": "業主標記未到",
  "booking_config:update": "更新預約設定",
  "booking_blackout:create": "新增黑名單時段",
  "booking_blackout:delete": "刪除黑名單時段",
  "activity:create": "建立活動",
  "activity:update": "更新活動",
  "activity:delete": "刪除活動",
  "activity:deactivate": "停用活動",
  "activity:upload_cover": "上傳活動封面",
  "activity_schedule:update": "更新活動時段",
  // 🆕 2026-05-19 Phase B 第三批：redeem-codes / feature-flags / purchases / line-config / settings / sessions / rewards
  "redeem_code:create": "建立兌換碼",
  "redeem_code:batch_create": "批次建立兌換碼",
  "redeem_code:update": "更新兌換碼",
  "redeem_code:delete": "刪除兌換碼",
  "feature_flag:upsert": "新增/更新元件開關",
  "feature_flag:enable": "啟用元件",
  "feature_flag:disable": "停用元件",
  "purchase:grant_access": "現金授權存取",
  "purchase:refund": "🆘 撤銷購買（退款）",
  "line_config:update": "🔒 更新 LINE 設定",
  "field_settings:update": "更新場域系統設定",
  "session:bulk_abandon": "🆘 批次清理超時場次",
  "reward_rule:create": "建立獎勵規則",
  "reward_rule:update": "更新獎勵規則",
  "reward_rule:soft_delete": "刪除獎勵規則",
  "coupon_template:create": "建立券模板",
  "coupon_template:update": "更新券模板",
  "reward:manual_issue": "🆘 手動發券",
  // 🆕 2026-05-19 Phase C：遊戲重置
  "session:reset": "🆘 重置遊戲場次",
  // 🆕 2026-05-19 Phase D：退款
  "refund:create": "🆘 建立退款",
};

const ACTION_COLORS: Record<string, string> = {
  login: "bg-green-500/10 text-green-500",
  logout: "bg-gray-500/10 text-gray-500",
  create: "bg-blue-500/10 text-blue-500",
  update: "bg-yellow-500/10 text-yellow-500",
  delete: "bg-red-500/10 text-red-500",
  reset: "bg-purple-500/10 text-purple-500",
  publish: "bg-emerald-500/10 text-emerald-500",
};

const getActionColor = (action: string): string => {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return color;
  }
  return "bg-muted text-muted-foreground";
};

// http: 中介層自動紀錄 → 用 HTTP method 對應好懂的中文
const HTTP_METHOD_LABELS: Record<string, string> = {
  POST: "新增 / 送出",
  PUT: "修改",
  PATCH: "調整",
  DELETE: "移除",
};

function actionLabel(action: string): string {
  if (action.startsWith("http:")) {
    const method = action.slice(5);
    return HTTP_METHOD_LABELS[method] || `操作（${method}）`;
  }
  return ACTION_LABELS[action] || action;
}

export default function AdminStaffAuditLogs() {
  const { isAuthenticated } = useAdminAuth();
  // 🆕 2026-06-13 篩選
  const [category, setCategory] = useState<"all" | "semantic" | "http">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs", category, from, to, q],
    queryFn: () => {
      const url = new URL("/api/admin/audit-logs", window.location.origin);
      url.searchParams.set("limit", "300");
      if (category !== "all") url.searchParams.set("category", category);
      if (from) url.searchParams.set("from", from);
      if (to) url.searchParams.set("to", to);
      if (q) url.searchParams.set("q", q);
      return fetchWithAdminAuth(url.pathname + url.search);
    },
    enabled: isAuthenticated,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const parseUserAgent = (userAgent: string | null): string => {
    if (!userAgent) return "-";
    
    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    return "其他瀏覽器";
  };

  return (
    <UnifiedAdminLayout title="操作記錄">
      <div className="p-6 space-y-6">
        <div>
          <p className="text-muted-foreground mt-1">查看系統操作的審計日誌</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>最近操作記錄</CardTitle>
            <CardDescription>顯示最近 100 筆系統操作記錄</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton count={6} />
            ) : logs && logs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>時間</TableHead>
                    <TableHead>操作者</TableHead>
                    <TableHead>動作</TableHead>
                    <TableHead>目標</TableHead>
                    <TableHead>場域</TableHead>
                    <TableHead>來源資訊</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDate(log.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.actorAdmin ? (
                          <div className="flex items-center gap-1">
                            <Shield className="w-3 h-3 text-primary" />
                            <span className="font-medium">
                              {log.actorAdmin.displayName || log.actorAdmin.username}
                            </span>
                          </div>
                        ) : log.actorUserId ? (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span className="text-muted-foreground">玩家</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">系統</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionColor(log.action)} variant="secondary">
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.targetType && log.targetId ? (
                          <div className="text-sm">
                            <span className="text-muted-foreground">{log.targetType}: </span>
                            <span className="font-mono text-xs">{log.targetId.slice(0, 8)}...</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.field ? (
                          <Badge variant="outline">{log.field.code}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {log.ipAddress && (
                            <div className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {log.ipAddress}
                            </div>
                          )}
                          {log.userAgent && (
                            <div className="flex items-center gap-1">
                              <Monitor className="w-3 h-3" />
                              {parseUserAgent(log.userAgent)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={FileText}
                title="尚無操作記錄"
                description="當管理員執行寫入動作時（建立、編輯、刪除），系統會自動記錄"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </UnifiedAdminLayout>
  );
}
