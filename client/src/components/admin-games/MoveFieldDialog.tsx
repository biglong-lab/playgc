// 🚚 搬移遊戲到其他場域對話框（super_admin only）
//
// 只顯示給系統超級管理員，執行 POST /api/admin/games/:id/move-field
// UI：下拉選擇目標場域 → 確認後執行
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Move, AlertTriangle } from "lucide-react";
import type { Game } from "@shared/schema";

interface FieldOption {
  id: string;
  code: string;
  name: string;
}

interface MoveFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game | null;
}

export default function MoveFieldDialog({ open, onOpenChange, game }: MoveFieldDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [targetFieldId, setTargetFieldId] = useState<string>("");

  // 拿所有場域（super_admin 權限才看得到全部）
  const { data: fields = [], isLoading: fieldsLoading } = useQuery<FieldOption[]>({
    queryKey: ["/api/admin/fields"],
    queryFn: () => fetchWithAdminAuth("/api/admin/fields"),
    enabled: open,
  });

  // 開啟時重置選擇
  useEffect(() => {
    if (!open) setTargetFieldId("");
  }, [open]);

  const moveMutation = useMutation({
    mutationFn: async () => {
      if (!game || !targetFieldId) throw new Error("缺少參數");
      return fetchWithAdminAuth(`/api/admin/games/${game.id}/move-field`, {
        method: "POST",
        body: JSON.stringify({ targetFieldId }),
      });
    },
    onSuccess: (res: { message: string }) => {
      toast({ title: res.message || "搬移成功" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "搬移失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    },
  });

  const currentField = fields.find((f) => f.id === game?.fieldId);
  const targetField = fields.find((f) => f.id === targetFieldId);
  const availableFields = fields.filter((f) => f.id !== game?.fieldId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Move className="w-5 h-5 text-blue-500" />
            搬移遊戲到其他場域
          </DialogTitle>
          <DialogDescription>
            此操作會把遊戲從目前場域移到目標場域。已存在的 session / 紀錄不會被刪除。
          </DialogDescription>
        </DialogHeader>

        {game && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-3 text-sm space-y-1 bg-muted/30">
              <div className="flex justify-between">
                <span className="text-muted-foreground">遊戲</span>
                <span className="font-medium">{game.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">目前場域</span>
                <span className="font-mono text-xs">
                  {currentField ? `${currentField.name}（${currentField.code}）` : game.fieldId || "未指派"}
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">目標場域</label>
              {fieldsLoading ? (
                <div className="h-10 rounded border flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : availableFields.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  沒有其他可選的場域
                </div>
              ) : (
                <Select value={targetFieldId} onValueChange={setTargetFieldId}>
                  <SelectTrigger data-testid="select-target-field">
                    <SelectValue placeholder="選擇要移到哪個場域..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name} <span className="text-muted-foreground ml-1">({f.code})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {targetField && (
              <div className="rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/30 p-3 text-sm">
                確認搬移「{game.title}」到「<b>{targetField.name}</b>」？
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button
            onClick={() => moveMutation.mutate()}
            disabled={!targetFieldId || moveMutation.isPending}
            data-testid="button-confirm-move-field"
          >
            {moveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Move className="w-4 h-4 mr-2" />
            )}
            {moveMutation.isPending ? "搬移中..." : "確認搬移"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
