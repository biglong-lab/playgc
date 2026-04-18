// 🌐 平台場域管理 — 所有租戶一覽 + 狀態控制 + 方案變更
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FieldRow {
  field: {
    id: string;
    name: string;
    code: string;
    status: string | null;
    createdAt: string | null;
  };
  subscription: {
    id: string;
    status: string;
    startedAt: string;
    billingCycle: string | null;
  } | null;
  plan: {
    id: string;
    code: string;
    name: string;
    monthlyPrice: number | null;
  } | null;
}

interface Plan {
  id: string;
  code: string;
  name: string;
}

export default function PlatformFields() {
  const { isAuthenticated } = useAdminAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: rows, isLoading } = useQuery<FieldRow[]>({
    queryKey: ["/api/platform/fields"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/fields");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["/api/platform/plans"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/plans");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ fieldId, status }: { fieldId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/platform/fields/${fieldId}/status`, {
        status,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/fields"] });
      toast({ title: "✅ 狀態已更新" });
    },
    onError: () => toast({ title: "❌ 更新失敗", variant: "destructive" }),
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ fieldId, planId }: { fieldId: string; planId: string }) => {
      const res = await apiRequest("PATCH", `/api/platform/fields/${fieldId}/plan`, {
        planId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/fields"] });
      toast({ title: "✅ 方案已變更" });
    },
    onError: () => toast({ title: "❌ 變更失敗", variant: "destructive" }),
  });

  return (
    <PlatformAdminLayout title="🏢 場域管理">
      <div className="p-6 space-y-4">
        <div className="rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            所有場域（租戶）
          </h2>
          <p className="text-blue-100 text-sm">
            管理平台上所有場域的訂閱方案、狀態與功能
          </p>
        </div>

        {isLoading ? (
          <ListSkeleton count={3} />
        ) : !rows?.length ? (
          <EmptyState
            icon={Building2}
            title="尚無場域"
            description="目前沒有任何已註冊的場域，等待新場域申請或從「場域申請」審核新的租戶"
            actions={[{ label: "查看場域申請", href: "/platform/applications" }]}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {rows.map((row) => (
                  <FieldRowItem
                    key={row.field.id}
                    row={row}
                    plans={plans ?? []}
                    onChangeStatus={(status) =>
                      changeStatusMutation.mutate({ fieldId: row.field.id, status })
                    }
                    onChangePlan={(planId) =>
                      changePlanMutation.mutate({ fieldId: row.field.id, planId })
                    }
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PlatformAdminLayout>
  );
}

function FieldRowItem({
  row,
  plans,
  onChangeStatus,
  onChangePlan,
}: {
  row: FieldRow;
  plans: Plan[];
  onChangeStatus: (status: string) => void;
  onChangePlan: (planId: string) => void;
}) {
  const { field, subscription, plan } = row;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 hover:bg-muted/30 transition-colors items-center">
      <div className="md:col-span-3">
        <p className="font-medium">{field.name}</p>
        <p className="text-xs text-muted-foreground font-mono">{field.code}</p>
      </div>

      <div className="md:col-span-2">
        <FieldStatusBadge status={field.status ?? "active"} />
      </div>

      <div className="md:col-span-3">
        <p className="text-xs text-muted-foreground mb-1">訂閱方案</p>
        <Select
          value={plan?.id ?? ""}
          onValueChange={(v) => onChangePlan(v)}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="選擇方案">
              {plan ? `${planEmoji(plan.code)} ${plan.name}` : "尚未指派"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {planEmoji(p.code)} {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="md:col-span-2">
        {subscription && (
          <>
            <p className="text-xs text-muted-foreground">訂閱狀態</p>
            <p className="text-sm">{subStatusLabel(subscription.status)}</p>
          </>
        )}
      </div>

      <div className="md:col-span-2 flex gap-1 justify-end">
        {field.status !== "suspended" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChangeStatus("suspended")}
          >
            停權
          </Button>
        ) : (
          <Button size="sm" onClick={() => onChangeStatus("active")}>
            重啟
          </Button>
        )}
      </div>
    </div>
  );
}

function FieldStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    active: { label: "✅ 正常", className: "bg-emerald-100 text-emerald-700" },
    inactive: { label: "⏸️ 停用", className: "bg-slate-100 text-slate-600" },
    suspended: { label: "🚫 停權", className: "bg-rose-100 text-rose-700" },
  };
  const v = variants[status] ?? { label: status, className: "bg-slate-100" };
  return (
    <Badge variant="secondary" className={`${v.className}`}>
      {v.label}
    </Badge>
  );
}

function planEmoji(code: string): string {
  switch (code) {
    case "free":
      return "🆓";
    case "pro":
      return "💼";
    case "enterprise":
      return "🚀";
    case "revshare":
      return "🤝";
    default:
      return "📦";
  }
}

function subStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "✅ 有效",
    trial: "🆓 試用中",
    past_due: "⚠️ 逾期",
    canceled: "❌ 取消",
    suspended: "🚫 停權",
  };
  return labels[status] ?? status;
}
