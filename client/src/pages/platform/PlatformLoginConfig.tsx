// 🔐 登入管理配置
//
// 顯示各登入方式的設定狀態 + 使用統計
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, KeyRound, Users, Activity } from "lucide-react";

interface LoginMethod {
  name: string;
  type: string;
  enabled: boolean;
  configured: boolean;
  details?: Record<string, boolean>;
  stats?: Record<string, number> | null;
}

interface LoginConfig {
  methods: LoginMethod[];
  activeSessions: number;
  notes: string[];
}

export default function PlatformLoginConfig() {
  const { isAuthenticated } = useAdminAuth();

  const { data, isLoading } = useQuery<LoginConfig>({
    queryKey: ["/api/platform/login-config"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/login-config")).json(),
    enabled: isAuthenticated,
  });

  return (
    <PlatformAdminLayout title="登入管理">
      {/* 說明 */}
      <Card className="mb-4 border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-1">📋 登入方式概覽</p>
          <p className="text-xs text-muted-foreground">
            此頁顯示平台支援的登入方式與配置狀態。修改設定請改 .env 環境變數並重新部署。
          </p>
        </CardContent>
      </Card>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="w-3 h-3" /> 啟用中 sessions
            </div>
            <div className="text-2xl font-bold tabular-nums text-primary">
              {data?.activeSessions ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">登入方式</div>
            <div className="text-2xl font-bold tabular-nums">
              {data?.methods.filter((m) => m.enabled).length ?? 0}
              <span className="text-sm text-muted-foreground"> / {data?.methods.length ?? 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">配置完整</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-500">
              {data?.methods.filter((m) => m.configured).length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 登入方式列表 */}
      {isLoading ? (
        <ListSkeleton count={3} />
      ) : (
        <div className="space-y-2 mb-6">
          {data?.methods.map((method) => (
            <Card
              key={method.type}
              className={method.configured ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-amber-500"}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <KeyRound className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <div className="font-semibold">{method.name}</div>
                    <div className="text-xs text-muted-foreground">{method.type}</div>
                  </div>
                  {method.configured ? (
                    <Badge className="bg-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1" /> 已配置</Badge>
                  ) : (
                    <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> 未配置</Badge>
                  )}
                  <Badge variant={method.enabled ? "default" : "secondary"}>
                    {method.enabled ? "啟用" : "停用"}
                  </Badge>
                </div>

                {/* 詳細欄位（如 Firebase 各個 env var）*/}
                {method.details && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mt-2">
                    {Object.entries(method.details).map(([key, ok]) => (
                      <div key={key} className="flex items-center gap-1 text-xs">
                        {ok ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <XCircle className="w-3 h-3 text-destructive" />
                        )}
                        <code className="text-[10px] font-mono">{key}</code>
                      </div>
                    ))}
                  </div>
                )}

                {/* 統計 */}
                {method.stats && (
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
                    {Object.entries(method.stats).map(([key, value]) => (
                      <div key={key} className="text-center">
                        <div className="text-[10px] text-muted-foreground">
                          {STAT_LABELS[key] ?? key}
                        </div>
                        <div className="text-lg font-bold tabular-nums">
                          {value.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 說明 */}
      {data?.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold mb-2">💡 注意事項</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {data.notes.map((note, i) => (
                <li key={i}>• {note}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </PlatformAdminLayout>
  );
}

const STAT_LABELS: Record<string, string> = {
  total_admins: "總帳號",
  active_admins: "啟用中",
  recent_logins_30d: "30 天登入",
  total_users: "總玩家",
  firebase_users: "Firebase 玩家",
};
