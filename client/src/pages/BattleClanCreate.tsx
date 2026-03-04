// 水彈對戰 PK 擂台 — 建立戰隊頁（深色軍事風格）
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import BattleLayout from "@/components/battle/BattleLayout";
import { Shield } from "lucide-react";

export default function BattleClanCreate() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const { getIdToken } = await import("@/lib/firebase");
      const token = await getIdToken();
      const res = await fetch(`/api/battle/clans?fieldId=${user?.defaultFieldId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ name, tag, description: description || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "建立失敗");
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

  return (
    <BattleLayout title="建立戰隊">
      <div className="max-w-md mx-auto">
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
                placeholder="如：王牌突擊隊"
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
              />
              <p className="text-xs text-muted-foreground">
                顯示為 [{tag || "TAG"}]，1-10 字元
              </p>
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
              disabled={createMutation.isPending || !name.trim() || !tag.trim()}
            >
              {createMutation.isPending ? "建立中..." : "建立戰隊"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </BattleLayout>
  );
}
