// 🎯 多元定位驗證設定 — Admin 編輯區塊
// 用於 LocationEditor.tsx 或其他 admin location 編輯頁
// 2026-05-22

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  QrCode,
  KeyRound,
  Satellite,
  Sparkles,
  ShieldAlert,
  Download,
  RefreshCw,
} from "lucide-react";
import type { Location } from "@shared/schema";

type VerificationMode = "gps" | "qr" | "code" | "hybrid" | "any";

const MODE_LABELS: Record<VerificationMode, { label: string; desc: string }> = {
  gps: { label: "只能 GPS", desc: "玩家必須在 GPS 半徑內（不適合室內 / GPS 被關閉場域）" },
  qr: { label: "只能 QR Code", desc: "玩家必須掃描現場 QR Code（最可靠、適合 GPS 不穩場域）" },
  code: { label: "只能輸入代碼", desc: "玩家輸入現場張貼的 4-6 位代碼" },
  hybrid: { label: "GPS + (QR 或代碼)", desc: "GPS 可用時優先 GPS；GPS 失效則用 QR/代碼" },
  any: { label: "全部都可（推薦學校）", desc: "玩家可選任一方式，最寬鬆、體驗最順" },
};

interface Props {
  location: Location;
  onUpdated?: (loc: Location) => void;
}

export function LocationVerificationConfig({ location, onUpdated }: Props) {
  const { toast } = useToast();
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Location>) => {
      const res = await apiRequest("PATCH", `/api/locations/${location.id}`, data);
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", location.gameId, "locations"] });
      onUpdated?.(updated);
      toast({ title: "已儲存驗證設定" });
    },
    onError: () => toast({ title: "儲存失敗", variant: "destructive" }),
  });

  const generateCodeMutation = useMutation({
    mutationFn: async (length: 4 | 5 | 6 = 4) => {
      const res = await apiRequest("POST", `/api/locations/${location.id}/generate-code`, { length });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", location.gameId, "locations"] });
      onUpdated?.(data.location);
      toast({ title: `已生成代碼：${data.verificationCode}` });
    },
  });

  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/locations/${location.id}/generate-qr-token`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", location.gameId, "locations"] });
      onUpdated?.(data.location);
      toast({ title: "已生成 QR token" });
    },
  });

  const loadQrPreview = async () => {
    try {
      const res = await apiRequest("GET", `/api/locations/${location.id}/qr-image`);
      const data = await res.json();
      setQrPreview(data.dataUrl);
    } catch {
      toast({ title: "載入 QR 預覽失敗", variant: "destructive" });
    }
  };

  const mode = (location.verificationMode || "gps") as VerificationMode;

  return (
    <Card className="border-primary/20" data-testid={`location-verification-config-${location.id}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          多元定位驗證設定
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 驗證模式選擇 */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Sparkles className="w-3 h-3" />
            驗證方式
          </Label>
          <Select
            value={mode}
            onValueChange={(v) => updateMutation.mutate({ verificationMode: v as VerificationMode })}
            data-testid={`select-verification-mode-${location.id}`}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MODE_LABELS) as VerificationMode[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {MODE_LABELS[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{MODE_LABELS[mode].desc}</p>
        </div>

        {/* 代碼設定 */}
        {(mode === "code" || mode === "hybrid" || mode === "any") && (
          <div className="space-y-2 p-3 rounded-md bg-muted/40">
            <Label className="flex items-center gap-2">
              <KeyRound className="w-3 h-3" />
              驗證代碼
            </Label>
            <div className="flex gap-2">
              <Input
                value={location.verificationCode || ""}
                onChange={(e) =>
                  updateMutation.mutate({ verificationCode: e.target.value.toUpperCase() })
                }
                placeholder="如：A23B"
                maxLength={10}
                className="font-mono uppercase"
                data-testid={`input-verification-code-${location.id}`}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateCodeMutation.mutate(4)}
                disabled={generateCodeMutation.isPending}
                data-testid={`button-generate-code-${location.id}`}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                亂數生成
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              玩家手動輸入。建議列印貼在現場，不分大小寫。
            </p>
          </div>
        )}

        {/* QR token 設定 */}
        {(mode === "qr" || mode === "hybrid" || mode === "any") && (
          <div className="space-y-2 p-3 rounded-md bg-muted/40">
            <Label className="flex items-center gap-2">
              <QrCode className="w-3 h-3" />
              QR Code
            </Label>
            {location.qrToken ? (
              <div className="space-y-2">
                <Badge variant="outline" className="font-mono text-xs">
                  Token: {location.qrToken.slice(0, 20)}...
                </Badge>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={loadQrPreview} data-testid={`button-preview-qr-${location.id}`}>
                    <QrCode className="w-3 h-3 mr-1" />
                    預覽 QR
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => generateTokenMutation.mutate()}
                    disabled={generateTokenMutation.isPending}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    重新生成
                  </Button>
                </div>
                {qrPreview && (
                  <div className="flex flex-col items-center gap-2 mt-2 p-3 bg-white rounded-md">
                    <img src={qrPreview} alt="QR Preview" className="w-48 h-48" />
                    <a
                      href={qrPreview}
                      download={`qr-${location.id}-${location.name}.png`}
                      className="text-xs underline text-primary"
                    >
                      <Download className="w-3 h-3 inline mr-1" />
                      下載 PNG
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => generateTokenMutation.mutate()}
                disabled={generateTokenMutation.isPending}
                data-testid={`button-generate-qr-${location.id}`}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                生成 QR Code
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              QR 內含簽章 token，無法偽造。請列印張貼在任務點。
            </p>
          </div>
        )}

        {/* GPS 設定提示 */}
        {(mode === "gps" || mode === "hybrid" || mode === "any") && (
          <div className="p-3 rounded-md bg-muted/40 text-xs flex items-start gap-2">
            <Satellite className="w-3 h-3 mt-0.5 text-muted-foreground" />
            <div>
              <p className="font-medium">GPS 範圍：{location.radius || 10}m</p>
              <p className="text-muted-foreground mt-1">
                可在「地點設定」分頁調整半徑。GPS 精度不佳時系統會自動放寬（最多 +30m）。
              </p>
            </div>
          </div>
        )}

        {/* 管理員救援 */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <Label className="text-sm">允許管理員手動標記</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              玩家卡關時，admin 可在控制台一鍵標記到達
            </p>
          </div>
          <Switch
            checked={location.allowAdminRescue !== false}
            onCheckedChange={(checked) => updateMutation.mutate({ allowAdminRescue: checked })}
            data-testid={`switch-allow-rescue-${location.id}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
