// 玩家自評水彈對戰結果 Dialog — Phase 15.1
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §11.2
//
// 使用情境：
//   - 對戰進行中或結束（slot.status = 'in_progress' / 'completed' 但無 admin result）
//   - 隊長 / officer 點「我們的結果」按鈕開啟此 Dialog
//   - 雙方一致 → 自動結算
//   - 不一致 → 標記爭議並通知裁判
//
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Trophy,
  XCircle,
  Minus,
  Loader2,
  AlertTriangle,
  Check,
} from "lucide-react";

interface Props {
  slotId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SelfReport {
  reporterUserId: string;
  team: string;
  result: "win" | "loss" | "draw";
  reportedAt: string | Date;
}

interface ReportsState {
  slotId: string;
  reports: SelfReport[];
  consensus: {
    consistent: boolean;
    winningTeam?: string;
    isDraw?: boolean;
  };
}

export default function SelfReportDialog({ slotId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState<
    "win" | "loss" | "draw" | null
  >(null);

  const { data, isLoading, refetch } = useQuery<ReportsState>({
    queryKey: ["/api/battle/slots", slotId, "self-reports"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/battle/slots/${slotId}/self-reports`,
      );
      return res.json();
    },
    enabled: open && !!slotId,
    refetchInterval: open ? 5000 : false, // 等對方時每 5 秒重整
  });

  const reportMut = useMutation({
    mutationFn: async (result: "win" | "loss" | "draw") => {
      const res = await apiRequest(
        "POST",
        `/api/battle/slots/${slotId}/self-report`,
        { result },
      );
      return res.json();
    },
    onSuccess: (data) => {
      if (data.consensus) {
        toast({
          title: "🎉 結算完成！",
          description: data.isDraw
            ? "雙方達成共識：平手"
            : `雙方達成共識：${data.winningTeam} 勝`,
        });
        qc.invalidateQueries({ queryKey: ["/api/battle/slots", slotId] });
        onOpenChange(false);
      } else if (data.disputed) {
        toast({
          title: "⚠️ 雙方意見不一致",
          description: "已通知場域裁判仲裁，請等候處理",
          variant: "destructive",
        });
        refetch();
      } else {
        toast({
          title: "已回報",
          description: "等待對方隊長回報",
        });
        refetch();
      }
      setSubmitting(null);
    },
    onError: (err: Error) => {
      toast({
        title: "回報失敗",
        description: err.message,
        variant: "destructive",
      });
      setSubmitting(null);
    },
  });

  const handleReport = (result: "win" | "loss" | "draw") => {
    setSubmitting(result);
    reportMut.mutate(result);
  };

  const reportsCount = data?.reports?.length ?? 0;
  const isDisputed = !data?.consensus.consistent && reportsCount >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            玩家自評對戰結果
          </DialogTitle>
          <DialogDescription>
            雙方隊長一致即自動結算，不一致將通知裁判仲裁
          </DialogDescription>
        </DialogHeader>

        {/* 已有 reports 顯示狀態 */}
        {!isLoading && reportsCount > 0 && (
          <div className="space-y-2 mb-4 p-3 bg-muted/50 rounded">
            <p className="text-xs font-medium">目前回報狀態：</p>
            {data?.reports.map((r) => (
              <div
                key={r.reporterUserId}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium">{r.team}</span>
                <Badge
                  variant={
                    r.result === "win"
                      ? "default"
                      : r.result === "draw"
                        ? "secondary"
                        : "outline"
                  }
                  className="text-[11px]"
                >
                  {r.result === "win"
                    ? "🏆 我們贏"
                    : r.result === "loss"
                      ? "😅 我們輸"
                      : "🤝 平手"}
                </Badge>
              </div>
            ))}

            {isDisputed ? (
              <div className="mt-2 p-2 bg-destructive/10 rounded flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <span className="text-xs text-destructive">
                  雙方意見不一致，已通知場域裁判仲裁
                </span>
              </div>
            ) : reportsCount === 1 ? (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                等待對方隊長回報...
              </p>
            ) : null}
          </div>
        )}

        {/* 回報按鈕 */}
        {!isDisputed && (
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="default"
              className="flex flex-col h-auto py-3 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleReport("win")}
              disabled={!!submitting}
            >
              {submitting === "win" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Trophy className="w-5 h-5 mb-1" />
                  <span className="text-xs">我們贏</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="flex flex-col h-auto py-3"
              onClick={() => handleReport("draw")}
              disabled={!!submitting}
            >
              {submitting === "draw" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Minus className="w-5 h-5 mb-1" />
                  <span className="text-xs">平手</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="flex flex-col h-auto py-3"
              onClick={() => handleReport("loss")}
              disabled={!!submitting}
            >
              {submitting === "loss" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-5 h-5 mb-1" />
                  <span className="text-xs">我們輸</span>
                </>
              )}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
