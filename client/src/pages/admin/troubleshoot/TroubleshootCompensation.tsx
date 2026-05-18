// 🆘 排解中心 — 玩家補償（2026-05-19 Phase E remainder）
//
// 重用 /api/admin/rewards/manual + /api/admin/coupon-templates、提供簡化包裝 UI。
// 業主可給遊戲出狀況的玩家補一張券。

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Gift, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface CouponTemplate {
  id: string;
  name: string;
  description: string | null;
  discountType: "amount" | "percentage" | "free_item";
  discountValue: number | null;
  validityDays: number;
  isActive: boolean;
}

export default function TroubleshootCompensation() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [templateId, setTemplateId] = useState("");
  const [squadId, setSquadId] = useState("");
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");

  const templates = useQuery<CouponTemplate[]>({
    queryKey: ["/api/admin/coupon-templates"],
    queryFn: () => fetchWithAdminAuth("/api/admin/coupon-templates"),
  });

  const activeTemplates = templates.data?.filter((t) => t.isActive) ?? [];

  const issueMutation = useMutation({
    mutationFn: async () => {
      return await fetchWithAdminAuth("/api/admin/rewards/manual", {
        method: "POST",
        body: JSON.stringify({
          templateId,
          squadId: squadId || undefined,
          userId: userId || undefined,
          reason,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "✅ 補償券已發給玩家", description: "可在玩家端「我的券」看到" });
      setSquadId("");
      setUserId("");
      setReason("");
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "發券失敗";
      toast({ variant: "destructive", title: "失敗", description: msg });
    },
  });

  const reasonValid = reason.trim().length >= 5;
  const targetValid = squadId.trim().length > 0 || userId.trim().length > 0;
  const formValid = templateId && targetValid && reasonValid;

  return (
    <UnifiedAdminLayout title="🆘 玩家補償">
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" onClick={() => navigate("/admin/troubleshoot")} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" />
          回排解中心
        </Button>

        <Card className="border-violet-200 dark:border-violet-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="w-5 h-5 text-violet-600" />
              手動發券給玩家（補償用）
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              客人遊戲出狀況、想額外補償他、發一張券給隊伍 或 特定玩家。會留 audit 紀錄。
            </p>
          </CardHeader>
        </Card>

        {/* 表單 */}
        <Card>
          <CardContent className="py-4 space-y-3">
            {/* 1. 選券模板 */}
            <div className="space-y-1">
              <Label htmlFor="template">補償的券</Label>
              {activeTemplates.length === 0 && !templates.isLoading ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 px-3 py-2 rounded text-xs">
                  <AlertTriangle className="w-4 h-4 inline mr-1 text-amber-600" />
                  尚無啟用的券模板、請先到{" "}
                  <button
                    onClick={() => navigate("/admin/revenue/codes")}
                    className="underline font-semibold"
                  >
                    兌換碼中心
                  </button>{" "}
                  建立
                </div>
              ) : (
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger id="template">
                    <SelectValue placeholder={templates.isLoading ? "載入中..." : "選擇券..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{t.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {t.discountType === "amount" && t.discountValue
                              ? `折抵 NT$${t.discountValue}`
                              : t.discountType === "percentage" && t.discountValue
                                ? `${t.discountValue}% off`
                                : "免費品項"}
                            {" · "}有效期 {t.validityDays} 天
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 2. 發給誰 */}
            <div className="space-y-1">
              <Label>發給</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="squad-id" className="text-xs text-muted-foreground">
                    Squad ID（場域 admin 必填）
                  </Label>
                  <Input
                    id="squad-id"
                    value={squadId}
                    onChange={(e) => setSquadId(e.target.value)}
                    placeholder="squad UUID..."
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="user-id" className="text-xs text-muted-foreground">
                    User ID（super_admin 可直接填）
                  </Label>
                  <Input
                    id="user-id"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="user UUID（可選）..."
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                場域 admin 必填 squadId（必須是本場域的隊伍）；super_admin 可只填 userId
              </p>
            </div>

            {/* 3. 原因 */}
            <div className="space-y-1">
              <Label htmlFor="reason">補償原因（≥ 5 字、必填）</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="例：遊戲過程斷網無法繼續、體驗不佳、額外補償一張券"
                rows={2}
              />
            </div>

            <Button
              className="w-full bg-violet-600 hover:bg-violet-700"
              disabled={!formValid || issueMutation.isPending}
              onClick={() => issueMutation.mutate()}
            >
              {issueMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Gift className="w-4 h-4 mr-1" />
              )}
              發出補償券
            </Button>
          </CardContent>
        </Card>

        {/* 提示資訊 */}
        <Card>
          <CardContent className="py-3 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="text-[10px] shrink-0">
                提示
              </Badge>
              <div className="space-y-1">
                <p>• Squad ID 可在 /admin/sessions 找遊戲場次後查到隊伍資訊</p>
                <p>• User ID 可在 /admin/players 列表找到（super_admin 可看全部玩家）</p>
                <p>• 發券動作會自動記錄到 audit_logs 的 reward:manual_issue</p>
                <p>• 玩家收到券後可在「我的券」看到、現場 POS 掃碼核銷</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/sessions")}>
                /admin/sessions
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/players")}>
                /admin/players
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </UnifiedAdminLayout>
  );
}
