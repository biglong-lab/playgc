// 從模組建立遊戲確認彈窗
import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MODULE_CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  type GameModule,
} from "@shared/schema";
import { Loader2, Sparkles, FileText, Clock, Users } from "lucide-react";

interface CreateFromModuleDialogProps {
  module: GameModule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateFromModuleDialog({
  module,
  open,
  onOpenChange,
}: CreateFromModuleDialogProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [gameName, setGameName] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; moduleId: string }) => {
      const response = await fetch(
        `/api/admin/modules/${data.moduleId}/create-game`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ title: data.title }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "建立失敗");
      }
      return response.json();
    },
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({ title: "遊戲已建立", description: `${game.title} 已從模組建立成功` });
      onOpenChange(false);
      setGameName("");
      // 導向遊戲編輯器
      navigate(`/admin/games/${game.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "建立失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!module || !gameName.trim()) return;
    createMutation.mutate({
      title: gameName.trim(),
      moduleId: module.id,
    });
  };

  const handleClose = () => {
    if (!createMutation.isPending) {
      onOpenChange(false);
      setGameName("");
    }
  };

  if (!module) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            從模組建立遊戲
          </DialogTitle>
          <DialogDescription>
            將使用「{module.name}」模組建立新遊戲，包含 {module.pages.length} 個預設頁面
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 模組摘要 */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{module.coverEmoji}</span>
              <div>
                <div className="font-medium text-sm">{module.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">
                    {MODULE_CATEGORY_LABELS[module.category]}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {DIFFICULTY_LABELS[module.difficulty]}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" /> {module.pages.length} 頁
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {module.estimatedTime ?? "?"} 分鐘
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {module.maxPlayers} 人
              </span>
            </div>
          </div>

          {/* 遊戲名稱輸入 */}
          <div className="space-y-2">
            <Label htmlFor="game-name">遊戲名稱</Label>
            <Input
              id="game-name"
              placeholder="為你的遊戲取個名字..."
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              disabled={createMutation.isPending}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={!gameName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  建立中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1" />
                  建立遊戲
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
