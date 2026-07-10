// 🕘 設定變更歷史（2026-07-10 第 4 批）
//
// 顯示 field_settings:update 稽核紀錄的 before/after 值，
// 並提供「還原」把單筆變更的改前值寫回（僅一般設定、非金鑰欄位）。
// 資料源：GET /api/admin/audit-logs（需 admin:view_audit 權限、無權限時顯示提示）

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { History, Undo2 } from "lucide-react";

interface SettingsAuditLog {
  id: string;
  action: string;
  createdAt: string;
  actorAdmin?: { displayName?: string | null; username?: string | null } | null;
  metadata?: {
    changedKeys?: string[];
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  } | null;
}

const SETTING_LABELS: Record<string, string> = {
  defaultGameTime: "預設遊戲時間",
  defaultMaxPlayers: "預設最大玩家數",
  autoEndIdleSession: "自動結束閒置場次",
  sessionIdleTimeout: "閒置超時時間",
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "（未設定）";
  if (typeof v === "boolean") return v ? "開" : "關";
  return String(v);
}

export default function SettingsChangeHistory() {
  const { toast } = useToast();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const { data: logs, isLoading, isError } = useQuery<SettingsAuditLog[]>({
    queryKey: ["/api/admin/audit-logs", "settings-history"],
    queryFn: async () => {
      const url = new URL("/api/admin/audit-logs", window.location.origin);
      url.searchParams.set("category", "semantic");
      url.searchParams.set("q", "field_settings:update");
      url.searchParams.set("limit", "50");
      return fetchWithAdminAuth(url.pathname + url.search) as Promise<SettingsAuditLog[]>;
    },
    retry: false,
  });

  const restoreMutation = useMutation({
    mutationFn: async (before: Record<string, unknown>) => {
      // 只回寫已知的一般設定欄位（防 metadata 被塞其他 key）
      const payload = Object.fromEntries(
        Object.entries(before).filter(([k, v]) => k in SETTING_LABELS && v !== null && v !== undefined),
      );
      if (Object.keys(payload).length === 0) throw new Error("此筆紀錄沒有可還原的改前值");
      return fetchWithAdminAuth("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs", "settings-history"] });
      setConfirmingId(null);
      toast({ title: "✅ 已還原為改前值" });
    },
    onError: (err) => {
      setConfirmingId(null);
      toast({
        title: "還原失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="w-5 h-5" />
          設定變更歷史
        </CardTitle>
        <CardDescription>
          誰在何時改了什麼值；「還原」會把該筆變更的改前值寫回（會再留一筆新紀錄）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        )}
        {isError && (
          <p className="text-sm text-muted-foreground">
            無法載入變更歷史（需要「檢視操作記錄」權限）
          </p>
        )}
        {!isLoading && !isError && (logs?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">尚無設定變更紀錄</p>
        )}
        {logs?.map((log) => {
          const before = log.metadata?.before;
          const after = log.metadata?.after;
          const keys = log.metadata?.changedKeys ?? [];
          const canRestore = !!before && Object.keys(before).some((k) => k in SETTING_LABELS);
          return (
            <div
              key={log.id}
              className="p-3 rounded-lg bg-muted/30 space-y-2"
              data-testid={`settings-history-${log.id}`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">
                    {new Date(log.createdAt).toLocaleString("zh-TW")}
                  </Badge>
                  <span className="text-muted-foreground">
                    {log.actorAdmin?.displayName || log.actorAdmin?.username || "系統"}
                  </span>
                </div>
                {canRestore && (
                  <Button
                    size="sm"
                    variant={confirmingId === log.id ? "destructive" : "outline"}
                    className="gap-1"
                    disabled={restoreMutation.isPending}
                    onClick={() => {
                      if (confirmingId === log.id) {
                        restoreMutation.mutate(before!);
                      } else {
                        setConfirmingId(log.id);
                      }
                    }}
                    data-testid={`button-restore-${log.id}`}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    {confirmingId === log.id ? "再按一次確認還原" : "還原改前值"}
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                {keys.map((k) => (
                  <p key={k} className="text-sm">
                    <span className="text-muted-foreground">{SETTING_LABELS[k] ?? k}：</span>
                    {before || after ? (
                      <>
                        <span className="line-through opacity-60">{formatValue(before?.[k])}</span>
                        <span className="mx-1">→</span>
                        <span className="font-medium">{formatValue(after?.[k])}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">（此筆為舊格式、只記欄位名）</span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
