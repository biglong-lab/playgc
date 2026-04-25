// Squad 隊長後台設定頁 — Phase 16.1 + 16.3
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §15 §17 §18
//
// URL: /squad/:squadId/settings
//
// 隊長 / officer 限定：
//   - 上傳 / 換隊徽
//   - 改隊名 / Tag（30 天冷卻）
//   - 改 description / 主題色
//   - is_public 公開/私密切換
//   - 查看改名歷史
//
import { useState, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Image as ImageIcon,
  Upload,
  Loader2,
  Eye,
  EyeOff,
  Save,
  Settings,
  Crown,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";

interface SquadDetail {
  squad: {
    id: string;
    name: string;
    tag: string;
    description?: string | null;
    emblemUrl?: string | null;
    primaryColor?: string | null;
    isPublic: boolean;
    leaderId: string;
    nameChangedAt?: string | null;
    createdAt: string;
  };
  members?: Array<{
    userId: string;
    role: "leader" | "officer" | "member";
  }>;
}

export default function SquadSettings() {
  const [, params] = useRoute("/squad/:squadId/settings");
  const squadId = params?.squadId ?? "";
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<SquadDetail>({
    queryKey: ["/api/squads", squadId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/squads/${squadId}`);
      return res.json();
    },
    enabled: !!squadId,
  });

  // 表單 draft
  const [draft, setDraft] = useState<{
    name?: string;
    tag?: string;
    description?: string;
    primaryColor?: string;
    isPublic?: boolean;
  }>({});

  const merged = data?.squad
    ? {
        name: draft.name ?? data.squad.name,
        tag: draft.tag ?? data.squad.tag,
        description: draft.description ?? (data.squad.description ?? ""),
        primaryColor: draft.primaryColor ?? (data.squad.primaryColor ?? ""),
        isPublic: draft.isPublic ?? data.squad.isPublic,
      }
    : null;

  // 權限
  const myMember = data?.members?.find((m) => m.userId === user?.id);
  const canEdit = myMember?.role === "leader" || myMember?.role === "officer";

  const saveMut = useMutation({
    mutationFn: async (payload: typeof draft) => {
      const res = await apiRequest("PATCH", `/api/squads/${squadId}`, payload);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "儲存失敗");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ 設定已儲存" });
      qc.invalidateQueries({ queryKey: ["/api/squads", squadId] });
      setDraft({});
    },
    onError: (err: Error) => {
      toast({ title: "儲存失敗", description: err.message, variant: "destructive" });
    },
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      // 轉 base64
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await apiRequest("POST", `/api/squads/${squadId}/emblem`, {
        imageData: dataUrl,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "上傳失敗");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ 隊徽已更新" });
      qc.invalidateQueries({ queryKey: ["/api/squads", squadId] });
    },
    onError: (err: Error) => {
      toast({ title: "上傳失敗", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading || !data || !merged) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="mb-3">你不是這支隊伍的隊長 / 幹部</p>
            <Link href={`/squad/${squadId}`}>
              <Button variant="outline">查看公開頁</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "請選擇圖片檔", variant: "destructive" });
      return;
    }
    if (file.size > 5_000_000) {
      toast({ title: "檔案過大（最多 5MB）", variant: "destructive" });
      return;
    }
    uploadMut.mutate(file);
  };

  const hasChanges = Object.keys(draft).length > 0;

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link href={`/squad/${squadId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              隊伍設定
            </h1>
            <p className="text-xs text-muted-foreground">
              {merged.name}（{merged.tag}）
            </p>
          </div>
        </div>
        <Button
          onClick={() => saveMut.mutate(draft)}
          disabled={!hasChanges || saveMut.isPending}
        >
          {saveMut.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          儲存
        </Button>
      </div>

      <div className="space-y-4">
        {/* 隊徽 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              隊徽
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div
                className="w-24 h-24 rounded-lg flex items-center justify-center border-2 border-dashed shrink-0"
                style={{
                  backgroundColor: merged.primaryColor || "#0f766e",
                }}
              >
                {data.squad.emblemUrl ? (
                  <img
                    src={data.squad.emblemUrl}
                    alt={merged.name}
                    className="w-full h-full rounded-lg object-cover"
                  />
                ) : (
                  <ImageIcon className="w-10 h-10 text-white/60" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium mb-2">上傳隊徽</p>
                <p className="text-xs text-muted-foreground mb-3">
                  建議 512×512 PNG/JPG，最多 5MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  className="hidden"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMut.isPending}
                >
                  {uploadMut.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  選擇圖片
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 基本資訊 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">隊伍名稱</Label>
              <Input
                id="name"
                value={merged.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                ⚠️ 改名後 30 天內無法再次修改
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tag">隊伍 Tag</Label>
              <Input
                id="tag"
                value={merged.tag}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, tag: e.target.value.toUpperCase() }))
                }
                maxLength={10}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">隊伍簡介</Label>
              <Textarea
                id="description"
                value={merged.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                maxLength={500}
                rows={3}
                placeholder="介紹一下你的隊伍..."
              />
              <p className="text-xs text-muted-foreground text-right">
                {merged.description.length} / 500
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="color">主題色（HEX）</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  value={merged.primaryColor}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, primaryColor: e.target.value }))
                  }
                  placeholder="#0f766e"
                  className="font-mono"
                />
                <input
                  type="color"
                  value={merged.primaryColor || "#0f766e"}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, primaryColor: e.target.value }))
                  }
                  className="w-12 h-10 rounded cursor-pointer"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 公開/私密 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {merged.isPublic ? (
                <Eye className="w-4 h-4 text-emerald-600" />
              ) : (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              )}
              公開分享頁
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-3">
                <p className="text-sm font-medium mb-1">
                  {merged.isPublic ? "公開（任何人都看得到）" : "私密（僅成員可見）"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {merged.isPublic
                    ? "你的隊伍會出現在搜尋結果與排行榜，他人可透過分享連結查看完整戰績"
                    : "排行榜只顯示隊名，戰績與成員不公開"}
                </p>
              </div>
              <Switch
                checked={merged.isPublic}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, isPublic: v }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* 危險區 */}
        {data.squad.leaderId === user?.id && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                危險區
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-3">
                  <p className="text-sm font-medium mb-1">解散隊伍</p>
                  <p className="text-xs text-muted-foreground">
                    解散後隊名鎖定 180 天，所有成員自動退出
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `確定要解散「${merged.name}」嗎？\n\n隊名將鎖定 180 天無法重複使用，所有成員會自動退出。\n\n此操作無法復原。`,
                      )
                    ) {
                      return;
                    }
                    try {
                      const res = await apiRequest(
                        "DELETE",
                        `/api/squads/${squadId}`,
                      );
                      const data = await res.json();
                      if (!res.ok) {
                        throw new Error(data.error ?? "解散失敗");
                      }
                      toast({
                        title: "✅ 隊伍已解散",
                        description: data.message,
                      });
                      navigate("/me");
                    } catch (e: any) {
                      toast({
                        title: "解散失敗",
                        description: e.message,
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  解散隊伍
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
