// 🌐 平台場域申請審核
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Inbox, Check, X, Mail, Clock, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Application {
  id: string;
  businessName: string;
  businessType: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  preferredFieldCode: string | null;
  address: string | null;
  expectedPlayersPerMonth: number | null;
  preferredPlan: string | null;
  message: string | null;
  status: string;
  adminNotes: string | null;
  rejectionReason: string | null;
  createdFieldId: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  homestay: "🏡 民宿",
  camp: "⛺ 營隊",
  tourism: "🗺️ 觀光地",
  school: "🏫 學校",
  enterprise: "🏢 企業",
  event: "🎪 活動公司",
  other: "✨ 其他",
};

export default function PlatformApplications() {
  const { isAuthenticated } = useAdminAuth();
  const [filter, setFilter] = useState<"all" | "pending" | "contacted" | "approved" | "rejected">("pending");
  const [approveDialog, setApproveDialog] = useState<Application | null>(null);
  const [rejectDialog, setRejectDialog] = useState<Application | null>(null);

  const { data, isLoading } = useQuery<{ applications: Application[] }>({
    queryKey: ["/api/platform/applications", filter],
    queryFn: async () => {
      const url =
        filter === "all"
          ? "/api/platform/applications"
          : `/api/platform/applications?status=${filter}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: isAuthenticated,
  });

  return (
    <PlatformAdminLayout title="📋 場域申請審核">
      <div className="p-6 space-y-4">
        <div className="rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <Inbox className="w-5 h-5" />
            場域申請
          </h2>
          <p className="text-blue-100 text-sm">審核公開申請 / apply 頁面送出的申請</p>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="pending">🆕 待審核</TabsTrigger>
            <TabsTrigger value="contacted">📞 已聯絡</TabsTrigger>
            <TabsTrigger value="approved">✅ 已通過</TabsTrigger>
            <TabsTrigger value="rejected">❌ 已拒絕</TabsTrigger>
            <TabsTrigger value="all">全部</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <ListSkeleton count={3} />
        ) : !data?.applications?.length ? (
          <EmptyState
            icon={Inbox}
            title="沒有申請"
            description={
              filter === "pending"
                ? "目前沒有待審核的場域申請"
                : "此狀態下沒有申請"
            }
          />
        ) : (
          <div className="space-y-3">
            {data.applications.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                onApprove={() => setApproveDialog(app)}
                onReject={() => setRejectDialog(app)}
              />
            ))}
          </div>
        )}

        <ApproveDialog
          application={approveDialog}
          onClose={() => setApproveDialog(null)}
        />
        <RejectDialog
          application={rejectDialog}
          onClose={() => setRejectDialog(null)}
        />
      </div>
    </PlatformAdminLayout>
  );
}

// ============================================================================
// 申請卡片
// ============================================================================

function ApplicationCard({
  application,
  onApprove,
  onReject,
}: {
  application: Application;
  onApprove: () => void;
  onReject: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const contactMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/platform/applications/${application.id}/contact`
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/applications"] });
      toast({ title: "✅ 已標記為已聯絡" });
    },
  });

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base">{application.businessName}</h3>
              <Badge variant="outline" className="text-[10px]">
                {BUSINESS_TYPE_LABELS[application.businessType] ?? application.businessType}
              </Badge>
              <StatusBadge status={application.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(application.createdAt).toLocaleString("zh-TW")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4">
          <InfoRow label="聯絡人" value={application.contactName} />
          <InfoRow label="Email" value={application.contactEmail} />
          {application.contactPhone && (
            <InfoRow label="電話" value={application.contactPhone} />
          )}
          {application.preferredFieldCode && (
            <InfoRow
              label="希望場域代碼"
              value={<code className="bg-muted px-1.5 py-0.5 rounded">{application.preferredFieldCode}</code>}
            />
          )}
          {application.preferredPlan && (
            <InfoRow label="期望方案" value={application.preferredPlan} />
          )}
          {application.expectedPlayersPerMonth && (
            <InfoRow
              label="預估玩家/月"
              value={application.expectedPlayersPerMonth.toLocaleString()}
            />
          )}
          {application.address && (
            <InfoRow label="地址" value={application.address} />
          )}
        </div>

        {application.message && (
          <div className="bg-muted/40 p-3 rounded text-sm mb-4">
            <p className="text-xs text-muted-foreground mb-1">💬 申請訊息</p>
            <p className="whitespace-pre-wrap">{application.message}</p>
          </div>
        )}

        {application.status === "rejected" && application.rejectionReason && (
          <div className="bg-rose-50 dark:bg-rose-950/20 p-3 rounded text-sm mb-4">
            <p className="text-xs text-rose-700 mb-1">❌ 拒絕原因</p>
            <p>{application.rejectionReason}</p>
          </div>
        )}

        {application.status === "pending" || application.status === "contacted" ? (
          <div className="flex gap-2 pt-2 border-t">
            {application.status === "pending" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => contactMutation.mutate()}
                disabled={contactMutation.isPending}
              >
                <Mail className="w-4 h-4 mr-1" />
                標記已聯絡
              </Button>
            )}
            <Button size="sm" onClick={onApprove}>
              <Check className="w-4 h-4 mr-1" />
              通過並開通
            </Button>
            <Button size="sm" variant="destructive" onClick={onReject}>
              <X className="w-4 h-4 mr-1" />
              拒絕
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 通過 Dialog
// ============================================================================

function ApproveDialog({
  application,
  onClose,
}: {
  application: Application | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fieldCode, setFieldCode] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [planCode, setPlanCode] = useState("free");
  const [trialDays, setTrialDays] = useState("14");
  const [notes, setNotes] = useState("");

  // 帶入申請資料作為預設
  if (application && !fieldCode && application.preferredFieldCode) {
    setFieldCode(application.preferredFieldCode);
  }
  if (application && !fieldName) {
    setFieldName(application.businessName);
  }
  if (application && application.preferredPlan && planCode === "free") {
    setPlanCode(application.preferredPlan);
  }

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/platform/applications/${application!.id}/approve`,
        {
          fieldCode: fieldCode.toUpperCase(),
          fieldName,
          planCode,
          trialDays: Number(trialDays),
          notes,
        }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/fields"] });
      toast({ title: "✅ 場域已開通！" });
      resetAndClose();
    },
    onError: (err: any) => {
      toast({
        title: "❌ 開通失敗",
        description: err?.message ?? "請檢查資料",
        variant: "destructive",
      });
    },
  });

  function resetAndClose() {
    setFieldCode("");
    setFieldName("");
    setPlanCode("free");
    setTrialDays("14");
    setNotes("");
    onClose();
  }

  if (!application) return null;

  return (
    <Dialog open={!!application} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>✅ 通過申請並開通場域</DialogTitle>
          <DialogDescription>
            將自動建立場域 + 訂閱方案。申請人會收到開通通知。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>
              場域代碼 <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={fieldCode}
              onChange={(e) => setFieldCode(e.target.value.toUpperCase())}
              placeholder="3-20 字元大寫英數"
              className="mt-1.5 font-mono"
            />
          </div>
          <div>
            <Label>
              場域名稱 <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>訂閱方案</Label>
              <Select value={planCode} onValueChange={setPlanCode}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">🆓 Free</SelectItem>
                  <SelectItem value="pro">💼 Pro</SelectItem>
                  <SelectItem value="enterprise">🚀 Enterprise</SelectItem>
                  <SelectItem value="revshare">🤝 RevShare</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>試用天數</Label>
              <Input
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label>內部備註</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1.5"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            取消
          </Button>
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={!fieldCode || !fieldName || approveMutation.isPending}
          >
            <UserCheck className="w-4 h-4 mr-1" />
            確認開通
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// 拒絕 Dialog
// ============================================================================

function RejectDialog({
  application,
  onClose,
}: {
  application: Application | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reason, setReason] = useState("");

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/platform/applications/${application!.id}/reject`,
        { reason }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/applications"] });
      toast({ title: "已拒絕申請" });
      setReason("");
      onClose();
    },
  });

  if (!application) return null;

  return (
    <Dialog open={!!application} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>❌ 拒絕申請</DialogTitle>
          <DialogDescription>
            請填寫拒絕原因，將一併寄給申請人
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="請說明拒絕原因"
          rows={4}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={() => rejectMutation.mutate()}
            disabled={!reason || rejectMutation.isPending}
          >
            確認拒絕
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// 子元件
// ============================================================================

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    pending: { label: "🆕 待審核", className: "bg-amber-100 text-amber-700" },
    contacted: { label: "📞 已聯絡", className: "bg-blue-100 text-blue-700" },
    approved: { label: "✅ 已通過", className: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "❌ 已拒絕", className: "bg-rose-100 text-rose-700" },
  };
  const v = variants[status] ?? { label: status, className: "bg-slate-100" };
  return (
    <Badge variant="secondary" className={`text-[10px] ${v.className}`}>
      {v.label}
    </Badge>
  );
}
