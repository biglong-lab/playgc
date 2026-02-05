import { useQuery } from "@tanstack/react-query";
import AdminStaffLayout from "@/components/AdminStaffLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, User, Shield, Clock, Globe, Monitor } from "lucide-react";

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

async function fetchWithAdminAuth(url: string, options: RequestInit = {}) {
  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
  };
  
  const response = await fetch(url, { ...options, headers, credentials: "include" });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }
  
  return response.json();
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

export default function AdminStaffAuditLogs() {
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
    queryFn: () => fetchWithAdminAuth("/api/admin/audit-logs"),
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
    <AdminStaffLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6" />
            操作記錄
          </h1>
          <p className="text-muted-foreground mt-1">查看系統操作的審計日誌</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>最近操作記錄</CardTitle>
            <CardDescription>顯示最近 100 筆系統操作記錄</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
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
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>尚無操作記錄</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminStaffLayout>
  );
}
