// 🔑 API 金鑰管理（跨場域聚合）
//
// 顯示各場域 AI provider 設定狀態 + 用量
// 注意：金鑰已加密儲存，UI 只顯示遮罩 + 是否設定
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Key, Cpu, AlertCircle, CheckCircle2 } from "lucide-react";

interface ApiKeyRow {
  fieldId: string;
  fieldName: string;
  fieldCode: string;
  gemini: {
    configured: boolean;
    maskedKey: string | null;
  };
  providers: Array<{
    provider: string;
    usage30d: number;
    successRate: number;
    lastUsed: string | null;
  }>;
}

export default function PlatformApiKeys() {
  const { isAuthenticated } = useAdminAuth();

  const { data, isLoading } = useQuery<{ items: ApiKeyRow[]; total: number }>({
    queryKey: ["/api/platform/api-keys"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/api-keys")).json(),
    enabled: isAuthenticated,
  });

  const items = data?.items ?? [];
  const configured = items.filter((i) => i.gemini.configured).length;
  const totalUsage = items.reduce(
    (sum, i) => sum + i.providers.reduce((s, p) => s + p.usage30d, 0),
    0,
  );

  return (
    <PlatformAdminLayout title="API 金鑰管理">
      {/* 警告：UI 只顯示遮罩 */}
      <Card className="mb-4 border-l-4 border-l-amber-500">
        <CardContent className="p-4">
          <div className="text-sm">
            <p className="font-semibold mb-1">🔒 安全規則</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• API 金鑰已用 AES-256-GCM 加密儲存於各場域 settings.geminiApiKey</li>
              <li>• 此頁<strong className="text-foreground">只顯示遮罩</strong>（前 4 + 後 4 字元），不可看完整金鑰</li>
              <li>• 修改金鑰請進入「場域管理 → 各場域 → 設定 → AI 配置」</li>
              <li>• 用量資料聚合自 ai_usage_logs（過去 30 天）</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="w-3 h-3" /> 總場域
            </div>
            <div className="text-2xl font-bold tabular-nums text-primary">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Key className="w-3 h-3" /> 已設定金鑰
            </div>
            <div className="text-2xl font-bold tabular-nums text-emerald-500">
              {configured} <span className="text-sm text-muted-foreground">/ {items.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Cpu className="w-3 h-3" /> 30 天總呼叫
            </div>
            <div className="text-2xl font-bold tabular-nums text-amber-500">
              {totalUsage.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <ListSkeleton count={5} />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            尚無場域
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.fieldId}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <div className="font-semibold">{item.fieldName}</div>
                  <Badge variant="outline">{item.fieldCode}</Badge>
                </div>

                {/* Gemini 金鑰狀態 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <div className="bg-muted/30 rounded p-3">
                    <div className="flex items-center gap-2 mb-1">
                      {item.gemini.configured ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      )}
                      <span className="text-sm font-medium">Gemini API Key</span>
                    </div>
                    {item.gemini.configured ? (
                      <code className="text-xs font-mono">{item.gemini.maskedKey}</code>
                    ) : (
                      <span className="text-xs text-muted-foreground">未設定</span>
                    )}
                  </div>

                  {/* 用量 */}
                  <div className="bg-muted/30 rounded p-3">
                    <div className="text-xs text-muted-foreground mb-1">過去 30 天用量</div>
                    {item.providers.length === 0 ? (
                      <span className="text-xs text-muted-foreground">無使用紀錄</span>
                    ) : (
                      <div className="space-y-1">
                        {item.providers.map((p) => (
                          <div key={p.provider} className="flex items-center gap-2 text-xs">
                            <Badge variant="outline" className="text-[10px]">{p.provider}</Badge>
                            <span className="tabular-nums">{p.usage30d.toLocaleString()} 次</span>
                            <span className="text-muted-foreground">·</span>
                            <span
                              className={
                                p.successRate >= 0.95 ? "text-emerald-500" : "text-amber-500"
                              }
                            >
                              {(p.successRate * 100).toFixed(1)}%
                            </span>
                            {p.lastUsed && (
                              <span className="text-muted-foreground tabular-nums ml-auto">
                                {new Date(p.lastUsed).toLocaleDateString("zh-TW")}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PlatformAdminLayout>
  );
}
