// 🤖 Admin AI 副駕駛 Panel
//
// 整合 3 種能力：
//   💡 推薦下一頁（suggest-next）
//   🔍 流程診斷（diagnose）
//   ✨ 文案優化（polish-copy）— 由 CopyPolishButton 元件單獨處理
//
// 用法：在 game-editor 的 sidebar/footer 引用
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PageSummary {
  id?: string;
  pageOrder: number;
  pageType: string;
  customName?: string | null;
  config?: Record<string, unknown>;
}

interface SuggestionResult {
  pageType: string;
  reason: string;
  suggestedName?: string;
}

interface DiagnoseIssue {
  severity: "info" | "warning" | "error";
  message: string;
  pageOrder?: number;
  fix?: string;
}

interface AdminCopilotPanelProps {
  gameId: string;
  pages: PageSummary[];
  /** 點推薦時觸發新增 page */
  onAddPage?: (pageType: string, suggestedName?: string) => void;
}

export default function AdminCopilotPanel({
  gameId,
  pages,
  onAddPage,
}: AdminCopilotPanelProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<SuggestionResult[] | null>(null);
  const [issues, setIssues] = useState<DiagnoseIssue[] | null>(null);

  // 推薦下一頁
  const suggestMutation = useMutation({
    mutationFn: async (): Promise<{ suggestions: SuggestionResult[] }> => {
      const summary = pages.map((p) => ({
        pageOrder: p.pageOrder,
        pageType: p.pageType,
        customName: p.customName ?? null,
        hint: extractHint(p.config),
      }));
      const res = await apiRequest("POST", "/api/admin/copilot/suggest-next", {
        gameId,
        currentPages: summary,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions);
      toast({ title: "💡 已生成推薦", description: `${data.suggestions.length} 個建議` });
    },
    onError: (err: Error) => {
      toast({ title: "❌ 推薦失敗", description: err.message, variant: "destructive" });
    },
  });

  // 流程診斷
  const diagnoseMutation = useMutation({
    mutationFn: async (): Promise<{
      issues: DiagnoseIssue[];
      summary: { errors: number; warnings: number; infos: number };
    }> => {
      const res = await apiRequest("POST", "/api/admin/copilot/diagnose", {
        pages: pages.map((p) => ({
          id: p.id ?? `page-${p.pageOrder}`,
          pageOrder: p.pageOrder,
          pageType: p.pageType,
          customName: p.customName ?? null,
          config: p.config ?? {},
        })),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setIssues(data.issues);
      const { errors, warnings, infos } = data.summary;
      if (errors === 0 && warnings === 0 && infos === 0) {
        toast({ title: "✅ 流程健康", description: "沒發現任何問題" });
      } else {
        toast({
          title: "🔍 診斷完成",
          description: `${errors} 錯誤 / ${warnings} 警告 / ${infos} 提示`,
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: "❌ 診斷失敗", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card data-testid="admin-copilot-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <span className="text-base">🤖</span>
          AI 副駕駛
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 兩個按鈕 */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => suggestMutation.mutate()}
            disabled={suggestMutation.isPending}
            data-testid="button-suggest-next"
          >
            {suggestMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Lightbulb className="w-3.5 h-3.5 mr-1 text-yellow-500" />
            )}
            💡 推薦下一頁
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => diagnoseMutation.mutate()}
            disabled={diagnoseMutation.isPending || pages.length === 0}
            data-testid="button-diagnose"
          >
            {diagnoseMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Stethoscope className="w-3.5 h-3.5 mr-1 text-blue-500" />
            )}
            🔍 流程診斷
          </Button>
        </div>

        {/* 推薦結果 */}
        {suggestions && suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">推薦下一頁：</p>
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="border rounded p-2 flex items-start gap-2 hover:bg-muted/50"
                data-testid={`suggestion-${i}`}
              >
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  {s.pageType}
                </Badge>
                <div className="flex-1 min-w-0">
                  {s.suggestedName && (
                    <p className="text-sm font-medium truncate">{s.suggestedName}</p>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-2">{s.reason}</p>
                </div>
                {onAddPage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 flex-shrink-0"
                    onClick={() => onAddPage(s.pageType, s.suggestedName)}
                    data-testid={`button-apply-suggestion-${i}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 診斷結果 */}
        {issues && (
          <div className="space-y-1">
            {issues.length === 0 ? (
              <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                流程健康，沒發現問題
              </div>
            ) : (
              issues.slice(0, 10).map((issue, i) => {
                const Icon =
                  issue.severity === "error"
                    ? AlertTriangle
                    : issue.severity === "warning"
                    ? AlertTriangle
                    : Info;
                const colorClass =
                  issue.severity === "error"
                    ? "bg-red-500/10 text-red-700 dark:text-red-400"
                    : issue.severity === "warning"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "bg-blue-500/10 text-blue-700 dark:text-blue-400";
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-2 rounded text-xs ${colorClass}`}
                    data-testid={`issue-${i}`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p>{issue.message}</p>
                      {issue.fix && (
                        <p className="opacity-80 italic mt-0.5">💡 {issue.fix}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** 從 page.config 取一個簡短描述當 hint 給 AI */
function extractHint(config?: Record<string, unknown>): string | undefined {
  if (!config) return undefined;
  const candidates = ["title", "instruction", "question", "content"];
  for (const k of candidates) {
    const v = config[k];
    if (typeof v === "string" && v.length > 0) {
      return v.substring(0, 40);
    }
  }
  return undefined;
}
