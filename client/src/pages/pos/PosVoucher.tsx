// 🎟️ POS 券核銷頁（2026-05-18）
//
// 路徑：/pos/voucher
// 掃 QR 或手輸券碼 → 查詢 → 確認核銷
// Phase 5 整合 redeemCodes + platformCoupons + squadExternalRewards

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import PosLayout from "./PosLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ticket, Search, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

export default function PosVoucher() {
  const { toast } = useToast();
  const [code, setCode] = useState("");

  const lookupMut = useMutation({
    mutationFn: async (input: string) => {
      // 先試 POS checkin（同一個 endpoint 支援多型別判別）
      return await fetchWithAdminAuth("/api/pos/checkin", {
        method: "POST",
        body: JSON.stringify({ token: input }),
      });
    },
    onSuccess: (data: unknown) => {
      const d = data as { type?: string };
      toast({
        title: "✓ 已查到",
        description: d.type === "booking" ? "這是預約碼、請至掃描頁處理" : "券資訊顯示中",
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "找不到此券";
      toast({ variant: "destructive", title: "查詢失敗", description: msg });
    },
  });

  return (
    <PosLayout title="券核銷" backTo="/pos">
      <Card className="mb-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200">
        <CardContent className="py-4 px-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 text-amber-700 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">Phase 4-E 簡化版</p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                目前可查預約碼；遊戲發券核銷整合在 Phase 5 上線（rewardConversionRules → platformCoupons.qr_token → 此頁掃碼折抵）。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4 space-y-3">
          <Label htmlFor="voucher-code">券碼 / 預約碼</Label>
          <div className="flex gap-2">
            <Input
              id="voucher-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="掃描或輸入"
              maxLength={120}
            />
            <Button onClick={() => code && lookupMut.mutate(code.trim())} disabled={!code || lookupMut.isPending}>
              {lookupMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">支援預約碼（如 C3WJAZ）、券 token（CP_xxx）、兌換碼（RD_xxx）</p>
        </CardContent>
      </Card>

      {lookupMut.data ? (
        <Card className="mt-4 border-green-500 border-2">
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h3 className="font-bold">查詢成功</h3>
            </div>
            <pre className="text-xs bg-slate-50 dark:bg-slate-900 px-2 py-2 rounded overflow-x-auto">
              {JSON.stringify(lookupMut.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardContent className="py-3 text-xs text-muted-foreground">
          <Ticket className="w-4 h-4 inline mr-1" />
          券折抵流程（Phase 5）：玩家在 /pos/checkout 收款時可選「用券折抵」、應收 − 券面額 = 實付。
        </CardContent>
      </Card>
    </PosLayout>
  );
}
