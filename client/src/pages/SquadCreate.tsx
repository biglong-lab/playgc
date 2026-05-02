// 🛡 SquadCreate — Squad 建立頁（PR1 of Squad 系統一次到位）
//
// 取代：原 BattleClanCreate（水彈專屬戰隊）
// 設計依據：docs/SQUAD_SYSTEM_DESIGN.md §20.1
//
// 流程：
//   1. 表單填寫（name / tag / description / 主色）
//   2. 提交 POST /api/squads
//   3. 成功 → redirect /squad/:id
//
// 規則：
//   - 一個玩家可加入多個 Squad，但**只能是一個 Squad 的隊長**（後端會擋）
//   - 隊名解散後 180 天鎖名（後端會擋）
//   - 隊名 2-50 字元，tag 1-10 字元（英文/數字/中文）

import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentField } from "@/providers/FieldThemeProvider";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Shield, Loader2 } from "lucide-react";

const PRESET_COLORS = [
  { name: "橘", value: "#f97316" },
  { name: "藍", value: "#3b82f6" },
  { name: "綠", value: "#10b981" },
  { name: "紫", value: "#a855f7" },
  { name: "紅", value: "#ef4444" },
  { name: "金", value: "#eab308" },
];

export default function SquadCreate() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const currentField = useCurrentField();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [primaryColor, setPrimaryColor] = useState(PRESET_COLORS[0].value);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/squads", {
        name: name.trim(),
        tag: tag.trim(),
        description: description.trim() || undefined,
        primaryColor,
        homeFieldId: currentField?.fieldId,
      });
      return res.json();
    },
    onSuccess: (squad: { id: string; name: string }) => {
      toast({
        title: "🎉 隊伍建立成功",
        description: `${squad.name} 已建立，準備好出戰！`,
      });
      setLocation(`/squad/${squad.id}`);
    },
    onError: (err: Error) => {
      toast({
        title: "建立失敗",
        description: err.message || "請稍後再試",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      toast({ title: "隊名至少 2 字元", variant: "destructive" });
      return;
    }
    if (!tag.trim()) {
      toast({ title: "請輸入簡稱標籤", variant: "destructive" });
      return;
    }
    if (!/^[A-Za-z0-9一-鿿]+$/.test(tag.trim())) {
      toast({ title: "標籤只能包含字母、數字、中文", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>請先登入</CardTitle>
            <CardDescription>建立隊伍需要登入帳號</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")} className="w-full">
              回首頁登入
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-bottom-nav md:pb-0">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border safe-top">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            data-testid="btn-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-bold text-lg">建立隊伍</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                >
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>建立永久隊伍</CardTitle>
                  <CardDescription>跨遊戲累積戰績、徽章、排行榜</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 隊名 */}
              <div className="space-y-1.5">
                <Label htmlFor="name">隊伍名稱 *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：火焰戰士"
                  maxLength={50}
                  data-testid="input-squad-name"
                />
                <p className="text-xs text-muted-foreground">
                  2-50 字元，建議好記、好喊
                </p>
              </div>

              {/* Tag */}
              <div className="space-y-1.5">
                <Label htmlFor="tag">簡稱標籤 *</Label>
                <Input
                  id="tag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase())}
                  placeholder="例如：FIRE"
                  maxLength={10}
                  className="uppercase font-mono"
                  data-testid="input-squad-tag"
                />
                <p className="text-xs text-muted-foreground">
                  顯示為 [{tag.trim() || "TAG"}]，1-10 字元，英文/數字/中文
                </p>
              </div>

              {/* 描述 */}
              <div className="space-y-1.5">
                <Label htmlFor="description">隊伍描述（選填）</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="一句話介紹你的隊伍..."
                  maxLength={500}
                  rows={3}
                  data-testid="input-squad-description"
                />
              </div>

              {/* 主色 */}
              <div className="space-y-1.5">
                <Label>隊伍主色</Label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setPrimaryColor(c.value)}
                      className={`aspect-square rounded-lg border-2 transition-all flex items-center justify-center text-[10px] font-medium ${
                        primaryColor === c.value
                          ? "border-foreground scale-110 shadow"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value, color: "#fff" }}
                      data-testid={`btn-color-${c.value.slice(1)}`}
                      aria-label={`選擇 ${c.name} 色`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p>💡 建立後可邀請朋友加入</p>
                <p>🏆 跨遊戲累積戰績、ELO、徽章</p>
                <p>🔒 解散後隊名會鎖定 180 天，請慎選</p>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={createMutation.isPending}
                data-testid="btn-create-squad"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    建立中...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    建立隊伍
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
}
