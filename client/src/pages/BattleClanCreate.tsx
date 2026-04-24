// 水彈對戰 PK 擂台 — 建立戰隊頁（深色軍事風格）
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useBattleFieldId } from "@/hooks/useBattleFieldId";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import BattleLayout from "@/components/battle/BattleLayout";
import { Shield, AlertCircle } from "lucide-react";

// 與後端 insertBattleClanSchema 一致的 tag 驗證
const TAG_REGEX = /^[A-Za-z0-9\u4e00-\u9fff]+$/;

export default function BattleClanCreate() {
  const { user } = useAuth();
  const { fieldId, isLoading: fieldLoading } = useBattleFieldId();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");

  const tagError = tag.length > 0 && !TAG_REGEX.test(tag)
    ? "標籤只能包含英文、數字或中文"
    : null;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!fieldId) throw new Error("無法取得場域資訊，請重新整理頁面");

      const res = await authFetch(`/api/battle/clans?fieldId=${fieldId}`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), tag: tag.trim(), description: description.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "建立失敗" }));
        throw new Error(err.error || `建立失敗 (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (clan) => {
      toast({ title: "戰隊建立成功！" });
      queryClient.invalidateQueries({ queryKey: ["/api/battle/clans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/battle/my/clan"] });
      navigate(`/battle/clan/${clan.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "建立失敗", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = name.trim().length >= 2 && tag.trim().length >= 1 && !tagError && !!fieldId && !createMutation.isPending;

  return (
    <BattleLayout title="建立戰隊">
      <div className="max-w-md mx-auto">
        {/* 場域缺失警告 */}
        {!fieldLoading && !fieldId && (
          <Card className="mb-4 border-destructive/50 bg-destructive/10">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">無法取得場域資訊</p>
                <p className="text-muted-foreground mt-1">
                  系統尚未設定對戰場地，請聯繫管理員。
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              建立戰隊
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">戰隊名稱</Label>
              <Input
                id="name"
                placeholder="如：王牌突擊隊（至少 2 字）"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tag">簡稱標籤</Label>
              <Input
                id="tag"
                placeholder="如：ACE"
                value={tag}
                onChange={(e) => setTag(e.target.value.toUpperCase())}
                maxLength={10}
                className={tagError ? "border-destructive" : ""}
              />
              {tagError ? (
                <p className="text-xs text-destructive">{tagError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  顯示為 [{tag || "TAG"}]，1-10 字元，英文/數字/中文
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">戰隊描述（選填）</Label>
              <Textarea
                id="description"
                placeholder="介紹你的戰隊..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit}
            >
              {createMutation.isPending ? "建立中..." : "建立戰隊"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </BattleLayout>
  );
}
